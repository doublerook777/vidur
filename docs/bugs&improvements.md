# Bugs and improvements

Shared tracker for the three of us and our agents. One row per item. Keep it current: add new items at the bottom of their table, change the status in place, and note the date when it moves. The plan behind the F items is `plan2.md`; how to use this file is in its section 6.

**Status:** `open` · `in progress` · `blocked` · `done` · `wontfix` · `parked`
**Priority:** P0 breaks the money or privacy rules · P1 users hit it · P2 nice to have
**Owner:** A, B or C as in `plan2.md` (names are filled in there), or `unassigned`

Rules that never bend are in `CLAUDE.md` (integer paise, fixed reply templates, nothing stored on the server, no transcripts in logs). Run the compliance and red-team tests after touching dialogue, templates or logging.

## Plan 2 work packages

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| F0 | P1 | in progress | A + B | Shared contract: optional `nickname` and `phone` on customers, `customer_updated` event, `profile` in the vault, new actions and view-model fields, `nickname` pending kind | Core types & replay test done. Must merge first. Reviewer: C. |
| F1 | P1 | open | B | First-time sign-up and profile management (local only): shop name, owner name, optional PIN screen lock, edit profile, delete all | PIN is a screen lock, not extra encryption: say so in the UI. Existing installs get a "Complete your profile" card. Reviewer: C. |
| F2 | P1 | in progress | A + B | Search across all customers | A: pure `searchCustomers` done (cross-script, nicknames, aliases, phone digits). B: search box on Customers and the customer picker. Reviewer: C. |
| F3 | P1 | open | A + B | Same name already exists: ask for a nickname (skippable) | A first checks how a spoken "new customer X" works today. Nickname question comes after the new-name yes. Reviewer: C. |
| F4 | P1 | in progress | A + B | Yes/no window 30 s to 60 s, counted from when the question finishes being spoken, with a countdown on the buttons | A: `PENDING_TTL_MS`, `questionSpoken()` done. B: countdown, respects reduced motion. Reviewer: C. |
| F5 | P1 | open | A + B | Voiced base summary for each customer | Fixed template: balance, last entry, entries in the last 30 days. No judgement words. Kannada text needs the native speaker. Reviewer: C. |
| F6 | P1 | open | B | WhatsApp reminders: optional customer phone, "Remind on WhatsApp" opens a `wa.me` link with the fixed text, "Due now" list | Gate in `reminders/gate.ts` unchanged. The app cannot know if the message was sent. No server involvement. Reviewer: A. |
| F7 | P1 | open | C | Manual test campaign: log failures, fix them, add each failed line to the golden, held-out or red-team set | At least 60 lines per language group, two speakers, a third noisy. Keep 1,500 Gnani credits. Log in `docs/test-campaign.md`. |

## Bugs

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| B1 | P1 | open | B | Kannada Home: the "ಇಂದು ಜಮಾ" (paid today) label is clipped behind the Add entry button | Rechecked 2026-11-21 in mock mode: still overlaps at 390 and 360 px. Label is `.totals-payment` and button is `.notch-btn` in `apps/web/src/phone/ui/phone.css`; `.totals-card` grid area `paid` shares the row with the button. Add a browser check for hi, en and kn that the two boxes do not intersect. |
| B2 | P1 | open | A | Corrections only act on the last entry | "Mohan's 500 was actually 300" cannot reach an older entry. Find the latest matching entry for that customer, ask if several match, reverse and repost, amount from the deterministic parser only. Scripted dialogue tests. |
| B3 | P1 | open | C | Very long speech untested and uncapped | Server waits 6 s for the final transcript; no cap on press length. Phone cap at 30 s with a countdown, gateway wait of 6 s plus 0.5 s per second of audio up to 20 s. Tests with the mock Gnani. |

## Other improvements

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| I1 | P2 | parked | unassigned | Backup and restore | The ledger lives only on the phone. An encrypted export and import file keeps "server stores nothing". Not chosen for Plan 2; revisit after it. Server-side sync would break the privacy promise. |
| I2 | P2 | open | C | Cold start on the hosted copy | Render free plan sleeps after about 15 minutes. Time a cold start; we stay on Render for now. Phase 3 of the plan. |
| I3 | P2 | open | C | Load test | Never tested under load. Phase 3. |
| I4 | P2 | open | unassigned | Real low-end Android check | Only tested on one mid-range phone. Needs a person with a low-end phone. |
| I5 | P2 | open | C | Hosted copy on mobile data | Not yet timed from a phone. Phase 3. |
| I6 | P2 | open | unassigned | Stale mock server processes | pids 89168, 97102, 97684 may still run on one machine: `kill 89168 97102 97684`. |
| I7 | P2 | open | C | Add a gzipped JS size budget to CI or the baseline | Baseline 2026-11-21: 69,455 bytes gzipped across all three bundles. Proposed budget 83,000 bytes (20% headroom). |

## Done

| ID | Date | Item | Evidence |
|---|---|---|---|
| D1 | 2026-11-21 | Kannada strings reviewed with a native speaker | Reported by the team; any changes the reviewer asked for still need to be confirmed in `apps/web/src/phone/ui/labels.ts` and `packages/core/src/i18n/`. |
