"""Direct-mode tests for AgentEscrow."""

import json

from tests.direct.conftest import to_hex

CONTRACT = "contracts/agent_escrow.py"
SOURCE = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"


def _setup_verdict_mock(vm, source_body, verdict, confidence, reasoning):
    vm.mock_web(r".*", {"status": 200, "body": source_body})
    vm.mock_llm(
        r".*adjudicating a data-delivery task.*",
        json.dumps({"verdict": verdict, "confidence": confidence, "reasoning": reasoning}),
    )


def test_create_task(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)

    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    task = contract.get_task(task_id)
    assert task.requester.as_hex == to_hex(direct_alice)
    assert task.worker.as_hex == bob
    assert task.source_url == SOURCE
    assert task.fact_description == "current ETH/USD price"
    assert task.amount == 1000
    assert task.status == "open"
    assert task.reported_value == ""


def test_create_task_zero_value_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    bob = to_hex(direct_bob)

    with direct_vm.expect_revert("Must escrow a positive amount to create a task"):
        contract.create_task(bob, SOURCE, "current ETH/USD price")


def test_create_task_disallowed_source_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)

    with direct_vm.expect_revert("source_url must be one of the approved neutral data sources"):
        contract.create_task(bob, "https://attacker.example/fake-price", "current ETH/USD price")


def test_create_task_allows_all_listed_sources(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    bob = to_hex(direct_bob)

    for url in [
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum",
        "https://api.coinbase.com/v2/prices/ETH-USD/spot",
        "https://etherscan.io/address/0x0",
    ]:
        direct_vm.value = 1000
        contract.create_task(bob, url, "fact")


def test_cancel_task_by_requester_while_open(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)

    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")
    contract.cancel_task(task_id)

    assert contract.get_task(task_id).status == "cancelled"


def test_cancel_task_by_non_requester_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the requester can cancel this task"):
        contract.cancel_task(task_id)


def test_cancel_task_after_submission_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    direct_vm.sender = direct_bob
    contract.submit_deliverable(task_id, "3421.50")

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Task already has a submitted report"):
        contract.cancel_task(task_id)


def test_submit_deliverable_by_non_worker_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    with direct_vm.expect_revert("Only the named worker can submit a deliverable"):
        contract.submit_deliverable(task_id, "3421.50")


def test_submit_deliverable_twice_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    direct_vm.sender = direct_bob
    contract.submit_deliverable(task_id, "3421.50")

    with direct_vm.expect_revert("A deliverable was already submitted for this task"):
        contract.submit_deliverable(task_id, "3421.60")


def test_adjudicate_accepts_matching_report(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    direct_vm.sender = direct_bob
    contract.submit_deliverable(task_id, "3421.50")

    _setup_verdict_mock(direct_vm, '{"ethereum": {"usd": 3421.50}}', "accept", 95, "matches the live source")
    contract.adjudicate(task_id)

    task = contract.get_task(task_id)
    assert task.status == "accepted"
    assert task.verdict_reasoning == "matches the live source"


def test_adjudicate_rejects_mismatched_report(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    direct_vm.sender = direct_bob
    contract.submit_deliverable(task_id, "1.00")

    _setup_verdict_mock(direct_vm, '{"ethereum": {"usd": 3421.50}}', "reject", 95, "wildly off from the live source")
    contract.adjudicate(task_id)

    task = contract.get_task(task_id)
    assert task.status == "rejected"


def test_adjudicate_without_submission_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    with direct_vm.expect_revert("Task has no pending report to adjudicate"):
        contract.adjudicate(task_id)


def test_adjudicate_by_third_party_allowed(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Anyone can trigger adjudicate() once a report exists - not just the
    requester or worker - so neither side can stall the other's payout."""
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    bob = to_hex(direct_bob)
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    direct_vm.sender = direct_bob
    contract.submit_deliverable(task_id, "3421.50")

    direct_vm.sender = direct_charlie
    _setup_verdict_mock(direct_vm, '{"ethereum": {"usd": 3421.50}}', "accept", 95, "matches")
    contract.adjudicate(task_id)

    assert contract.get_task(task_id).status == "accepted"


def test_get_tasks_by_requester_and_worker(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT)
    alice = to_hex(direct_alice)
    bob = to_hex(direct_bob)

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    task_id = contract.create_task(bob, SOURCE, "current ETH/USD price")

    requester_tasks = contract.get_tasks_by_requester(alice)
    worker_tasks = contract.get_tasks_by_worker(bob)

    assert len(requester_tasks) == 1
    assert requester_tasks[0].id == task_id
    assert len(worker_tasks) == 1
    assert worker_tasks[0].id == task_id


def test_get_all_tasks_empty(direct_deploy):
    contract = direct_deploy(CONTRACT)
    assert contract.get_all_tasks() == {}


def test_get_task_unknown_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    with direct_vm.expect_revert("Task not found"):
        contract.get_task("nonexistent")
