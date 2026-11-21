## What and why

<!-- One or two sentences. Work package id from docs/plan2.md (F0 to F7, B1 to B3). -->

Refs:

## How it was tested

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
- [ ] `npm run test:e2e` (UI or gateway changes)
- [ ] Compliance and red-team tests (dialogue, templates, reminders or logging changes)

## Rules check (CLAUDE.md)

- [ ] No money from a language model; amounts are integer paise from the deterministic parser
- [ ] Replies are fixed templates; no threats, shaming, interest or lending language
- [ ] No new network call, nothing new stored on the server, no transcript logged
- [ ] `packages/core` stays pure (no Node, DOM, network, `process.env`)
- [ ] Works in Hindi, English and Kannada; Kannada strings reviewed by the native speaker
- [ ] No secrets, access codes or real customer data

## Screenshots

<!-- UI changes: hi, en, kn; light and dark; 360 px wide. -->

## Bookkeeping

- [ ] Tracker row updated in `docs/bugs&improvements.md`
- [ ] Log line in `docs/progress.md`, `DONE:` message in `docs/conversation.md` after merge
- [ ] Compliance-sensitive code changed? yes / no
