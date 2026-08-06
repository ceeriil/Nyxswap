# NyxSwap — Session Build Brief

This supersedes earlier assumptions in this repo. Read this before touching `nyxswap-landing-copy.md` or `nyxswap-swap-form-spec.md` — both have been corrected to match what's below, but this file is the source of truth for the architecture itself.

---

## What NyxSwap actually is

A confidential-execution AMM on Flare Confidential Compute (FCC) — **not** an order book, **not** a hidden-liquidity dark pool.

- **Liquidity:** public LPs deposit into the pool (dual-asset, standard AMM style), not a single market-maker-seeded pool.
- **Execution:** instant, continuous constant-product swaps. No batching, no periodic rounds.
- **What's private:** only the pending swap itself (direction, amount, trader) before it settles — routed through the TEE, never touching a public mempool. This is a real, legitimate MEV/front-running fix.
- **What's NOT private:** pool reserves and depth. Anyone can see the pool's state at any time, same as any public AMM. Don't let copy, UI, or code imply hidden liquidity — that's a different product than what this is.

No Flare Foundation reference implementation exists for this (only `flare-foundation/fce-orderbook` exists, and it's a CLOB) — this is a from-scratch FCC extension. The generic FCC pattern still applies: on-chain instruction in (deposit/withdraw), off-chain direct action in (now `SWAP` instead of `PLACE_ORDER`), TEE-signed authorization out for withdrawals. The swap-matching/pricing logic itself has no reference to copy.

## Flare-specific integration — the actual "why Flare" answer

- **FXRP is a listed pair from day one**, not an afterthought. Touches the ecosystem's stated FAssets/XRP priority without building FAssets infra yourself.
- **FTSO is a real deviation check, not a UI decoration.** Compare each swap's implied execution price against the live FTSO feed; flag/reject on excessive deviation. This is the concrete, functional reason the product needed Flare specifically — lead with this in the pitch, not with "dark pool."
- **FDC** — deliberately not used. No concrete reason to attest external data for this product; forcing it in reads as box-checking.

## Bounty framing

Targeting Bounty 2 (Confidential Compute Apps). The honest justification: the sensitive input is the pending swap's details, the output (reserves, withdrawal authorization) still needs to be on-chain-usable — that's an exact match to the bounty's own language. Do **not** claim the AMM math itself needs confidential compute — constant-product pricing runs fine in a normal contract and a technical judge will know that. The real answer to "why not just use a private RPC/MEV-protect endpoint instead of all this" is: those are trust-me black boxes (the operator sees your order, you take their word), while FCC's attestation means the code processing your swap has a hash registered on-chain — trust-the-attestation, not trust-the-operator.

---

## Nav (5 items)

| Page | Contents |
|---|---|
| **Trade** | Swap form — see `nyxswap-swap-form-spec.md` |
| **Vault** | Deposit (dual-asset LP) / Withdraw — Uniswap-style Add Liquidity shape, not Panther's single-token deposit |
| **History** | Two tabs: **My Swaps** (personal) / **Pool Activity** (public, all settled swaps) |
| **Verify** | TEE code hash, attestation report, link to on-chain measurement registry |
| **Proofs** | Post-settlement compliance-proof generator — prove a swap met a rule (size threshold, cleared counterparty) without revealing it |

No Dashboard, no Rewards/Staking/Vouchers tabs from Panther's nav — out of scope for this product.

---

## Frontend stack

- Tailwind (kept) + scaffold-eth (wallet connect, `useBalance`, `useScaffoldContractRead/Write`, address display) etc
- **DaisyUI and shadcn/ui are both rejected** — DaisyUI's opinionated theme fights the custom dark/bold visual identity already built; shadcn is functionally fine but too visually common for this product.
- **Still open, needs a final pick before Claude Code scaffolds components:** either (a) **Park UI** (Ark UI/Zag.js primitives + Panda CSS — more complete components out of the box, e.g. Combobox/Carousel, much less common visually than shadcn) which means running Panda CSS alongside Tailwind, or (b) **hand-rolled components on raw Radix + Tailwind** — same accessible primitives shadcn uses, but no registry, no default theme, no second styling system to maintain. Leaning toward (b) given the existing Tailwind/scaffold-eth commitment, but this hasn't been confirmed — don't scaffold components until it is.

---

## Unresolved architecture questions — do not let Claude Code guess past these

1. **LP share representation:** internal TEE ledger entry (mirrors the simpler proven pattern) vs. an on-chain-minted LP ERC20 (composability, more complexity). Leaning ledger-only for hackathon scope, not confirmed.
2. **Does a swap have its own on-chain settlement leg**, or does it only update the TEE's internal ledger with on-chain settlement deferred to withdrawal? This determines whether a Bundler/gas-sponsorship toggle belongs on the Trade page (like it does on Withdraw) or not at all. Not yet decided — the swap form spec deliberately leaves this toggle out pending this answer.
3. **Compliance gating:** if you want the "KYC required / not on allowlist" state mentioned in the Vault critique, that needs an actual policy decision (is KYC gating on for this product at all), not just a UI toggle.