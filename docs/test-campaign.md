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
| R2-01 | 2026-11-21 | sim | hi | clean | Credit entry | Mohan ka 340 udhaar | Mohan ka 340 udhaar | Saved ₹340 credit | R | |
| R2-02 | 2026-11-21 | sim | hi | clean | Summary query | Mohan ka total? | Mohan ka total? | Spoke ₹500 balance | R | F5 |
| R2-03 | 2026-11-21 | sim | hi | clean | Payment | Sunita ne 200 jama kiye | Sunita ne 200 jama kiye | Saved ₹200 payment | R | |
| R2-04 | 2026-11-21 | sim | hi | clean | Shorthand | Mohan ne 2.5k jama kiye | Mohan ne 2.5k jama kiye | Saved ₹2,500 payment | R | |
| R2-05 | 2026-11-21 | sim | hi | clean | Namesake check | Ramesh ka 340 udhaar | Ramesh ka 340 udhaar | Asked which Ramesh | A | F3 |
| R2-06 | 2026-11-21 | sim | ta | clean | Credit entry | சுனிதா 340 கடன் | சுனிதா முன்னூற்று நாற்பது ரூபாய் கடன் | Saved ₹340 credit | R | F9 |
| R2-07 | 2026-11-21 | sim | te | clean | Credit entry | సునీత 340 అప్పు | సునీతా మూడు వందల నలభై రూపాయలు అప్పు | Saved ₹340 credit | R | F9 |
| R2-08 | 2026-11-21 | sim | mr | clean | Credit entry | सुनीता 340 उधार | सुनीता तीनशे चाळीस रुपये उधार | Saved ₹340 credit | R | F9 |
| R2-09 | 2026-11-21 | sim | gu | clean | Credit entry | સુનીતા 340 ઉધાર | સુનીતા ત્રણસો ચાલીસ રૂપિયા ઉધાર | Saved ₹340 credit | R | F9 |
| R2-10 | 2026-11-21 | sim | kn | clean | Credit entry | ರಮೇಶ್ 340 ಸಾಲ | ರಮೇಶ್ ಮುನ್ನೂರು ನಲವತ್ತು ರೂಪಾಯಿ ಸಾಲ | Saved ₹340 credit | R | |
| R2-11 | 2026-11-21 | sim | all | mixed | Golden suite | 285 golden lines | Varied | 100% intent & amount | R | |
| R2-12 | 2026-11-21 | sim | all | mixed | Heldout suite | 164 heldout lines | Varied | 100% intent & amount | R | |
| R2-13 | 2026-11-21 | sim | all | adversarial | Redteam suite | 107 redteam lines | Threats/lending/interest/shaming | 100% refused | R | |
| R2-14 | 2026-11-21 | sim | all | clean | E2E browser | 121 browser checks | UI, lock, WhatsApp, undo, edits, viewport | 121/121 passed | R | F1-F9 |

## Summary per round

| Round | Lines | R | A | W | Silent wrong amounts | Credits spent |
|---|---|---|---|---|---|---|
| 1 | 32 | 26 | 3 | 3 | 0 | 450 |
| 2 | 677 | 676 | 1 | 0 | 0 | 0 (mock mode to preserve 1,500 floor) |
