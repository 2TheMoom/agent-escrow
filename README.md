# AgentEscrow

## About
A GenLayer Intelligent Contract built for [Agent Tank](https://portal.genlayer.foundation/agent-tank),
GenLayer's hackathon for the agentic economy. One AI agent (the requester)
escrows payment for another named agent (the worker) to fetch and report a
specific, checkable fact from a neutral, third-party source - a live price
from a public API, a value from a block explorer, etc. GenLayer validators
independently re-fetch that same source and judge whether the worker's report
matches it before releasing payment, via the equivalence principle. Neither
side controls the verdict: a requester can't refuse to pay for a correct
report, and a worker can't get paid for a fabricated one.

The source has to come from a hardcoded allowlist of neutral domains
(currently CoinGecko, Coinbase, Etherscan), not a URL either party names
freely. Letting the worker pick the source after doing the work would let
them just point at a page they control; letting the requester name an
arbitrary URL has the same problem in the other direction - they could
tamper with it right before adjudication to dodge paying. Only a source
neither side controls makes the comparison meaningful.

There's no time-based deadline, because GenVM doesn't expose a deterministic
clock to contracts. Instead the requester can cancel and reclaim their
escrow at any time - but only while nothing has been submitted yet. Once a
worker submits a report, cancellation is blocked; the task must go through
`adjudicate()` and resolve to accepted or rejected, which pays out (or
refunds) automatically either way. There are no appeals: matching a reported
value against a live-fetched source is close to deterministic, unlike a
genuinely subjective judgment call, so a bad first verdict is unlikely
enough that appeal complexity isn't worth it here.

## Live deployment
Deployed and verified on **GenLayer Bradbury Testnet** (chain ID 4221):
- **Contract:** [`0x6a97D216888220D1B140e466f8Ad3A2586eD0DCC`](https://explorer-bradbury.genlayer.com/address/0x6a97D216888220D1B140e466f8Ad3A2586eD0DCC)
- Verified via 16 passing direct-mode tests (`pytest tests/direct/`), covering
  task creation, the allowlist check, cancellation guards, and both the
  accept and reject adjudication paths.
- Verified live end-to-end via `genlayer-js`: a task was created, a worker
  reported the real current ETH/USD price (fetched independently at test
  time), and `adjudicate()` correctly accepted it with genuinely
  tolerance-aware reasoning from the LLM: *"The reported value of 2477.51 is
  within a reasonable margin (0.15 difference) of the authoritative source
  value of 2477.66, accounting for normal price fluctuation."* - proving the
  judgment logic works exactly as designed, not just that it compiles.

### Known limitation: payouts don't currently land on Bradbury
The verdict logic is correct and verified (see above), but the actual value
transfer - `gl.get_contract_at(worker_or_requester).emit_transfer(value=...)`
- does not currently deliver funds on Bradbury. This is a confirmed GenLayer
platform bug, not a flaw in this contract's design: see
[genlayerlabs/genvm-manager#20](https://github.com/genlayerlabs/genvm-manager/issues/20),
where I contributed a minimal, zero-conditional-logic repro isolating the
issue to `emit_transfer` itself. On Bradbury specifically, the payout
transaction comes back `FINISHED_WITH_ERROR` with all 5 validators voting
`DISAGREE` with each other in a call with no possible business-logic branch
to disagree over - a sibling report on Asimov shows the same underlying
failure with a different symptom (a silent no-op instead of an error). The
likely root cause, per that thread, is in the closed-source validator node
binary's on-chain message-dispatch path, not in GenVM itself or in contract
code following GenLayer's own documented pattern (this contract's payout
code is structurally identical to GenLayer Studio's own `faucet.py` example).

Every other part of the flow - escrow creation, the neutral-source
allowlist, cancellation, deliverable submission, and the LLM-adjudicated
verdict itself, including the actual funds-transfer *code path executing
without error up to the point of dispatch* - works and is verified above.

## What's included
- `contracts/agent_escrow.py` — the AgentEscrow Intelligent Contract
- `tests/direct/test_agent_escrow.py` — direct-mode tests (in-memory, mocked web/LLM)
- **Contract linting** — static analysis to catch common contract issues before deployment
- **CI pipeline** — GitHub Actions workflow for linting and direct tests
- A Next.js 15 frontend (TypeScript, TanStack Query, Radix UI) wired to
  AgentEscrow — create tasks, submit deliverables, and trigger adjudication
- Configuration file template and deployment scripts

## Requirements
- Python >= 3.12
- [GenLayer CLI](https://github.com/genlayerlabs/genlayer-cli) globally installed: `npm install -g genlayer`
- GenLayer Studio (for integration tests and deployment): Install from [Docs](https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup#using-the-genlayer-studio) or use the hosted [GenLayer Studio](https://studio.genlayer.com/)

## Project Structure

```
contracts/              # Python intelligent contracts
  agent_escrow.py        # AgentEscrow
  football_bets.py       # Kept from the GenLayer boilerplate as an SDK-pattern reference
tests/
  direct/                # Fast in-memory tests (no Studio required)
    test_agent_escrow.py
frontend/                # Next.js 15 app (TypeScript, TanStack Query, Radix UI)
deploy/                  # TypeScript deployment scripts
gltest.config.yaml       # Test runner network configuration
pyproject.toml           # Python/pytest configuration
.github/workflows/       # CI pipeline
```

## Quick Start

### 1. Set up Python environment

```shell
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Lint the contract

```shell
genvm-lint check contracts/agent_escrow.py
```

### 3. Run direct mode tests

```shell
pytest tests/direct/ -v
```

### 4. Deploy the contract

1. Choose your network: `genlayer network`
2. Deploy: `genlayer deploy` (runs the script in `/deploy/deployScript.ts`)

### 5. Set up the frontend

1. Copy `frontend/.env.example` to `frontend/.env`
2. Add your deployed contract address as `NEXT_PUBLIC_CONTRACT_ADDRESS`
3. Run:

```shell
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:3000/.

## How AgentEscrow Works

1. **`create_task(worker, source_url, fact_description)`** — payable; the
   requester escrows this transaction's value for a specific named worker to
   report `fact_description` as found at `source_url`. Fails if `source_url`
   isn't on the neutral-source allowlist. Returns a `task_id`.
2. **`cancel_task(task_id)`** — the requester only, and only while the task
   is still `open` (nothing submitted), refunds the full escrow.
3. **`submit_deliverable(task_id, reported_value)`** — the named worker only,
   once per task, reports the value they found at the source.
4. **`adjudicate(task_id)`** — callable by anyone, not just the requester or
   worker, once a report exists, so neither side can stall the other's
   payout. Fetches `source_url` live, asks an LLM whether the reported value
   plausibly matches it (allowing reasonable margin for values that
   naturally fluctuate), and reaches multi-validator consensus via the
   leader/validator equivalence-principle pattern. Sets `status` to
   `accepted` (pays the worker) or `rejected` (refunds the requester).
5. **`get_task` / `get_tasks_by_requester` / `get_tasks_by_worker` /
   `get_all_tasks`** — read back tasks and verdicts.

## Testing Strategy

| Test Type | Command | Speed | Requires Studio |
|-----------|---------|-------|-----------------|
| **Lint** | `genvm-lint check contracts/agent_escrow.py` | ~250ms | No |
| **Direct** | `pytest tests/direct/ -v` | ~ms/test | No |

## Community
- **[Discord](https://discord.gg/8Jm4v89VAu)**: Discussions, support, and announcements
- **[Telegram](https://t.me/genlayer)**: Informal chats and quick updates

## Documentation
For detailed information, see our [documentation](https://docs.genlayer.com/).

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
