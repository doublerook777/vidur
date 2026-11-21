# Bugs and improvements

Shared tracker for the three of us and our agents. One row per item. Keep it current: add new items at the bottom of their table, change the status in place, and note the date when it moves.

**Status:** `open` · `in progress` · `blocked` · `done` · `wontfix`
**Priority:** P0 breaks the money or privacy rules · P1 users hit it · P2 nice to have
**Owner:** a name, or `unassigned`

Rules that never bend are in `CLAUDE.md` (integer paise, fixed reply templates, nothing stored on the server, no transcripts in logs). Run the compliance and red-team tests after touching dialogue, templates or logging.

## Bugs

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| B1 | P1 | open | unassigned | Kannada Home: the "ಇಂದು ಜಮಾ" (paid today) label is clipped behind the Add entry button | Rechecked 2026-11-21 in mock mode: still overlaps at 390 and 360 px. Label is `.totals-payment` and button is `.notch-btn` in `apps/web/src/phone/ui/phone.css`; `.totals-card` grid area `paid` shares the row with the button. Add an e2e check for Hindi, English and Kannada. |
| B2 | P1 | open | unassigned | Corrections only act on the last entry | "Mohan's 500 was actually 300" cannot reach an older entry. Needs dialogue engine work and scripted dialogue tests. |
| B3 | P1 | open | unassigned | Very long speech untested and uncapped | Server waits 6 s for the final transcript; there is no cap on press length. Add a max press length and a wait that scales with audio length. |

## Improvements

| ID | Pri | Status | Owner | Item | Notes |
|---|---|---|---|---|---|
| I1 | P1 | open | unassigned | Backup and restore | The ledger lives only on the phone. Cheapest option that keeps "server stores nothing": encrypted export and import file. Server-side sync would break the privacy promise, so it needs a team decision first. |
| I2 | P2 | open | unassigned | Cold start on the hosted copy | Render free plan sleeps after about 15 minutes. Time a cold start; decide between keepwarm and a paid plan. |
| I3 | P2 | open | unassigned | Load test | Never tested under load. |
| I4 | P2 | open | unassigned | Real low-end Android check | Only tested on one mid-range phone. |
| I5 | P2 | open | unassigned | Hosted copy on mobile data | Not yet timed from a phone. |
| I6 | P2 | open | unassigned | Stale mock server processes | pids 89168, 97102, 97684 may still run: `kill 89168 97102 97684`. |

## Done

| ID | Date | Item | Evidence |
|---|---|---|---|
| D1 | 2026-11-21 | Kannada strings reviewed with a native speaker | Reported by the team; any changes the reviewer asked for still need to be confirmed in `apps/web/src/phone/ui/labels.ts` and `packages/core/src/i18n/`. |
