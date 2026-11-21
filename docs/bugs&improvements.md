# Bugs and improvements

Shared tracker for the three of us and our agents. One row per item. Keep it current: add new items at the bottom of their table, change the status in place, and note the date when it moves. The plan behind the F items is `plan2.md`; how to use this file is in its section 6.

**Status:** `open` · `in progress` · `blocked` · `done` · `wontfix` · `parked`
**Priority:** P0 breaks the money or privacy rules · P1 users hit it · P2 nice to have
**Owner:** A, B or C as in `plan2.md` (names are filled in there), or `unassigned`

Rules that never bend are in `CLAUDE.md` (integer paise, fixed reply templates, nothing stored on the server, no transcripts in logs). Run the compliance and red-team tests after touching dialogue, templates or logging.

## Plan 2 work packages

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| F0 | P1 | done | A + B | Shared contract: optional `nickname` and `phone` on customers, `customer_updated` event, `profile` in the vault, new actions and view-model fields, `nickname` pending kind | Merged 2026-11-21 (`ddda513` core types, `501231b` PR #4: update rules, wired actions, profile storage, frozen replay test). CP10 passed. Reviewer: C. |
| F1 | P1 | done | B | First-time sign-up and profile management (local only): shop name, owner name, optional PIN screen lock, edit profile, delete all | PIN is a screen lock, not extra encryption: said so in the UI. Existing installs get a "Complete your profile" card. Merged 2026-11-21 (`f30f5b5`, `5f94d7c`; review addressed: forgot-PIN warning, KN_REVIEW keys, pinDigitsRequirement). CP11-B passed. Reviewer: C. |
| F2 | P1 | done | A + B | Search across all customers | A: pure `searchCustomers` merged (`8e18c42`). B: customer search input with clear button and empty state on Customers and customer picker search on Keypad. Real browser checks and unit tests pass. Merged 2026-11-21 (`c9fa521`). Reviewer: C. |
| F3 | P1 | done | A + B | Same name already exists: ask for a nickname (skippable) | A: core dialogue flow, templates and tests merged (PR #3, `2e59276`; PR #4). B: manual new-customer nickname prompt, customer detail nickname and name editors, multi-word names, namesake questions merged (PR #7, #8, #11, `c9fa521`). Reviewer: C. |
| F4 | P1 | done | A + B | Yes/no window 30 s to 60 s, counted from when the question finishes being spoken, with a countdown on the buttons | A: `PENDING_TTL_MS = 60_000`, `questionSpoken()` done. B: countdown bar and seconds label on Yes/No buttons in `EntryCard.tsx`, respects `prefers-reduced-motion`. Browser and unit tests pass. Merged 2026-11-21 (`c9fa521`). Reviewer: C. |
| F5 | P1 | done | A + B | Voiced base summary for each customer | A: core dialogue & templates merged (PR #5, `986196f`). B: "Hear summary" button on CustomerDetail calling `speakSummary()`, updates agentLine and speaks reply. Tested in unit and e2e browser checks. Merged 2026-11-21 (`c9fa521`). Reviewer: C. |
| F6 | P1 | done | B | WhatsApp reminders: optional customer phone, "Remind on WhatsApp" opens a `wa.me` link with the fixed text, "Due now" list | Phone number editing and validation on CustomerDetail; Remind on WhatsApp generates `https://wa.me/<digits>?text=...` with share fallback; `canRemind()` gate enforced; "Due now" section on Reminders screen. 109 browser checks pass. Merged 2026-11-21 (`c9fa521`). Reviewer: A. |
| F7 | P1 | open | C | Manual test campaign: log failures, fix them, add each failed line to the golden, held-out or red-team set | At least 60 lines per language group, two speakers, a third noisy. Keep 1,500 Gnani credits. Log in `docs/test-campaign.md`. |
| F8 | P1 | done | C (core), B (screens) | Edit any customer's ledger by voice: by day ("change today's credit of Anil to 100"), by old amount ("Mohan ka 500 nahi 300", the old B2), set the total ("change Anil's total to 1000"), undo or flip an older entry | Raised by a judge at the demo. Set-total posts one adjustment entry with a **mandatory read-back**. Deterministic parser only. Core, templates, parser cues and tests merged in PR #6 (`95ae55d`). Manual entry edit from menu with undo merged in PR #9 (`60a2630`). B shows adjustment tag `balanceSetTag` for `reason: 'balance_set'` in Feed and CustomerDetail. Merged 2026-11-21 (`c9fa521`). Reviewer: A for core, C for screens. |
| F9 | P1 | open | A + B + C | Four more languages: Tamil, Telugu, Marathi, Gujarati | Raised by a judge. Number tables exist for all four; nothing else does. C first probes which locales Gnani STT and TTS support (F9.0). Every string is machine-drafted and shown as **Beta** until a native speaker reviews it; no native speakers available yet, so testing stays minimal. Reviewer: A for B and C parts, C for A parts. |

## Bugs

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| B1 | P1 | done | B | Kannada Home: the "ಇಂದು ಜಮಾ" (paid today) label is clipped behind the Add entry button | Fixed in `apps/web/src/phone/ui/phone.css`; 6 automated browser intersection checks (hi, kn, en at 390px and 360px) in `e2e/browser.mjs` passing. Merged 2026-11-21 in PR #10 (`f30f5b5`). Reviewer: C. |
| B2 | P1 | done | C | Corrections only act on the last entry | **Folded into F8** (2026-11-21). Implemented in PR #6 and `c9fa521`. Scripted dialogue and browser checks pass. |
| B3 | P1 | done | C | Very long speech untested and uncapped | Phone cap at 30 s with countdown in last 5 s and automatic release; server transcript wait grows dynamically (6 s + 0.5 s/sec of audio up to 20 s) with config validation; session/daily audio caps enforced. Tests for short, 20 s, 45 s in server.test.ts and controller.test.ts pass. Merged 2026-11-21 (`fa0de15`). Reviewer: A. |

## Other improvements

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| I1 | P2 | parked | unassigned | Backup and restore | The ledger lives only on the phone. An encrypted export and import file keeps "server stores nothing". Not chosen for Plan 2; revisit after it. Server-side sync would break the privacy promise. |
| I2 | P2 | open | C | Cold start on the hosted copy | Render free plan sleeps after about 15 minutes. Time a cold start; we stay on Render for now. Phase 4 of the plan. |
| I3 | P2 | open | C | Load test | Never tested under load. Phase 4. |
| I4 | P2 | open | unassigned | Real low-end Android check | Only tested on one mid-range phone. Needs a person with a low-end phone. |
| I5 | P2 | open | C | Hosted copy on mobile data | Not yet timed from a phone. Phase 4. |
| I6 | P2 | open | unassigned | Stale mock server processes | pids 89168, 97102, 97684 may still run on one machine: `kill 89168 97102 97684`. |
| I7 | P2 | open | C | Add a gzipped JS size budget to CI or the baseline | Baseline 2026-11-21: 69,455 bytes gzipped across all three bundles. Proposed budget 83,000 bytes (20% headroom). |

## Done

| ID | Date | Item | Evidence |
|---|---|---|---|
| D1 | 2026-11-21 | Kannada strings reviewed with a native speaker | Reported by the team; any changes the reviewer asked for still need to be confirmed in `apps/web/src/phone/ui/labels.ts` and `packages/core/src/i18n/`. |
