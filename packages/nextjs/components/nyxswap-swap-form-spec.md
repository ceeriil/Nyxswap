# NyxSwap — Trade / Swap Form Spec

Stack: Tailwind + park ui  for all visual components. scaffold-eth hooks (`useScaffoldContractRead`, `useScaffoldContractWrite`, `useBalance`, `Address`, RainbowKit connect button) for wallet/on-chain plumbing. use daisy ui if neccessary we already have some existing componetn from scaffold eth too 

Reference: Panther's zSwap form (Send/Receive, slippage, price impact, ratio, fee breakdown) is the correct base — this is a real AMM with visible reserves, so those fields are accurate for you, unlike the earlier order-book design. Adapt, don't reinvent.

---

## Components

**Token pair row (Send)**
- Amount input, numeric, tied to shadcn `Input`
- Token select dropdown (icon + symbol + chevron) — must include FXRP as a listed pair, not an afterthought
- USD estimate under the input — this is now legitimate (FTSO gives you a real feed), not a placeholder like it would've been without an oracle
- Wallet balance for selected token — pull from scaffold-eth `useBalance`, not a manual fetch

**Swap direction toggle**
- Icon button between Send/Receive that flips which token is in vs. out (same pattern as Panther's down-arrow between the two cards)

**Token pair row (Receive)**
- Same shape as Send, output side, non-editable amount (computed)

**Swap settings**
- Slippage tolerance: Auto / 0.1% / 0.5% / 1% / Custom — shadcn `Toggle Group`
- Transaction deadline — text input, default prefilled (e.g. 20 min)

**Trade details (expandable or always-visible breakdown)**
- Price impact — computed from constant-product formula against current reserves
- **FTSO reference price vs. implied execution price** — new field, not in Panther's version at all. Show both numbers and a deviation percentage; flag/warn state if deviation crosses a threshold. This is the one field that visibly justifies "why Flare" in the actual trading UI, not just the landing page — don't bury it in an expandable section, keep it visible by default.
- Minimum received
- Swap fee (LP/protocol fee — distinct from FTSO, distinct from gas)
- Ratio

**Privacy indicator**
- Small persistent badge/tooltip near the submit button — something like a shield/lock icon with a tooltip explaining the swap is routed through FCC and hidden until settlement. This is the one place in the actual product (not just marketing copy) where the privacy claim needs to be visible at the moment it matters to the user.

**Submit button — state machine, not a single static button**
1. Enter Amount (disabled)
2. Approve [Token] (if allowance insufficient — standard ERC20 two-step, same issue flagged earlier for Vault deposit)
3. Swap
4. Confirming — swap submitted to the enclave, waiting on settlement
5. Settled / Failed

---

## Explicit cuts from Panther's version

- **Download Circuits** — no client-side ZK proving in this architecture, cut entirely.
- **Bundler YES/NO** — deliberately not included here; see open question below.

---

## Open architecture question — do not guess past this

Whether a **Bundler toggle belongs on the swap form itself** depends on something not yet decided: does swap settlement have its own on-chain leg (reserves checkpointed on-chain after each swap) the way withdrawal does, or does the swap only touch an internal TEE ledger with the on-chain leg deferred to withdrawal? If there's a separate broadcastable on-chain settlement step per swap, a gas-sponsorship/bundler toggle could apply here too, same pattern as withdrawal. If not, it doesn't belong on this form at all. Don't build this toggle into the swap form until that's resolved — flag it to whoever owns the vault contract design before Claude Code wires it up.