# Porting notes: fce-orderbook → Nyx Swap

Context for whoever (human or Claude) is porting pieces of this frontend into
Nyx Swap. This captures the *why* behind the code — the frontend files alone
don't explain the FCC/TEE architecture they're built against, and a lot of
this was hard-won through live debugging, not obvious from reading the repo.

## The core model: deposit-first balance, not wallet-direct

Swaps (like this repo's orders) operate on a balance held **inside the TEE's
memory**, not the user's wallet balance directly. The flow is:

1. User deposits ERC20 tokens into an on-chain vault contract (`InstructionSender.sol`
   here). This is a real on-chain tx.
2. The vault emits a `DEPOSIT` instruction; Flare's data-provider consensus
   relays it to the TEE, which credits an internal (off-chain, in-memory)
   balance for that user.
3. Trading (placing orders / here; swaps in Nyx) is a **direct action** —
   HTTP straight to the TEE proxy, no on-chain tx, no gas, instant. It reads
   and mutates the in-memory balance.
4. Withdrawing is the reverse: an on-chain `withdraw()` request → TEE signs
   an authorization → user submits `executeWithdrawal()` with that signature.

**Why this matters for Nyx Swap:** this is what makes the darkpool actually
private and MEV-free. If swaps touched the wallet balance directly, every
swap would be its own on-chain tx with visible amounts — no privacy, plus
gas and front-running exposure on every trade. The deposit is the only
"visible" on-chain moment; the swap logic itself runs privately in the TEE.

## Frontend pieces worth porting (patterns, not just files)

All under `frontend/src/`:

- **`lib/teeClient.ts`** — the actual client for talking to the TEE proxy.
  POSTs to `/direct` with `{opType, opCommand, message}` (all as hex), then
  polls `GET /action/result/{id}` until the result lands. This is the piece
  Nyx Swap needs most directly — same shape works for swap instructions,
  just with different `opCommand` values and message payloads.
- **`vite.config.ts`** — dev-server proxy trick: `/direct`, `/state`,
  `/action` are proxied server-side to `VITE_PROXY_UPSTREAM`, so the browser
  only ever sees same-origin requests. Avoids CORS entirely. Worth copying
  verbatim.
- **`scripts/sync-config.ts`** (run as a `predev`/`prebuild` npm hook) —
  reads the backend's deployed contract addresses / extension ID / ABI and
  writes `src/config/generated.ts`. Keeps the frontend from ever pointing at
  a stale deployment. **Must be re-run after every redeploy** or the UI
  drives the previous contracts — this bit me repeatedly this session.
- **Faucet button** — trivial: calls `mint()` on the test token contract,
  gated behind `VITE_SHOW_FAUCET`. Not worth over-thinking, just port as-is
  and point it at Nyx's own test tokens.
- **Deposit/withdraw UI flow** (wherever it lives in `src/components/` or
  `src/pages/`) — the two-step approve→deposit pattern, and the
  request→sign→execute withdraw pattern. Directly reusable shape for Nyx.

## What NOT to port

The actual matching engine (`internal/extension/` — price-time priority,
order book, order matching) is orderbook-specific business logic. Nyx Swap
needs AMM/swap math instead — different core logic entirely, same
surrounding infrastructure (wallet connect, TEE client, deposit/withdraw,
config sync).

## Byte-encoding gotcha (will bite you immediately if skipped)

`opType`/`opCommand` are `bytes32`, and the TEE's Go code does **exact byte
comparison** against expected values. They must be **null-byte padded**
(`0x00`), not space-padded. This repo's own `docs/testing.md` example script
pads with spaces and is subtly wrong — I hit this directly:

```python
# correct
'0x' + "ORDERBOOK".encode().ljust(32, b'\0').hex()

# wrong — looks fine, silently produces a rejected op type
printf "%-32s" "ORDERBOOK" | xxd -p   # pads with spaces (0x20), not null (0x00)
```

## Infra gotchas from this session (mostly FCC-generic, not orderbook-specific)

These apply to any FCC/TEE-based app, so likely relevant to Nyx Swap's own
backend setup too:

- **TEE keypair is randomly generated on every process restart** — no
  persistence. A restart wipes all in-memory balances/orders and mints a new
  TEE identity that has to be re-registered on-chain.
- **`setTeeAddress()` on the vault is one-shot** — once set, it's locked to
  whatever TEE key was active at the time. If the TEE restarts (new key),
  withdrawals break *permanently* on that vault — the only fix is deploying
  a fresh vault contract. Do all TEE restarts *before* running that step,
  never after.
- **A TEE machine must be "active" on-chain** before deposits/swaps work —
  `InstructionSender._sendInstruction()` calls
  `TeeMachineRegistry.getRandomTeeIds(extensionId, 1)`, which reverts with a
  custom error `TooMany()` if zero machines are active for that extension.
- **The TEE registration's availability check needs real public
  reachability** — Flare's data providers must be able to reach the proxy
  from the outside internet to complete registration. `localhost` doesn't
  work; needs an actual tunnel (ngrok worked reliably here — Docker
  `cloudflared` failed to establish a QUIC/UDP connection on this network).
- **Re-running the registration tool after a machine is already registered
  skips re-submitting its URL** — so if you registered once against
  `localhost` before a tunnel existed, subsequent runs won't fix the URL.
  Call `updateTeeMachineSettings(teeId, teeProxyId, newUrl)` on the
  `FlareTeeManager` contract directly to fix it in place.
- **Two active machines for one extension = ~50% of on-chain instructions
  silently routed to a dead node.** If a TEE restarts, the *old* machine
  stays "active" on-chain until explicitly paused:
  `FlareTeeManager.pause(staleTeeId)` (owner-only).
- Config/pairs files loaded via relative paths can silently fail if the
  process's working directory doesn't match assumptions — worth an absolute
  path env var override rather than debugging cwd issues blind.

## Current known-good reference state (fce-orderbook, Coston2)

If you want to see this actually working end-to-end as a reference while
building Nyx Swap:
- Vault: `0x7c4Fa454df47F320277F81579DAdAda4f8A6824f`
- Extension ID: `66103` (`0x10237`)
- Frontend: `cd frontend && npm run dev` → `http://localhost:5173`
- Backend: `./scripts/start-services.sh --chain coston2 --local`, then
  `./scripts/post-build.sh` and `./scripts/extension-post-setup.sh` if
  starting fresh (see this repo's `docs/getting-started.md` and
  `docs/deployment-steps.md` for the full sequence — both are accurate,
  just assume a full Flare monorepo checkout that this extracted repo
  doesn't have, so `--local` mode and a real public tunnel are required
  workarounds, not in the docs as written).
