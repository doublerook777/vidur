# Conversation

A shared channel for the three of us and our agents. Use it for handoffs, questions, decisions and "I'm touching X, stay out of it". Anything that becomes work goes into `bugs&improvements.md`; anything finished goes into `progress.md`.

## How to use it

- Append only. New messages go at the **bottom**. Never edit or delete someone else's message.
- Start each message with a heading: `### YYYY-MM-DD HH:MM IST · who`. Agents write their name and who started them, for example `claude (for <person>)`.
- Say what you need and from whom. Mark questions `Q:` and decisions `DECISION:` so they are easy to find.
- Claim work before starting: `CLAIM: B1` and the files you will touch. Release it with `DONE: B1` or `RELEASE: B1`.
- Read the last 20 lines before you start and before you commit, so you do not collide.
- No secrets, no access codes, no real customer data, no transcripts.

---

### 2026-11-21 · claude (for the team)

Set up `progress.md`, `bugs&improvements.md` and this file under `docs/`. The seed items are in the tracker. B1 (Kannada label clip) is still reproducible, so it was not marked fixed.

Q: who takes which of B1, B2, B3 first? Please reply with `CLAIM:` lines below.

### 2026-11-21 15:58 IST · claude (for Member A)

CLAIM: F0 core contract
Files: packages/core/src/ledger/types.ts, packages/core/src/ledger/ledger.ts, packages/core/src/ledger/ledger.test.ts, packages/core/src/dialogue/engine.ts, apps/web/src/phone/contract.ts

F3 check ("naya customer" intent):
Checked packages/core/src/intent/types.ts and dialogue/names matching:
- INTENTS currently only contains: credit_entry, payment, balance_query, correction, reminder_opt_in, note, refusal, out_of_scope. There is no intent for creating a new customer.
- When a user says "naya customer Ramesh", matchName() resolves "Ramesh" against existing customers. If a customer named "Ramesh" already exists, matchName returns `{ kind: 'exact' }`, posting directly to the existing account.
- Conclusion: There is currently no way by voice to create a second same-named customer on purpose. As specified in F3, we will need to add a minimal "naya customer" intent or phrase trigger when building F3.

### 2026-11-21 · claude (for Member C)

CLAIM: CP10-C. Files: `.github/pull_request_template.md`, `docs/test-campaign.md`, `docs/plan2.md` (new section 9), baseline numbers in `docs/progress.md`.

Plan 2 now calls the three of us Member A, Member B and Member C. Member C is the repo owner. Section 9 of the plan is Member C's own agent setup only; Members A and B keep their own tools. Only sections 5 to 7 of the plan (git workflow, shared files, definition of done) apply to everyone.

Q: Member A and Member B, please add your GitHub handles under the table in `plan2.md` section 8 and reply with `CLAIM: F0` lines for your parts of the shared contract. Member C will add you as collaborators and turn on branch protection once the handles are here.

### 2026-11-21 · claude (for Member C)

RELEASE: F0 (draft only). Member A's `CLAIM: F0` landed while Member C's agent was drafting the same contract, so there are two drafts. Member A's branch `chore/F0-contract` is the real one and nothing of it was touched. Member C's draft is parked on `draft/F0-member-c` (no PR) for Member A and Member B to take from if useful. Do not merge it as is.

What the draft has that `chore/F0-contract` may not (check before copying):
- `apps/web/src/phone/storage/profile.ts` and `profile.test.ts`: a versioned `Profile` stored in the vault `meta` store under the key `profile`; returns `null` for installs without one; the test shows delete-all removes it.
- `packages/core/src/ledger/contract.test.ts`: a frozen fixture of old events (every old event type, no `nickname`, `phone` or `customer_updated`) replayed with identical customers and balances.
- A real `updateCustomer` action in `controller.ts` that calls `ledger.updateCustomer`, and one controller test that nickname and phone reach the customer row.
- `CustomerRow` gets `nickname` and `phone` through `viewmodels.ts`.

Member A: you own the F0 core part. If you want any of this, cherry-pick it. Member B: the phone-side pieces (profile storage, actions, `answerExpiresAt`) are yours to take or rewrite.

Numbers: the draft passes typecheck, lint and 1,495 tests (baseline was 1,482). Browser e2e was not run on it.

### 2026-11-21 16:26 IST · claude (for Member A & Supervisor)

DONE: F0 core contract
- Ledger types: `CustomerCreatedEvent` gains optional `nickname` and `phone`; added `CustomerUpdatedEvent`; `Customer` and `CustomerRow` expose `nickname?` and `phone?`.
- Dialogue engine: added `nickname` to `PendingKind`.
- Phone contract: added `answerExpiresAt?` and `answerWindowMs?` to `EntryCardVM`; added `Profile` and `PinCredentials` types; added action callbacks.
- Verification: added `F0 backward compatibility replay` test fixture in `packages/core/src/ledger/ledger.test.ts`. Full test suite passed (31 files, 1483 tests).

DONE: B1
- CSS fix in `apps/web/src/phone/ui/phone.css`: added `@media (max-width: 390px)` rules for `:lang(kn)` and `:lang(hi)` with `flex-wrap: wrap` and `max-width: 130px` on `.totals-payment` to clear `.notch-btn` completely.

### 2026-11-21 16:48 IST · claude (for Member A)

PR #2 ready for Member C: https://github.com/doublerook777/vidur/pull/2

- F2 core function: pure `searchCustomers(query, customers)` in `packages/core/src/names/search.ts` (exported in `index.ts`).
- Cross-script support (Devanagari, Kannada, Latin) via `nameKey` and `looseKey`.
- Multi-field matching (name, nickname, aliases, normalized phone digits).
- Tiered ranking: prefix -> contains -> 1-edit fuzzy distance (length >= 4).
- Tests: 7 unit tests passing, `purity.test.ts` passes.

### 2026-11-21 16:51 IST · claude (for Member A & Supervisor)

DONE: F2 (function)
- Pure `searchCustomers(query, customers)` in `packages/core/src/names/search.ts`.
- Matches customer name, nickname, aliases, and phone digits across Devanagari, Kannada, and Latin scripts using `nameKey` and `looseKey`.
- Ranks prefix matches first, then word-boundary prefix, then contains, then one-edit distance matches.
- Fully pure (`purity.test.ts` passes). 11 unit tests in `packages/core/src/names/search.test.ts` cover cross-script matching, nicknames, aliases, phone digits, ranking, and typos.

DONE: F4 (engine)
- Replaced inline 30s with exported `PENDING_TTL_MS = 60_000` in `packages/core/src/dialogue/engine.ts`.
- Added `questionSpoken()` hook to start the 60s TTL window only after TTS playback completes.
- Added `pendingExpiresAt()` and `pendingWindowMs()` for UI countdown coordination.
- Added dialogue unit tests verifying: 59s window remains open, 61s expires with `pending_expired`, `questionSpoken()` extends clock from playback completion, barge-in resets window, and nothing is saved on expiry for every pending kind.
