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
