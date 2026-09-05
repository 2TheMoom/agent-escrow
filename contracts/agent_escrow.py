# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""AgentEscrow - a GenLayer Intelligent Contract for the Agent Tank hackathon.

One agent (the requester) escrows payment for another named agent (the
worker) to fetch and report a specific, checkable fact from a specific,
neutral third-party source. GenLayer validators independently re-fetch
the same source and judge whether the worker's report matches it before
releasing payment - the worker never gets paid on the requester's say-so,
and the requester can't refuse to pay for a correct report either.

Security model (why this shape, not a simpler one):
- The source must come from a hardcoded allowlist of neutral third
  parties, not a URL either side picks freely. Letting the worker name
  the source after doing the work would let them just point at a page
  they control; letting the requester name an arbitrary URL has the
  same problem in the other direction (they could tamper with it before
  adjudication to dodge paying). Only a source neither party controls
  makes the comparison meaningful.
- There is no time-based deadline (GenVM doesn't expose a deterministic
  clock to contracts). Instead the requester can cancel and reclaim
  their escrow at any time - but only while nothing has been submitted
  yet. Once a worker submits a report, cancellation is blocked; the task
  must go through adjudicate() and resolve to accepted or rejected,
  which auto-refunds the requester anyway if the report was wrong. This
  means a good-faith requester is never stuck, and a submitted report
  can't be silently discarded to dodge a payout.
- No appeals: unlike a subjective judgment call (e.g. "was this wallet
  really compromised?"), matching a reported value against a live-fetched
  source is close to deterministic, so a bad first verdict is unlikely
  enough that appeal complexity isn't worth it for this contract.
"""

from dataclasses import dataclass
from genlayer import *

# Neutral, third-party sources only - neither the requester nor the worker
# can be the operator of any of these, which is what makes the comparison
# meaningful. A source either side controlled could be tampered with to
# force whatever verdict benefits them.
ALLOWED_SOURCE_DOMAINS = [
    "api.coingecko.com",
    "api.coinbase.com",
    "etherscan.io",
]


def _is_allowed_source(source_url: str) -> bool:
    url = source_url.lower()
    return any(domain in url for domain in ALLOWED_SOURCE_DOMAINS)


@allow_storage
@dataclass
class Task:
    id: str
    requester: Address
    worker: Address
    source_url: str
    fact_description: str
    amount: u256
    status: str  # "open" | "submitted" | "accepted" | "rejected" | "cancelled"
    reported_value: str
    verdict_reasoning: str


class AgentEscrow(gl.Contract):
    """Escrows payment for a verified-data-delivery task between two
    agents, releasing it only once GenLayer validators confirm the
    worker's reported value matches an independently-fetched, neutral
    source."""

    tasks: TreeMap[str, Task]
    requester_tasks: TreeMap[Address, DynArray[str]]
    worker_tasks: TreeMap[Address, DynArray[str]]
    next_task_id: u256

    def __init__(self):
        self.next_task_id = 0

    @gl.public.write.payable
    def create_task(self, worker: str, source_url: str, fact_description: str) -> str:
        """Escrows this transaction's value and creates a task for
        `worker` to report `fact_description` as found at `source_url`.
        `source_url` must be on the neutral-source allowlist."""
        amount = gl.message.value
        if amount <= 0:
            raise gl.vm.UserError("Must escrow a positive amount to create a task")

        if not _is_allowed_source(source_url):
            raise gl.vm.UserError(
                "source_url must be one of the approved neutral data sources"
            )

        requester = gl.message.sender_address
        worker_address = Address(worker)

        task_id = str(self.next_task_id)
        self.next_task_id += 1

        task = Task(
            id=task_id,
            requester=requester,
            worker=worker_address,
            source_url=source_url,
            fact_description=fact_description,
            amount=amount,
            status="open",
            reported_value="",
            verdict_reasoning="",
        )
        self.tasks[task_id] = task
        self.requester_tasks.get_or_insert_default(requester).append(task_id)
        self.worker_tasks.get_or_insert_default(worker_address).append(task_id)
        return task_id

    @gl.public.write
    def cancel_task(self, task_id: str) -> None:
        """Refunds the requester in full - but only while the task is
        still open. Once a worker has submitted a report, the task must
        be resolved via adjudicate() instead, so a submitted report can
        never be silently discarded."""
        if task_id not in self.tasks:
            raise gl.vm.UserError("Task not found")

        task = self.tasks[task_id]
        if gl.message.sender_address != task.requester:
            raise gl.vm.UserError("Only the requester can cancel this task")
        if task.status != "open":
            raise gl.vm.UserError("Task already has a submitted report")

        task.status = "cancelled"
        gl.get_contract_at(task.requester).emit_transfer(value=task.amount)

    @gl.public.write
    def submit_deliverable(self, task_id: str, reported_value: str) -> None:
        """Only the named worker can submit, and only once, while the
        task is still open."""
        if task_id not in self.tasks:
            raise gl.vm.UserError("Task not found")

        task = self.tasks[task_id]
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError("Only the named worker can submit a deliverable")
        if task.status != "open":
            raise gl.vm.UserError("A deliverable was already submitted for this task")

        task.reported_value = reported_value
        task.status = "submitted"

    def _judge(self, source_url: str, fact_description: str, reported_value: str) -> dict:
        def leader_fn() -> dict:
            source_data = gl.nondet.web.render(source_url, mode="text")

            prompt = f"""
You are adjudicating a data-delivery task on AgentEscrow, a GenLayer Intelligent
Contract that pays one AI agent to fetch a fact for another.

Fact requested: {fact_description}
Authoritative source (fetched live, independently, by you - not provided or
editable by either party): {source_url}
\"\"\"
{source_data}
\"\"\"

The worker agent reported this value:
{reported_value}

Decide whether the reported value accurately reflects the fact as shown in the
authoritative source above. For a value that can fluctuate quickly (e.g. a live
price), allow for a small, reasonable margin to account for normal movement
between when the worker checked and when you fetched the source - but treat a
value that is clearly wrong, stale, fabricated, or contradicted by the source as
a reason to reject.

Respond in JSON:
{{
    "verdict": str,  // "accept" or "reject"
    "confidence": int,  // 0-100
    "reasoning": str  // one or two sentences
}}
It is mandatory that you respond only using the JSON format above,
nothing else. Don't include any other words or characters,
your output must be only JSON without any formatting prefix or suffix.
This result should be perfectly parsable by a JSON parser without errors.
"""
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            return my_result["verdict"] == leaders_res.calldata["verdict"]

        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    @gl.public.write
    def adjudicate(self, task_id: str) -> None:
        """Callable by anyone once a report has been submitted - not just
        the requester or worker - so neither side can stall the other's
        payout by refusing to trigger adjudication."""
        if task_id not in self.tasks:
            raise gl.vm.UserError("Task not found")

        task = self.tasks[task_id]
        if task.status != "submitted":
            raise gl.vm.UserError("Task has no pending report to adjudicate")

        verdict = self._judge(task.source_url, task.fact_description, task.reported_value)
        verdict_value = str(verdict.get("verdict", "")).lower()
        task.verdict_reasoning = str(verdict.get("reasoning", ""))

        if verdict_value == "accept":
            task.status = "accepted"
            gl.get_contract_at(task.worker).emit_transfer(value=task.amount)
        else:
            task.status = "rejected"
            gl.get_contract_at(task.requester).emit_transfer(value=task.amount)

    @gl.public.view
    def get_task(self, task_id: str) -> Task:
        if task_id not in self.tasks:
            raise gl.vm.UserError("Task not found")
        return self.tasks[task_id]

    @gl.public.view
    def get_tasks_by_requester(self, requester: str) -> list:
        addr = Address(requester)
        if addr not in self.requester_tasks:
            return []
        return [self.tasks[task_id] for task_id in self.requester_tasks[addr]]

    @gl.public.view
    def get_tasks_by_worker(self, worker: str) -> list:
        addr = Address(worker)
        if addr not in self.worker_tasks:
            return []
        return [self.tasks[task_id] for task_id in self.worker_tasks[addr]]

    @gl.public.view
    def get_all_tasks(self) -> dict:
        return {task_id: task for task_id, task in self.tasks.items()}
