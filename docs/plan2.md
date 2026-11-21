# Plan 2

Implementation plan for the next round of Vidur work, split between three people and their agents. Read `CLAUDE.md` first: its load-bearing rules (integer paise, fixed reply templates, nothing stored on the server, no transcripts in logs, opt-in reminders) apply to everything below.

Companion files, all in `docs/`:

| File | Use |
|---|---|
| `bugs&improvements.md` | The tracker. One row per bug or improvement, with an owner. |
| `progress.md` | What is done, checkpoints, credit log. |
| `conversation.md` | Messages between the three of us and our agents. Claims, handoffs, questions. |

## 1. Decisions already made

| Topic | Decision |
|---|---|
| Sign-up and profiles | **Local profile only.** Stored encrypted on the phone. No accounts, no login server, no sync. The "server stores nothing" promise stays. |
| Reminders and WhatsApp | **The app prepares the message and opens WhatsApp; the shopkeeper taps send.** Opt-in per customer, balance due, at most one per 7 days: all unchanged. No WhatsApp Business API, no scheduled server sends. |
| "More training samples" | **Manual testing.** Nothing is trained. We test by hand, find where it fails, fix it, and add the failed line to the golden, held-out or red-team set so it stays fixed. |
| Deployment | **Stay on Render's free plan.** Revisit hosting once everything else is done. |
| Yes/no window | Raise from 30 s to **60 s**, counted from when the question has finished being spoken. |
| Same name already exists | **Ask for a nickname** (for example "Ramesh (dairy)"). The shopkeeper may skip it. |
| Voiced customer summary | **Fixed-template** line built from facts in the ledger. Never model-generated. |

Assumption to confirm: "include 1 2 3 all" was read as "accept the defaults proposed for all three of the yes/no window, nickname and summary". If the summary should say more than the facts in section 3.5, say so in `conversation.md` before Person A starts F5.

Parked, not in this plan: accounts and server-side sync, WhatsApp Business API, encrypted export and import (tracker I1), installable app (PWA), paid hosting.

## 2. Work packages

| ID | What | Owner | Reviewer |
|---|---|---|---|
| F0 | Shared contract: types and events everyone builds on | A + B | C |
| F1 | First-time sign-up and profile management | B | C |
| F2 | Search across all customers | A (function), B (screen) | C |
| F3 | Same name already exists: ask for a nickname | A (flow), B (screens) | C |
| F4 | Longer yes/no window with a visible countdown | A (engine), B (countdown) | C |
| F5 | Voiced base summary for each customer | A (intent, template), B (button) | C |
| F6 | WhatsApp reminders | B | A |
| F7 | Manual test campaign and fixes ("more samples") | C, with fixes routed to A or B | A + B |
| B1 | Kannada "paid today" label clipped behind Add entry | B | C |
| B2 | Corrections reach older entries, not only the last | A | C |
| B3 | Long speech: press cap and a wait that scales | C | A |

Reviewers rotate so nobody reviews their own work: A is reviewed by C, B by C and A, C by A. Compliance-sensitive changes (dialogue, templates, reminders, logging) always need a second pair of eyes.

### Who owns which files

Keep to these to avoid merge conflicts. If you need to change a file outside your area, post a `CLAIM:` in `conversation.md` first, or ask the owner to make the change.

| Person | Area | Files |
|---|---|---|
| **A: core and dialogue** | The brain | `packages/core/**` (engine, intent, names, ledger, i18n templates, reminders gate), `eval/golden/**`, `eval/redteam/**` |
| **B: phone app** | Screens, storage, session | `apps/web/src/phone/**` (ui, session, storage, contract), `apps/web/src/showcase/**` |
| **C: quality and gateway** | Tests, server, deployment | `apps/server/**`, `e2e/**`, `eval/corpus/**`, `eval/score/**`, `scripts/**`, `.github/**`, `render.yaml`, `Dockerfile` |

Shared hot spots, where two people will often edit: `apps/web/src/phone/contract.ts`, `apps/web/src/phone/ui/labels.ts`, `packages/core/src/i18n/templates.ts`, `apps/web/src/phone/session/controller.ts`. Rules for those: edit in small PRs, merge them fast, add your strings in a block under your own comment header (`// F3 nickname`), and rebase before opening a PR.

## 3. Specifications

### F0: shared contract (Phase 0, do this first)

Goal: A and B can work in parallel for the rest of the plan.

1. Ledger events in `packages/core/src/ledger/types.ts`, all new fields **optional** so old stored events still replay:
   - `CustomerCreatedEvent` gains `nickname?: string` and `phone?: string`.
   - New event `customer_updated` with `customerId` and any of `name`, `nickname`, `phone`. Edits are events, because the ledger is event-sourced.
   - The `Customer` read model and `CustomerRow` (in `contract.ts`) expose `nickname?` and `phone?`.
2. Profile stored in the vault's `meta` store under key `profile`, separate from today's `settings` key: `{ version: 1, ownerName, shopName, createdAt, pin?: { salt, hash, iterations } }`. Old installs have no `profile`; treat that as "profile incomplete", never as an error.
3. New actions in `contract.ts`: `saveProfile`, `setPin`, `clearPin`, `unlock`, `updateCustomer`, `remindOnWhatsApp`, `speakSummary`.
4. View model fields: `EntryCardVM.answerExpiresAt?: number` (epoch ms, for the countdown) and `answerWindowMs?: number`.
5. Dialogue: new `PendingKind` value `nickname`.

Done when: types compile, `npm run typecheck` passes, a ledger test replays a fixture of **old** events (no nickname, no phone, no `customer_updated`) with identical balances, and the PR is merged to `main`. Everyone rebases on it before starting F1 to F6.

### F1: first-time sign-up and profile management (B)

Local only. No accounts.

- **First run:** language, then the AI disclosure and the "encrypted on this phone" note (existing), then **profile**: shop name (required), owner name (required), then **PIN** (optional, 4 to 6 digits, can be skipped and set later).
- **Existing installs** (already onboarded, no profile): skip the full flow, show a one-time "Complete your profile" card on Home. Never block use.
- **Profile screen** (under Settings): edit shop name and owner name, language and theme (existing), set, change or remove the PIN, delete all data (existing, keep the confirmation).
- **PIN:** salted PBKDF2 (WebCrypto, at least 200,000 iterations), only salt and hash stored. Lock screen on open and after 5 minutes in the background. Five wrong tries add a 30 s wait that doubles each time.
- **Honest limit, write it on the PIN screen and in the README:** the vault key is a non-extractable WebCrypto key, so the PIN is a **screen lock**, not a second layer of encryption. Someone with the unlocked phone's browser data is not stopped by it. Real key wrapping would need an extractable key wrapped with a PIN-derived key; that is a possible later step and needs a decision before anyone builds it.
- **Forgot PIN:** the only recovery is delete-all. Say so before the PIN is set.
- Strings in hi, en and kn. The shop name is read aloud nowhere, so no template changes.

Acceptance: a fresh install reaches Home with a profile; an old install shows the card and keeps its ledger; wrong PIN never reveals data; `deleteAll` clears the `profile` key too (extend the existing raw-IndexedDB e2e check); no new network calls (the privacy log test still passes).

### F2: search (A function, B screen)

- A: pure `searchCustomers(query, customers)` in `packages/core/src/names/`. Matches name, nickname, aliases and phone digits; case-insensitive; works across scripts using the existing `nameKey` and `looseKey` (typing "ramesh" finds रमेश and ರಮೇಶ್). Ranks prefix matches first, then contains, then one-edit matches. Empty query returns everything. Must stay pure (the `purity.test.ts` rule).
- B: search box at the top of the Customers screen, filters as you type, "no match" state with a "New customer" button prefilled with what was typed, clear button, keyboard-friendly on a phone. Also usable from the Add entry screen's customer picker.

Acceptance: unit tests for Devanagari, Kannada, romanised and mixed input, typos, nicknames and phone digits; a browser check that typing filters the list and clearing restores it.

### F3: same name already exists, ask for a nickname (A flow, B screens)

Today an exact name match posts to the existing customer, and two same-named customers produce a "which Ramesh?" question using aliases. New behaviour:

- **When a second customer with an already-used name is being created**, ask: "A khata for Ramesh already exists. What nickname for the new one, for example dairy or school? Say skip to continue." Pending kind `nickname`.
- Reply is taken as the nickname (stored through the same name transliteration so it matches across scripts). "Skip" or "no" creates the customer without one and the existing "which one?" ordinal question handles it later. The nickname flow expires like any other question and creates nothing if unanswered.
- **First step for A, before building:** check how a spoken "new customer Ramesh" is handled today. If there is no way by voice to create a second same-named customer on purpose (an exact match always wins), add a minimal "naya customer" intent. If that intent already exists, extend it. Record what you found in `conversation.md`.
- Display name everywhere is `Name (nickname)`. Ambiguity questions list nicknames: "Ramesh dairy or Ramesh school?".
- B: the Add entry and New customer screens show the same prompt when the typed name already exists, with a nickname field and a Skip button. A customer edit screen lets the shopkeeper add a nickname to existing duplicates later (uses `updateCustomer`).
- Rule that stays: a name that is not in the khata is never created without a yes. The nickname question comes **after** that yes.

Acceptance: scripted dialogue tests in hi, en, kn for: nickname given, skipped, expired, nickname already used by another Ramesh, duplicate created from the keypad; the disambiguation question speaks nicknames; `redteam.test.ts` and the compliance tests still pass.

### F4: longer yes/no window with a countdown (A engine, B countdown)

- A: replace the inline `30_000` in `engine.ts` with an exported `PENDING_TTL_MS = 60_000`. The clock starts when the controller reports that the question finished playing (new `questionSpoken()` call on the engine), not when the question was generated, so a long Kannada sentence does not eat the window. Barge-in keeps extending it (existing behaviour at `engine.ts` around line 562). All pending kinds share it, including the new `nickname`.
- B: a thin countdown ring or bar on the Yes and No buttons, driven by `answerExpiresAt` and `answerWindowMs`. It must not animate for users with reduced-motion set. On expiry the existing "didn't catch that, say it again" line plays; nothing is saved (existing rule, add a test).
- The exact numbers (60 s, 5-minute background lock in F1) live in one constants file each so they can be tuned after the test campaign.

Acceptance: fake-clock tests for expiry at 59 s and 61 s after the question finished, barge-in extension, and "nothing saved on expiry" for every pending kind.

### F5: voiced base summary for each customer (A intent and template, B button)

- Intent: "Ramesh ka hisaab batao", "tell me about Ramesh", "ರಮೇಶ್ ಬಗ್ಗೆ ಹೇಳಿ". Name resolution reuses the existing matching, so a near or ambiguous name asks first.
- Reply is one fixed template per language, built from facts only:
  - the balance in words: owes ₹X, ₹X advance, or all settled;
  - the last entry: kind, amount and how long ago ("3 days ago", "yesterday");
  - the number of entries in the last 30 days.
- No judgement words, no "habits", no "always late", no interest or lending language, no comparison with other customers. This follows the shaming and lending rules in `CLAUDE.md`.
- B: a "Hear summary" button on the customer screen that calls `speakSummary(id)`, and the same text appears on screen.
- Amounts are spoken with the existing `speak/amount.ts` so Hindi, English and Kannada number words stay consistent.

Acceptance: golden utterances for the new intent in all three languages plus Hinglish; a dialogue test per case (owes, advance, settled, no entries yet); red-team set still passes; Kannada text reviewed by the native speaker.

### F6: WhatsApp reminders (B)

- **Phone number:** optional field on the customer (add and edit), stored in the encrypted ledger. Validate 10 digits (India) or an international number with a country code; store normalised digits only.
- **Send flow:** on the Reminders screen and the customer screen, **Remind on WhatsApp** opens `https://wa.me/<digits>?text=<encoded reminder text>`. The text is the existing fixed `reminder_text` template. If the customer has no phone number, fall back to today's share sheet.
- The gate does not change: `canRemind()` in `packages/core/src/reminders/gate.ts` stays the single decision point. The button is disabled with a reason shown when consent is missing, nothing is due or a reminder went out in the last 7 days.
- The reminder is recorded when the shopkeeper taps the button (existing `recordReminder` behaviour). The app cannot know if the message was actually sent in WhatsApp; say so in the tracker so nobody builds on that assumption.
- **"Automated" here means less work, not automatic sending.** Add a **Due now** list at the top of Reminders: customers who are opted in, owe money and are past the 7-day gap, each with a one-tap button. No timers, no background sends, no push.
- Privacy: the phone number never reaches our server (the gateway sees no new fields, add that to the privacy log test). The text goes to WhatsApp only when the shopkeeper taps.
- Never add any threat, deadline pressure or shaming wording to the template. Keep it polite and short.

Acceptance: unit test for number normalisation; UI test that the button is disabled in each blocked state; a browser check that the generated link has the right digits and encoded text (assert the URL, do not open WhatsApp); compliance test that no reminder is prepared without opt-in; the raw-IndexedDB check still shows the phone number unreadable.

### F7: manual test campaign (C)

Purpose: replace "more training samples" with a repeatable way to find failures.

1. **Log:** create `docs/test-campaign.md` with a table: id, date, tester, language (hi, Hinglish, en, kn), what was meant, what was said, what the app heard, what the app did, result (`R` right, `A` asked correctly, `W` wrong), bug id.
2. **Volume and mix:** at least 60 lines per language group, at least two different speakers per group, one third with real background noise (shop, street, fan). Cover: amounts ("dedh sau", "saade teen sau", "do hazaar paanch sau", lakh), dates ("kal", "parso"), names (similar, long, two-word, cross-script), corrections, multi-entry sentences, yes/no answers, barge-in, silent press, very long speech, fast and slow speakers.
3. **Every `W` becomes a tracker row**, then a fix, then a **new line in the golden, held-out or red-team file** so it cannot come back. Fixes are routed to A (parser, dialogue) or B (UI) via `conversation.md`.
4. **Credits:** live runs spend Gnani credits. Read the balance first, keep at least 1,500 credits after the last run, and write each run in the credit log in `progress.md`. `npm run test:live` and `eval/run/run.ts` need `--yes`.
5. **Pass line for each round:** zero silent wrong amounts. Anything else is a bug to fix but does not block the round.
6. Repeat the campaign after F1 to F6 land, as a regression pass.

### B1: Kannada label clipped (B)

Reproduced on 2026-11-21 in mock mode at 390 and 360 px: the "ಇಂದು ಜಮಾ" label in the `.totals-payment` cell overlaps the `.notch-btn` Add entry button (`apps/web/src/phone/ui/phone.css`, the `.totals-card` grid). Fix the layout so the label and amount never sit under the button in any language at 360 px. Add a browser check for hi, en and kn that asserts the label and button boxes do not intersect. Close B1 only after that check passes.

### B2: corrections reach older entries (A)

Today a correction acts only on the last entry. Support "Mohan ka 500 nahi 300" or "Mohan's 500 should be 300" for an older entry.

- Find the most recent live entry for the named customer with the stated old amount. If there is exactly one, change it. If several match, ask which one (by day), as a question that expires like the others.
- The new amount still comes from the deterministic parser. A language-model result is never trusted for money.
- It is a reverse-and-repost through ledger events, so history stays auditable. Read the change back before saving if the amount is large, doubtful or garbled (existing rule).
- Cover direction flips and "undo" on an older entry as separate cases, with scripted dialogue tests.

### B3: long speech (C)

- Phone: cap one press at 30 s, show a countdown in the last 5 s, release automatically at the cap.
- Gateway: the final-transcript wait grows with the audio sent, for example 6 s plus half a second per second of audio, up to 20 s. Add both numbers to `config.ts` with sensible validation.
- Tests with the mock Gnani for a short, a 20 s and a 45 s press (the last is cut at the cap). Check that the per-IP, per-session and daily audio caps in `guards.ts` still apply.

## 4. Order of work

No calendar dates are promised. Phases are in order; inside a phase people work in parallel.

| Phase | Goal | A | B | C |
|---|---|---|---|---|
| **0. Setup** | Everyone can work safely | F0 contract (with B). Check the "naya customer" intent (F3). | F0 contract (with A). | Add collaborators to the repo, turn on branch protection, add the PR template, record a baseline: tests, e2e, size of the gzipped JS (58.5 KB at last count). Open the test log. |
| **1. Core** | The engine and data are ready | F4 engine, F3 flow, F2 function | F1 profile and PIN, B1 | B3, start F7 round 1 on the current app |
| **2. Screens** | Features are visible | F5, B2 | F2 screen, F3 and F4 screens, F6 | Browser checks for each feature as it merges, F7 round 1 fixes |
| **3. Integration** | All together, three languages | Review, fixes | Review, fixes | F7 round 2 as a regression pass, compliance and red-team full run, load test (I3), cold-start and mobile-data timing (I2, I5) |
| **4. Release** | Ship to Render | Fixes | Fixes | Build, run all checks, deploy by hand (autoDeploy is off), check `/healthz`, one real turn through the hosted copy |

Dependencies: F1 to F6 all need F0. B (F3 screens) needs A's `nickname` pending kind, and B (F4 countdown) needs A's `questionSpoken()`; A merges those engine pieces first and posts `DONE:` in `conversation.md`, and B starts that screen then. F5's button needs A's intent. F6 is independent of A once F0 has merged.

### Phase gates: every person's checkpoint must pass before the next phase starts

A phase is finished only when **all three** checkpoints for it are ticked, with evidence. Nobody starts the next phase's work on `main` until the gate is open. (Preparing a branch locally is fine; merging is not.) If one person is blocked, the other two help or review rather than moving ahead.

Each checkpoint has the same id as the project checkpoint plus the person's letter, for example `CP11-B`.

**How a gate is closed**

1. Each person ticks their own checkpoint: they add a line under their own heading in `progress.md` Log with the evidence (commands run and results, PR numbers, screenshot paths), and post `CHECKPOINT: CP11-B passed` in `conversation.md`.
2. A person other than the owner checks the evidence is real (runs the command, opens the PR). The reviewer in the table below is the one who verifies.
3. When all three are verified, Person C sets the project checkpoint (CP10 to CP14) in the `progress.md` table to Passed with the date, and posts `GATE OPEN: CP11` in `conversation.md`. Only then does the next phase start.
4. A checkpoint that fails is not skipped. Add a tracker row, fix it, and verify again. A waiver is allowed only with a `DECISION:` message from all three people, and it goes in the `Waivers` section of `progress.md`.

**Phase 0 gate: CP10 (setup done, contract merged)**

| CP | Person | Must be true | Evidence | Verified by |
|---|---|---|---|---|
| CP10-A | A | F0 core part merged: optional `nickname` and `phone` on customers, `customer_updated` event, `nickname` pending kind. The "naya customer" check for F3 is written up in `conversation.md`. | PR number; the ledger replay test over old events passes; `npm test` green on `main` | C |
| CP10-B | B | F0 phone part merged: `profile` meta type, the new actions and view-model fields compile, nothing visible changes yet. Fresh `main` runs in mock mode. | PR number; `npm run typecheck` and `npm run demo:mock` work; old-install settings still load | A |
| CP10-C | C | Repo is ready for three people: collaborators added, branch protection on `main` (PR and green CI required), PR template added, baseline recorded (test count, e2e result, gzipped JS size), `docs/test-campaign.md` created. Tracker rows match section 2 of this plan. | Settings page screenshot or `gh api` output, baseline numbers in `progress.md` | A |

**Phase 1 gate: CP11 (engine and first screens)**

| CP | Person | Must be true | Evidence | Verified by |
|---|---|---|---|---|
| CP11-A | A | F4 engine (`PENDING_TTL_MS`, `questionSpoken()`), F3 nickname flow, and the pure `searchCustomers` function merged, with scripted dialogue tests in hi, en and kn. | PR numbers; the new test names; compliance and red-team tests green | C |
| CP11-B | B | F1 sign-up and profile (including the PIN lock and the old-install card) and B1 merged; B1 has a browser check for hi, en and kn that fails without the fix. | PR numbers; browser e2e green; screenshots at 360 px in three languages; raw IndexedDB check still shows nothing readable | C |
| CP11-C | C | B3 merged (press cap, scaled wait) with mock-Gnani tests for short, 20 s and 45 s. F7 round 1 run on the current app: log filled, every `W` has a tracker row. | PR number; `docs/test-campaign.md` round 1 table; credit log entry | A |

**Phase 2 gate: CP12 (all features visible)**

| CP | Person | Must be true | Evidence | Verified by |
|---|---|---|---|---|
| CP12-A | A | F5 intent and template and B2 older-entry corrections merged; golden set grew with the new intents; Kannada text reviewed by the native speaker. | PR numbers; golden, held-out and red-team suites green; reviewer's sign-off in `conversation.md` | C |
| CP12-B | B | F2 search screen, F3 and F4 screens (nickname prompt, countdown), F5 button and F6 WhatsApp reminders merged. | PR numbers; screenshots in three languages, light and dark; the browser check on the `wa.me` link digits and text; reminder buttons disabled in every blocked state | A |
| CP12-C | C | A browser check exists for every feature F1 to F6 and passes; every `W` from round 1 is fixed or has an owner and a date; each fixed line was added to a golden, held-out or red-team set. | `npm run test:e2e` output; the fixed rows in the tracker with PR numbers | B |

**Phase 3 gate: CP13 (integration passed)**

| CP | Person | Must be true | Evidence | Verified by |
|---|---|---|---|---|
| CP13-A | A | Full regression: `npm test`, golden, held-out and red-team, compliance all green on `main`; no open P0 or P1 bug in A's area. | Command output pasted or linked in `progress.md` | C |
| CP13-B | B | Whole app walked through by hand in hi, en, kn on a real phone: sign-up, add by voice, nickname, search, summary, WhatsApp reminder, PIN lock, delete all. No open P0 or P1 bug in B's area. | A checklist in `progress.md` with pass or fail per step | A |
| CP13-C | C | F7 round 2 regression pass done: **zero silent wrong amounts**; load test (I3) and mobile-data and cold-start timing (I2, I5) recorded. | `docs/test-campaign.md` round 2 table; numbers in `progress.md`; credit log | B |

**Phase 4 gate: CP14 (released)**

| CP | Person | Must be true | Evidence | Verified by |
|---|---|---|---|---|
| CP14-A | A | A tagged release on `main` with release notes of what changed for users. | Tag name and notes link | B |
| CP14-B | B | Hosted copy used on a phone over mobile data: a real turn works in each language, and the new screens render at 360 px. | Short note in `progress.md` | C |
| CP14-C | C | Deployed to Render by hand from a clean `main`; `/healthz` ok; one real turn through the hosted copy; secret scan clean over history. | `progress.md` entry with the time and results | A |

The tracker rows in `bugs&improvements.md` move to Done only when the PR that closes them has merged **and** the checkpoint that covers them has passed.

## 5. Git workflow

The repo is public. Nothing secret, no real customer data and no transcripts go in any commit.

**One time, everyone**

```bash
git clone git@github.com:doublerook777/vidur.git && cd vidur
npm install
git config core.hooksPath .githooks    # secret scan plus typecheck before every commit
cp .env.example .env                   # only if you run real speech; never commit .env
```

**Branches**

- `main` is always releasable. Nobody pushes code to `main` directly.
- One branch per work package or fix, named `<type>/<id>-<short-words>`: `feat/F3-nickname-flow`, `fix/B1-kn-label-clip`, `test/F7-round1`, `chore/F0-contract`.
- Keep branches short-lived: open a PR within two days and merge within three. Rebase on `main` at least once a day: `git fetch && git rebase origin/main`.
- Never force-push `main`. Force-push to your own branch only with `--force-with-lease`.

**Commits**

- Small and focused, in the style the repo already uses: `feat(core): ask for a nickname when a name already exists`, `fix(web): stop kn paid-today label clipping`, `test: ...`, `docs: ...`. Reference the id in the body: `Refs F3`.
- Only commit what you changed. Look at `git status` and `git diff --staged` first.
- The pre-commit hook must pass. Do not use `--no-verify`.

**Before opening a PR**, all of these, locally:

```bash
npm run typecheck && npm run lint && npm test
npm run build && npm run test:e2e     # for anything that touches the phone UI or the gateway
npm run scan:secrets
# touched dialogue, templates, reminders or logging? also run:
npx vitest run apps/server/src/compliance.test.ts packages/core/src/dialogue/redteam.test.ts
npx vitest run --config eval/golden/vitest.config.ts
```

**Pull requests**

- Title is the commit style. Body: what and why, the work package id, how it was tested, screenshots for UI in Hindi, English and Kannada, and a line saying whether compliance-sensitive code changed.
- One approving review from someone else (see the reviewer column in section 2) and green CI (`scan:secrets`, typecheck, lint, test, build) before merge.
- **Squash and merge**, with the commit message cleaned up. Delete the branch after merging.
- Review within one working day. A reviewer checks: the rules in `CLAUDE.md`, tests exist and fail without the change, three languages covered, no new network calls or logged text, no new `process.env` or DOM use in `packages/core`.
- Anything that changes how money is parsed, saved or spoken needs both A and one other person to approve.

**Docs-only commits** (`docs/progress.md`, `docs/bugs&improvements.md`, `docs/conversation.md`) may go straight to `main`, because they are append-style and need to be seen fast. Run `git pull --rebase` first, keep the commit to those files only, and push right away. If a rebase conflicts in these files, keep both sides.

**Agents**

- A person starts an agent and is responsible for what it does. Each agent works on its own branch, ideally in its own `git worktree`, and never commits to `main`.
- Tell the agent its work package, its file area from section 2, and to read `CLAUDE.md`, the tracker and the last 30 lines of `conversation.md` before touching anything.
- Agents open PRs; a person reviews and merges. An agent does not push to `main`, change repo visibility, deploy, or spend Gnani credits unless the person who started it said so for that task.
- The signature line in `conversation.md` names both: `claude (for <person>)`.

**Release to Render**

Only Person C deploys, from a clean `main`: all checks above green, then trigger the deploy in Render's dashboard (the blueprint has `autoDeploy: false` on purpose). Afterwards check `/healthz`, open the hosted copy on a phone and complete one real turn. Record it in `progress.md`.

## 6. Using the three shared files

### `docs/bugs&improvements.md` (the tracker)

- Everything we do has a row. Copy the work packages in section 2 into it in Phase 0 (use ids `F0` to `F7`, keep `B1` to `B3`), with the owner filled in.
- Change the status in place: `open`, `in progress`, `blocked`, `done`, `wontfix`. When you start something, set the owner and `in progress`. When it merges, move the row to the Done table with the PR number and the evidence (test names, screenshot, run).
- Found a bug while working? Add a row at the bottom with steps to reproduce and where you saw it. Do not fix unrelated bugs inside another PR.
- Priority: P0 breaks the money or privacy rules (stop and tell everyone), P1 users hit it, P2 nice to have.

### `docs/progress.md` (what is done)

- Update it after every finished task and whenever something blocks you.
- The **Log** section gets one short dated entry per task, written under your own heading (`### Person A`, `### Person B`, `### Person C`) so two people do not append at the same line and conflict. Say what changed, how it was checked and what is left. No access codes, no names of testers, no real data.
- **Current state** and the checkpoint table are changed by Person C when a gate closes (see "Phase gates" in section 4). Each person records their own checkpoint (`CP11-B` and so on) under their own Log heading with evidence: commands run and numbers, not just "done".
- The **credit log** is updated by whoever spends Gnani credits, in the same commit window as the run.
- Replace the old hackathon "Current state" block with a Plan 2 one in Phase 0. The 2026-11 history below it stays as history.

### `docs/conversation.md` (the channel)

- Read the last 30 lines and the tracker before you start work and before you open a PR.
- Append only, newest at the bottom. Each message starts with `### YYYY-MM-DD HH:MM IST · who`. Agents sign `claude (for <person>)`.
- Message markers, so they can be searched:
  - `CLAIM: F3 files: packages/core/src/dialogue/engine.ts, templates.ts` before you start.
  - `DONE: F3 PR #12` when it merges, with anything the next person needs to know.
  - `RELEASE: F3` if you stop and someone else can take it.
  - `BLOCKED: F6 waiting on F0` with who can unblock it.
  - `Q:` a question to a named person. `DECISION:` something we agreed, with the reason.
  - `HANDOFF:` what an agent or person leaves behind when they stop for the day: state of the branch, what is next, what is half done.
- Before starting work that overlaps a file in someone else's area, post a `CLAIM:` and wait for a reply or one working day.
- Never edit or delete someone else's message. If something turns out wrong, add a correction below it.
- Do not put secrets, access codes, real names of customers or transcripts in it. It is public.
- When it passes about 300 lines, Person C moves the oldest part into `docs/conversation-archive/<month>.md` and leaves a one-line pointer.

### A working day, in order

1. `git pull --rebase` on `main`. Read the end of `conversation.md` and your tracker rows.
2. Post `CLAIM:` for what you will do. Branch from `main`.
3. Work in small commits. Run the checks.
4. Open the PR, post `PR #n ready for <reviewer>` in `conversation.md`.
5. After merge: tracker row to Done, a `progress.md` log line, a `DONE:` message. Commit these as one docs-only commit to `main`.
6. End of day: a `HANDOFF:` message if anything is half done.

## 7. Definition of done (every work package)

- [ ] Works in Hindi, English and Kannada (Hinglish for parsing), strings reviewed for Kannada.
- [ ] Unit tests added, and they fail without the change. Dialogue changes have scripted dialogue tests.
- [ ] `npm run typecheck`, `lint`, `test`, `build` green. `npm run test:e2e` green for UI and gateway changes.
- [ ] Compliance and red-team tests green if dialogue, templates, reminders or logging changed.
- [ ] No new network call, no logged transcript, nothing new stored on the server, no money from a language model.
- [ ] Screenshots in the PR for UI changes (three languages, light and dark, 360 px wide).
- [ ] Gzipped JS still within budget (set the budget from the Phase 0 baseline, with about 20% headroom).
- [ ] Tracker row moved to Done, `progress.md` log line written, `DONE:` posted in `conversation.md`.

## 8. Risks and open questions

| Risk or question | What we do |
|---|---|
| The PIN is only a screen lock (see F1) | Say so in the UI and README. Decide later whether to wrap the vault key with the PIN. |
| Old stored events or settings break after the schema change | Every new field optional, a replay test on old fixtures in F0, a vault version check. |
| Two people editing `contract.ts`, `labels.ts`, `templates.ts` or `controller.ts` | Small PRs, strings in per-feature blocks, rebase daily, merge F0 first. |
| WhatsApp link behaviour differs across phones and browsers | Test on at least one Android Chrome and one iPhone Safari; the share-sheet fallback stays. |
| Yes/no window of 60 s feels too long or too short | Constants live in one place; tune after the F7 rounds. |
| Kannada strings for new templates | A drafts them with the existing glossary; the native speaker reviews before F5 and F3 merge. |
| Credit burn from F7 | Floor of 1,500 credits, logged runs, mock mode for everything that does not need real speech. |
| The three people's names and who is A, B and C | Fill in the table below in Phase 0. |

| Letter | Person | Agents they run |
|---|---|---|
| A | Member A | Supervisor (Antigravity), pi (NVIDIA free), qwen |
| B | _fill in_ | |
| C | _fill in_ | |
