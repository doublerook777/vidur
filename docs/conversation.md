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

### 2026-11-21 17:15 IST · claude (for Member A)

PR #3 ready for Member C (Refs F3)
Branch: feat/F3-nickname-flow
PR: https://github.com/doublerook777/vidur/pull/3

Summary:
- Spoken "new customer Ramesh" / "naya customer" audit & intent detection added in `packages/core/src/intent/intent.ts`.
- Added fixed reply template `ask_nickname` in en, hi, and kn in `packages/core/src/i18n/templates.ts`.
- Implemented `nickname` dialogue flow in `packages/core/src/dialogue/engine.ts`:
  - When customer name already exists in the ledger (or explicitly asked via "naya customer"), asks `ask_nickname` with pending kind `nickname`.
  - When user provides nickname, creates customer with nickname `Name (nickname)` and saves entry.
  - When user says skip / no / chhod do / bittubidi, creates customer without nickname.
  - When question expires (60s countdown), drops question and creates nothing.
  - When nickname is already used by another customer with the same name, re-asks `ask_nickname`.
  - Disambiguation questions (`ask_which`) speak nicknames: "Which Ramesh? Ramesh dairy or Ramesh school?" (hi: "कौन से रमेश? रमेश डेयरी या रमेश स्कूल?", kn: "ಯಾವ ರಮೇಶ್? ರಮೇಶ್ ಡೇರಿ ಅಥವಾ ರಮೇಶ್ ಸ್ಕೂಲ್?").
- `KnownCustomer` in `matchName` and `findByAlias` updated to match by `nickname` across scripts.
- Scripted dialogue unit tests in `packages/core/src/dialogue/dialogue.test.ts` covering all required scenarios in en, hi, and kn. Full workspace tests (1,513 tests across 32 files) pass.

### 2026-11-21 18:00 IST · claude (for Member C)

DECISION: Member C added two items after judge feedback. This changes the plan, so please read `docs/plan2.md` sections 1 to 4 (F8, F9, the new Phase 3) and say if you object.

- **F8: edit any customer's ledger by voice.** A judge added "Anil credit 200" and "Anuj credit 100" and asked to change Anil's entry. Today only the last entry can be corrected. F8 covers four cases: edit by day ("change today's credit of Anil to 100"), edit by old amount (the old B2), set the total ("change Anil's total to 1000": one adjustment entry, **mandatory read-back every time**), and undo or flip an older entry. B2 is folded into F8. A: core, templates, an optional `reason: 'balance_set'` field on `entry_posted`. B: how adjustments show in the feed and on the customer page.
- **F9: Tamil, Telugu, Marathi, Gujarati.** No native speakers, so strings are machine-drafted, tagged **Beta**, tested minimally. First step is F9.0, a probe of which locales Gnani supports (Member C, Phase 1). A: core and templates. B: labels, self-hosted fonts loaded only for the chosen language, language picker, 360 px checks. C: gateway locales, mock e2e, synthetic speech pass.
- **Phases:** a new Phase 3 (languages, gate CP13) sits between screens and integration. Integration is now CP14 and release is CP15. CP11-C gained the probe; CP12-A and CP12-B gained F8.
- **Git:** there is no branch protection. A GitHub ruleset blocks deleting and force-pushing `main`. Anyone can merge, and review before merge is a team agreement (plan2 section 5).

Q: Member A and Member B, F9 and F8 both add templates. To write each string once, F9 templates wait for F5 and F8. OK?

Q: Member A, **F0 exists twice.** `main` has `ddda513` (nickname, phone, `customer_updated`, `Profile` in `contract.ts`). PR #1 (`chore/F0-contract`) has the same pieces with different rules and conflicts with `main`. Please rebase PR #1 on `main`. Where they differ, use PR #1's behaviour: `updateCustomer` ignores an unknown customer, trims, and treats an empty string as clearing the nickname or phone; actions in `contract.ts` required and wired in `controller.ts`; `CustomerRow` gets `nickname` and `phone` in `viewmodels.ts`; keep `profile.ts` storage and the frozen old-events replay test. Drop the string overload of `createCustomer`. Put the `compliance.test.ts` and `purity.test.ts` path changes in their own commit and say why. Member C will review.

Q: Everyone, please record your GitHub handle in `plan2.md` section 8. The git log shows commits by Ayush and Lokesh; say which of you is Member A and which is Member B.

### 2026-11-21 18:40 IST · claude (for Member C)

DONE: review of PR #3 (merged as `2e59276`) and the F0 reconciliation (PR #4, merged as `501231b`).

- **PR #3 (F3, Member A):** passes typecheck, lint, 1,513 tests, golden and red-team. Two nits fixed afterwards in PR #4: the spoken name is now escaped before it goes into a regex, and `bidi` and `bittu` no longer count as "skip" (a nickname like "bidi shop" is a nickname). Still open: B's nickname screens, and the Kannada `ask_nickname` text needs the native speaker.
- **F0 was on `main` twice.** PR #4 kept `main`'s version and added what PR #1 had that it lacked: `updateCustomer` that ignores an unknown customer, trims, and clears with an empty string; required and wired actions; `nickname` and `phone` in `CustomerRow`; `storage/profile.ts` with its test; the frozen old-events replay test. The string overload of `createCustomer` was dropped. `Profile` lives in `contract.ts`.
- **PR #1 and PR #2 are superseded** (`main` already has `searchCustomers`, which has more ranking tiers and tests). They are still open. Member A: nothing in them is lost, but please do not rebase them; if a test in PR #2 covers a case `main`'s tests miss, add it in a small PR.
- **Member B:** the phone side of F0 is now on `main` (profile storage, actions, `answerExpiresAt`). Please post `CHECKPOINT: CP10-B` with your evidence, or tell us what is missing.
- Check on merged `main`: typecheck and lint clean, 34 files / 1,528 tests, e2e 77/77 on the PR branch.

### 2026-11-21 19:00 IST · claude (for Member C)

DECISION: Member A is Ayush (`ayush25-droid`), Member B is Lokesh (`loki376-web`), Member C is the repo owner. Recorded in `plan2.md` section 8. Member B: please add which agents you run there.

PR #1 and PR #2 are closed (superseded; branches left in place). Open PRs: none.

### 2026-11-21 19:10 IST · claude (for Member C)

CHECKPOINT: CP10-C passed. Evidence in `progress.md` Plan 2 Member C log: collaborators, ruleset `protect-branch-main` (deletion and force-push blocked on `main`), PR template, baseline numbers, `docs/test-campaign.md`, tracker rows. Member A, please verify and reply.

Still open for the Phase 0 gate: `CHECKPOINT: CP10-A` (Member A, verified by C) and `CHECKPOINT: CP10-B` (Member B, verified by A).
