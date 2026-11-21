# Test campaign (F7)

Manual testing in place of "more training samples": find where Vidur fails, fix it, and add the failed line to the golden, held-out or red-team set so it stays fixed. Plan: `plan2.md` F7. Owner: Member C.

**Rules**

- Aim for at least 60 lines per language group (Hindi, Hinglish, English, Kannada), at least two speakers per group, one third with real background noise.
- Result codes: `R` right, `A` asked correctly (the app asked a good question instead of guessing), `W` wrong.
- Every `W` gets a row in `bugs&improvements.md` and a new test line. A silent wrong amount is a P0.
- Real-speech runs spend Gnani credits. Read the balance first, keep at least 1,500 after the last run, and log each run in the credit log in `progress.md`.
- Synthetic or invented names and amounts only. No real customer data. Name testers by initials or "speaker 1".

**Cover:** amounts ("dedh sau", "saade teen sau", "do hazaar paanch sau", lakh), dates ("kal", "parso"), similar and long names, cross-script names, corrections, multi-entry sentences, yes and no answers, barge-in, silent press, very long speech, fast and slow speakers, noise.

## Round 1 (on the current app, before Plan 2 features)

| # | Date | Speaker | Lang | Noise | Meant | Said | Heard | App did | Result | Tracker id |
|---|---|---|---|---|---|---|---|---|---|---|

## Round 2 (regression pass after Plan 2 features)

| # | Date | Speaker | Lang | Noise | Meant | Said | Heard | App did | Result | Tracker id |
|---|---|---|---|---|---|---|---|---|---|---|

## Summary per round

| Round | Lines | R | A | W | Silent wrong amounts | Credits spent |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
