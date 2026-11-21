# Vidur progress log

Agents: read this first, then `bugs&improvements.md` and the end of `conversation.md`. (`PLAN.md` is in the git-ignored `references/`.) Update after every finished task and whenever something blocks.

## Current state

- **Phase:** Plan 2 (improvements after submission). The hackathon submission went in before the deadline; its history is kept below. Work is described in `docs/plan2.md` and tracked in `docs/bugs&improvements.md`. Messages between us and our agents go in `docs/conversation.md`.
- **Live copy:** https://vidur-xu96.onrender.com (Render free plan, deploys by hand; the access code is in Render's dashboard, never in the repo).
- **Active phase of Plan 2:** Phase 0 (setup). Nothing is built yet. A phase ends only when all three people's checkpoints (for example CP10-A, CP10-B, CP10-C) are verified; see "Phase gates" in `docs/plan2.md`.
- **Last checkpoint passed:** CP9 (hackathon deliverables, submitted). Plan 2 checkpoints are CP10 to CP15 below.
- **Next actions:**
  1. Fill in who is Member A, B and C in `docs/plan2.md` section 8 (the git log shows two names besides Member C).
  2. Member C: confirm the GitHub ruleset on `main` (deletion and force-push blocked). Collaborators, PR template and baseline are done.
  3. Merge ONE F0, the shared contract: it exists twice (on `main` and in PR #1) and the two conflict. See `conversation.md`.
  4. Then F1 to F6, F8 and F9 follow the phases in `docs/plan2.md`.
- **Known open bugs:** B1 (Kannada label clipped; CSS fix merged, browser check still missing), B2 (corrections only reach the last entry, now part of F8), B3 (long speech uncapped). See the tracker.

## Checkpoints

| CP | Phase | Status | Passed on | Evidence |
|---|---|---|---|---|
| CP0 | Foundation | Passed | 2026-11-11 | `git check-ignore .env` prints `.env`; scan fails on planted key and passes after; npm test 8 pass, typecheck, lint, build exit 0; keys set; balance 5,000 |
| CP1 | Speech spike | Passed | 2026-11-11 | Release to transcript p95 193 ms; Timbre first chunk p95 325 ms (new socket), 274 ms (warm); projected p95 660 ms (1.5 s with LLM); format `codemix`, one locale; credits 5 to 15 per audio minute (bounded by the 0.1k display, see T1.8 note); LLM `gpt-oss-20b`; all section 3 questions answered. All in `docs/DECISIONS.md` |
| CP2 | Core logic | Passed | 2026-11-11 | `npm test` 1,242 pass; typecheck, lint, build, scan:secrets exit 0. Number parser 800 tests plus round-trip of every rupee 1..30000 and 20,000 random values. Golden 165: intent 100%, amount 103/103, 0 silent wrong. Held-out 140 first run: intent 96%, amount 72/72, 0 silent wrong. Every PLAN 1.4 row is a scripted dialogue test. Disclosure proven for every first-turn path in hi, en, kn. `core` purity test passes. Red-team 83/83. See DECISIONS.md |
| CP3 | Gateway | Passed | 2026-11-11 | 60 server tests (mock Gnani: full turn, re-chunking, barge-in, drop and reconnect, 401/402, guards, privacy log). Live from a Node client: gateway overhead p50 1.3 ms and p95 2.9 ms (STT), p50 1.4 ms (TTS); barge-in 3 ms, no late audio; 0 transcript lines in logs. `spikes/cp3-live.mjs`, DECISIONS.md |
| CP4 | Phone app | Passed (usability check per the user's report; low-end Android not tested) | 2026-11-12 | 36 browser checks incl. barge-in 0 ms, raw IndexedDB unreadable, delete-all, 6x CPU throttle turn, 58.5 KB gzipped JS; live real-speech turn works in the browser. Usability check: on 2026-11-12 a friend used the app unaided on the user's Android phone over the tailnet HTTPS address; the user reported it went fine (the steps were not itemised). Not done: an actual low-end Android phone. DECISIONS.md |
| CP5 | Showcase | Passed | 2026-11-11 | frame, theme and language controls change the phone live; feature click explains; telemetry panel fills from a turn in the iframe; no horizontal scroll at 360, 1280, 1920; mic works in the iframe on localhost |
| CP6 | Accuracy and latency | Passed | 2026-11-12 | PASSED: 0 silent wrong amounts in 240 noisy recordings; Hindi amount right 100% at 10 dB (92% saved directly), Hinglish 92% counting read-backs (85% saved directly: judgment call, see DECISIONS); direction 99.5%; browser release-to-first-audio p95 1.8 s over 20 real turns; Hindi, Hinglish, English, Kannada all verified live. Live rehearsal (32 lines, real voice, noise) on 2026-11-12: round 1 gave 26 R, 3 A, 3 W; the 3 W (line 20 barge-in, line 27 Kannada, line 29 silent press) and five usability notes were fixed and retested by the user, all R (details in `docs/REHEARSAL.md`). Zero wrong amounts. Note: only the failed lines and the new buttons were retested, not all 32 again. |
| CP7 | Compliance | Passed | 2026-11-11 | `docs/COMPLIANCE.md` maps every rule to a proof; 15 repo-level compliance tests; red-team 83/83; secret scan clean over 41 commits of history; live AI disclosure first turn in Hindi, Kannada, English (`e2e/disclosure.mjs`) |
| CP8 | Deployment | Passed except the phone on mobile data and a cold-start measurement | 2026-11-12 | Hosted on Render's free plan at https://vidur-xu96.onrender.com (blueprint `render.yaml`, Docker image test-built locally first; keys and the access code typed into Render's dashboard by the user, never in the repo). Checked from here: `/healthz` 200 in 80 ms (warm); hosted mode needs the code; no code and a wrong code get `bad_access_code`, the right one `ready` with `degraded:false` and the LLM on; a foreign origin gets 403; showcase loads in 0.3 to 0.5 s with no console errors and no horizontal scroll at 1366 and 390; real speech turn through the hosted copy with a fake mic: AI disclosure spoken first, "Ramesh ka teen sau chalis rupaye udhaar" heard correctly, which-Ramesh question asked, release to first audio 751 ms; a silent press says it heard nothing. Not done: the user's phone over mobile data, and the cold-start time after sleeping (the free plan sleeps after about 15 minutes idle; `npm run keepwarm -- <url>` or opening it early). |
| CP9 | Deliverables | In progress | | Done: README, architecture and system-flow diagrams, deck (7 slides) and `references/slides.md`, framed and unframed screenshots in en and kn, demo video script. Not done: the video itself, team details on slide 1, public repo, submission form. |
| CP10 | Plan 2 gate 0: setup and contract | Not started | | CP10-A, CP10-B, CP10-C all verified (see `plan2.md` Phase gates): F0 merged, repo ready for three people, baseline recorded |
| CP11 | Plan 2 gate 1: engine and first screens | Not started | | CP11-A (F4, F3, search function), CP11-B (F1, B1), CP11-C (B3, F7 round 1, F9.0 locale probe) |
| CP12 | Plan 2 gate 2: all features visible | Not started | | CP12-A (F5, F8), CP12-B (F2, F3, F4 screens, F5 button, F6), CP12-C (browser checks, round 1 fixes) |
| CP13 | Plan 2 gate 3: four new languages | Not started | | CP13-A (ta, te, mr, gu core and templates), CP13-B (labels, fonts, Beta tag, 360 px checks), CP13-C (gateway locales, mock e2e per language, synthetic speech pass) |
| CP14 | Plan 2 gate 4: integration passed | Not started | | CP14-A (full regression), CP14-B (hand walkthrough on a phone), CP14-C (F7 round 2: zero silent wrong amounts, load and timing) |
| CP15 | Plan 2 gate 5: released | Not started | | CP15-A (tagged release), CP15-B (phone over mobile data), CP15-C (deployed, `/healthz`, one real turn) |

## Open user decisions

- [x] T0.4: `GNANI_API_KEY` and `LLM_API_KEY` set in `.env` (checked set, not printed), 2026-11-11. Opening balance 5,000 recorded.
- [x] T0.5: git workflow (PLAN section 0.7) and a private GitHub repo approved by the user, 2026-11-11
- [ ] T8.2: free host account (Render recommended; Oracle needs a card for verification)
- [ ] T9.2: make the GitHub repo public
- [ ] T9.4: team name, ID, college for the deck

## Credit log

Opening balance: 5,000 of 5,000 base credits (Gnani dashboard, 2026-11-11, from the user's screenshot). Hard floor: stop automated runs at 1,500 remaining.

| Date | Run | Audio minutes | Credits spent | Remaining |
|---|---|---|---|---|
| 2026-11-11 | probes: tts, stt, vad (about 2.3 min) | 2.3 | 51 to 150 (rounded) | 4.9k |
| 2026-11-11 | T1.4 clips and runs, T1.5, T1.6 (about 8 min) | 8 | within 51 to 150 total | 4.9k (reading 3) |

## Agents

| Name | Tab | Purpose | Context used | State |
|---|---|---|---|---|
| pi-helper | vidur / pi-agents (pane) | T0.2, T1.9 number tables, done | 18.2% | idle, reusable |
| pi-verify | vidur / pi-agents (pane) | T1.10 golden set, done | 10.7% | idle, reusable |

## Waivers

None.

## Log

Plan 2 entries go here, one short dated entry per finished task, under your own heading so two people never append at the same line. The 2026-11 hackathon history follows below them.

### Plan 2: Member A

- 2026-11-21: F0 shared contract core implementation merged. Added optional `nickname` and `phone` to `CustomerCreatedEvent`, new `customer_updated` event, and updated `Customer` read model. Added `nickname` to `PendingKind`. Added legacy events replay fixture in `packages/core/src/ledger/ledger.test.ts` verifying backward-compatibility. `npm run typecheck` and `npm test` (1483 tests across 31 files) passing. F3 "naya customer" intent audit completed.
- 2026-11-21: F2 pure search function implemented in `packages/core/src/names/search.ts` with ranking (whole-prefix, word-prefix, contains, one-edit typo) across scripts, nicknames, aliases, and phone digits. 11 tests in `search.test.ts` pass; `purity.test.ts` passes.
- 2026-11-21: F4 dialogue engine implemented: exported `PENDING_TTL_MS = 60_000`, `questionSpoken()` hook, `pendingExpiresAt()`, and `pendingWindowMs()`. Added unit tests for 59s open, 61s expiry, audio-spoken clock reset, barge-in extension, and "nothing saved on expiry" across every pending kind. Total suite: 32 files / 1,499 tests pass.
- 2026-11-21: F3 nickname dialogue flow implemented on branch feat/F3-nickname-flow (PR #3). Added ask_nickname template in en, hi, kn; handled duplicate name interception, nickname extraction, skip/no options, duplicate nickname rejection/re-ask, and disambiguation with spoken nicknames. 112 dialogue tests pass, all 1,513 workspace tests pass.

### Plan 2: Member B

- 2026-11-21: B1 Kannada label clipping fixed in `apps/web/src/phone/ui/phone.css`. Added max-width and wrapping on narrow screens (<= 390px) for kn and hi to ensure `.totals-payment` clears `.notch-btn`.

### Plan 2: Member C

- 2026-11-21, baseline on `main` before any Plan 2 code (CP10-C): `typecheck`, `lint`, `build` exit 0; `npm test` 31 files / 1,482 tests pass; browser e2e (mock Gnani, fake mic) 77/77; gzipped JS across all three bundles in `apps/web/dist/assets` is 69,455 bytes (about 68 KB), so the proposed budget with 20% headroom is 83,000 bytes.
- 2026-11-21: added `.github/pull_request_template.md`, `docs/test-campaign.md` and plan2 section 9 (Member C's own agent setup). Still open for CP10-C: collaborators and branch protection (need Members A and B's GitHub handles).
- 2026-11-21: judge feedback added two items to Plan 2: F8 (edit any customer's ledger by voice, including set-the-total with a mandatory read-back) and F9 (Tamil, Telugu, Marathi, Gujarati, Beta until a native speaker reviews them). B2 folded into F8. A new Phase 3 (languages) was inserted, so integration is now CP14 and release is CP15. Branch protection was replaced by a GitHub ruleset that blocks deletion and force-push; PRs are a team agreement.

### 2026-11-21 (setup, claude for the team)

- Moved this file from `references/` into `docs/` so we can share it. Added `docs/bugs&improvements.md`, `docs/conversation.md` and `docs/plan2.md`. Rechecked B1 in mock mode at 390 and 360 px: the Kannada "paid today" label still overlaps the Add entry button. Kannada strings were reviewed with a native speaker (reported by the team).

## History: hackathon build and submission

### 2026-11-11

- Read the brief, the PPT guide and `references/rough-ui.png`.
- pi-helper wrote `references/gnani-research.md`.
- pi-verify checked the key claims against the official docs and wrote `references/gnani-verify.md`. Core STT and TTS facts confirmed. No TTS cancel message exists. Mid-session keyterm changes are unconfirmed.
- Opus 5.5 wrote `docs/PLAN.md`.
- User asked for zero cost and a local run with judges' own keys. pi-free wrote `references/free-options.md`. Plan updated: git workflow (0.7), run modes (2.5), Groq free tier as optional LLM, free hosts, clean-room test (T8.11).
- User asked to reuse idle pi agents until 70% context and to keep all pi agents as panes in one `pi-agents` tab. pi-free closed.
- Created `.env` with blank keys and added it to `.gitignore`. User approved the git workflow and gave the deadline. Added the schedule. Build not started.

### 2026-11-11 (build started)

- T0.1 done: `.gitignore` extended. `git check-ignore .env` prints `.env`.
- T0.2 done by pi-helper, verified by Sonnet: `npm test` 3 tests pass, `npm run build` and `npm run lint` exit 0.
- T0.3 done: `scripts/scan-secrets.mjs` (also `--staged`, `--history`), `.githooks/pre-commit` (scan + typecheck, via `core.hooksPath`), `.env.example`, `apps/server/src/config.ts` with tests. The scan fails on a planted `gsk_` key and on a planted copy of the real `GNANI_API_KEY`, and passes once removed. Values are never printed.
- Added `.github/workflows/ci.yml` and root scripts `typecheck`, `scan:secrets`.
- Now: `npm test` 8 tests pass; typecheck, lint, build, scan all exit 0.
- CP0 passed. Opening balance 5,000 credits recorded. T1.9 (51 tests) and T1.10 (167 utterances, 7 tests) built ahead by pi and verified; left untracked until Phase 1.
- Phase 1 spike: T1.1 to T1.7 done, results in `docs/DECISIONS.md`. Findings that change the plan: the STT `connected` frame does not name the model (fingerprint on the transcript instead); `format=codemix` plus our own number parser beats the STT's digits (2 of 20 amounts wrong); `language_code` takes one locale only; TTS has no cancel, so barge-in closes the socket and uses a spare; push-to-talk `commit` is about 350 ms faster than the best VAD setting. LLM default `openai/gpt-oss-20b`; deterministic path carries P0.
- T1.9 and T1.10 (pi) verified and committed. The first commit message names only T1.9 but also contains T1.10 (`eval/golden`).
- CP1 passed. Credit rate bounded at 5 to 15 per audio minute (balance display rounds to 0.1k). Corrected PLAN section 3 and section 10. Groq usage: $0.02 projected, no billing.
- CP2 passed at 06:50 IST on Wed 11 Nov, about 14 hours ahead of schedule. Phase 2 findings (pi table errors, red-team gaps, honest held-out figure) in `docs/DECISIONS.md`. Dates on the schedule in PLAN section 17 are now slack.
- CP3 passed. Gateway built (guards, privacy logger, warm sockets, barge-in), mock Gnani by pi, live overhead measured. About 200 audio seconds spent on live probes since the last credit reading.
- Phase 4 and 5 built and tested in a real browser (see DECISIONS.md): phone app, session controller, encrypted vault, screens by pi, showcase page by pi, bridge. Gateway bugs found by the browser tests were fixed. CP4 is open only on the usability check; CP5 passed.
- Phases 6 to 8 built (see DECISIONS.md): corpus and scorer, parser read-back rules, browser latency, compliance map and tests, Docker, doctor, clean-room test. Everything is on branch `phase/6-hardening` (pushed to the private repo). Credits: roughly 25 audio minutes spent since the 4.9k reading (corpus 548 s x2 runs plus 190 s of Timbre, live browser tests, latency runs); a fresh balance reading is needed.

### 2026-11-11 (first unaided usability test, found two bugs)

- A friend tried the app unaided in Hindi: "mohan ke 3000 rupye udhar hain", then "nhi nhi 1500 rupye udhar hain". The app created a customer called "nhi" with ₹1,500 credit, and fixing it left Mohan at ₹6,500.
- Root causes, both reproduced in a test: (1) "nhi" was not in the correction cue list, so it was guessed as a name and a customer was created silently; (2) even spelled "nahi nahi 1500 udhaar hain", a correction that repeats the direction word was not treated as a correction (the rule needed no direction), so the app asked "whose account?" and answering "Mohan" posted a second entry.
- Fixes: a sentence that opens with nahi/nhi/nahin/galat/sorry plus an amount and no name of a person replaces the last entry (a stated direction is honoured; a flipped direction speaks the full result); "rupye" and spelling variants are no longer guessed as names; and the user's rule: **a name that is not in the khata is never created without a yes**. The app asks "create a new khata for X? yes or no" (hi/en/kn). "No" asks whose account, or takes "nahi, Mohan" in one breath. An unanswered question expires and creates nothing.
- Tests: 10 spoken variants of the friend's correction, flip, nothing-to-correct, someone-else's name, five new-name flows (yes, no, no with name, expiry, two names in one sentence). Core and phone tests updated where they relied on silent creation. `npm test` 31 files / 1423 tests, typecheck, lint, build green; browser e2e 36/36 (mock); corpus re-scored offline with the same numbers (0 silent wrong, direction 99.5%, amount right 94.7%). Rehearsal sheet now 32 lines (31 and 32 cover this).
- Timestamps: every entry already stores `at` (when the money moved) and `recordedAt` (when logged), but no screen shows them. Showing date and time on the feed and each customer's history is queued as frontend work with the user's other UI changes.
- Not done yet: tap Yes/No buttons for the new-name question on the phone screen (voice works today), the usability test must be repeated with a fresh person after this fix.

- Impeccable plugin installed; `/impeccable init` wrote `PRODUCT.md` at the repo root (platform web, shopkeeper-first, voice-first, low-text). Live mode and DESIGN.md not set up yet.

### 2026-11-11 (design pass with Impeccable)

- User pinned two references: `references/design references/ref-1.jpg` for the whole web page (teal soft-UI slabs with notches, frosted panes, capsule controls, condensed display type) and `ref2.jpg` for the phone (stacked hero card with a notch, floating pill nav, time under each entry, light and dark pair). Direction contracts are in `apps/web/.impeccable/surfaces/`.
- Showcase rebuilt: the phone stays pinned and the left and right sections crossfade as the page scrolls (below 1100 px everything stacks; below 700 px only the phone, as before).
- Phone rebuilt: new teal world in light and dark; hero card with amber card behind and an Add entry button in the notch; floating pill with the voice circle rising out of it.
- New features: time and date on every entry (and the recorded time when an entry is opened); All entries screen grouped by day; add an entry by hand with a date and time; remove any entry (asks first, restorable for 8 s); Yes and No buttons for the spoken yes/no questions (new name, amount check, near name, consent); the AI voice circle, which moves with the loudness of the voice in the room and of Vidur's voice, with a different shape for every state.
- Fonts are self-hosted (`apps/web/public/fonts`, OFL, `LICENSES.md`), including Devanagari and Kannada, which were missing on this machine.
- Evidence: `npm test` 32 files / 1,441 tests, typecheck, lint, scan green; browser e2e 55/55 (19 new checks); Impeccable detector 0 findings with two reasoned exceptions in `.impeccable/config.json`.
- Not done: finish review fixes (pending), DESIGN.md, native-speaker review of the new Kannada strings, a real-phone check of the voice circle's performance on a low-end Android.
- Finish review (fresh Impeccable reviewer) returned "fix" with eight items; applied: the stage phone now acts out each chapter (demo home, a real new-name question, entries with times, settings) through a `vidur:scene` bridge message; the crossfade has a sharp plateau and fades fully out before the next fades in; tracked-caps chips above headings removed (real headings instead); entry rows no longer wrap the date (short month, no date under day headings); the nav gained a separate fade behind it and a wider slot so the voice circle no longer overprints labels; the entry menu scrolls clear of the nav; the demo ledger has entries from today and a small demo chip replaces the lilac bar; wordmark scaled up and lower sections varied. Not done: one rendered material plate for the lower page (reviewer's ceiling note). Checks after fixes: 1,441 unit tests, 56/56 browser, detector 0, lint/typecheck/scan green.
- DESIGN.md and .impeccable/design.json written by the documenter from the built system (one teal world, two surfaces, voice circle states, crossfade plateau rule).

- Phase 7b (design changes from `references/changes.png`): page widened to 1560px; the raised tab over the hero card now matches the card plus halo; sliced wordmark replaced by a title that cycles VIDUR / विदुर / ವಿದುರ with the tagline beneath; all scrollbars hidden (page and phone); phone frame back to the original neutral black bezel (11141a, 2px edge) with geometry fixed so the 390x844 screen fits exactly (the 2px border had clipped 4px off the right edge); bottom menu is a solid dock fixed to the phone's bottom edge, icons only (accessible names kept), no content behind it; privacy and limits panes sit fully inside their slabs with more padding; showcase at 700px and below is now the full page stacked for a thumb with an "Open the app full screen" button (replaces the app-only view). Checks: 1,441 unit tests, browser e2e 63/63, typecheck and lint clean.
- Phone body had the browser's default 8px margin, which showed as black bars on three sides and square top corners inside the frame; reset to 0 with the ground colour behind it; new e2e check (64/64).

- Round 1 of the live rehearsal (Thu 12 Nov): 26 R, 3 A, 3 W (lines 20, 27, 29) plus five notes from the user. All fixed in `main` (see "Round 1 result" in `docs/REHEARSAL.md`): glued speech words (`unglue`), negative balances in replies, Kannada/Hindi aliases and cross-script alias matching, silent-press detection, honest speech-service error text, cancel button on questions, "See notes" link, "New customer" button, "Add entry" in the error banner. Fresh-install language follows the phone; changing language rewrites the greeting on screen. cp6 is not tagged until lines 20, 27, 29 and the new buttons are retested live. The usability check (cp4) passed with the friend on the phone (no issues reported).

### 2026-11-12 (deliverables session)

- **Files in `references/` are gitignored** (the folder is in `.gitignore`), so they exist only on this machine: `Vidur-deck.pptx`, `slides.md`, `architecture.png` (3200x1800, transparent), `system-flow.png`, `system-flow-strip.png` (the strip now placed on slide 4), `screenshots/` (`home|customers` x `en|kn`, plain and `-framed`), `demo-video-script.md` (2:56 in total, includes a multi-entry shot: "Sunita ne kal do sau rupaye jama kiye aur Kavita ka dedh sau rupaye udhaar"), `DECK.md`, `DEMO_SCRIPT.md`, `RUNBOOK.md`. The first three were moved out of `docs/` on request (commit `f41eb33`); `docs/REHEARSAL.md` stays in the repo as the evidence for the rehearsal. `references/RUNBOOK.md` still points to `docs/DEMO_SCRIPT.md`, which now lives in `references/`.
- Deck built with pptxgenjs from the `DESIGN.md` colours (build scripts were in the session scratchpad and are not kept). Headline numbers on slide 5: 648 ms is the median release to first audio (Hindi, 20 turns; p95 1.8 s, max 3.5 s), 0 is silent wrong amounts in 240 synthetic recordings, "dedh sau" is an example, AES-GCM 256, 7 days is the reminder gate. The honest-limits wording: the 240-recording test is synthetic voices; the 32-line rehearsal with a real voice (one speaker) found 3 wrong in round 1, all fixed and retested right; only the failed lines and new buttons were retested.
- Multi-entry sentences work (tested up to 8 entries in one sentence, split by amount); a question (two Rameshes) saves the earlier entries, asks, and holds the rest. Not tested live: very long speech (the server waits 6 s for the final transcript; no cap on press length). Corrections only act on the last entry.
- Known small bug, not fixed: in Kannada the Home "Paid today" label is clipped behind the Add entry button.
- Deployment cost notes for slide 6 (not yet on the slide): hackathon cost is zero (Render free plan, free Gnani credits, free Groq). One 243 MB stateless container. Render paid is about $7 per month and Fly about $2 (from `references/gnani-verify.md`, 11 Nov, recheck before quoting). Gnani has no public price list. Risks: no public Gnani price, cold start about a minute, no backup or sync (ledger only on the phone), load not tested.
- **Fix: the showcase page and the phone now stay in step.** Page to phone already worked. Phone to page did not: a language or theme change made inside the phone (Settings) left the page's buttons on the old value, and on load the page overwrote the phone's saved settings with Hindi and Light. Now the phone sends `vidur:prefs` (theme and language) on every change and at start, the page adopts them, and the page only pushes the frame on load. Files: `apps/web/src/phone/contract.ts`, `apps/web/src/main.tsx`, `apps/web/src/showcase/showcase.ts`, one new browser check in `e2e/browser.mjs`. Checks: typecheck, lint, scan:secrets, `npm test` 33 files / 1,482 tests, build, browser e2e 77/77.
- Stale mock servers (pids 89168, 97102, 97684) and pid 12643 were refused by the safety classifier earlier; the user may run `! kill 89168 97102 97684`. Kannada strings still need a native-speaker review.
