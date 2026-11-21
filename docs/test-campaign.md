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

Run on 2026-11-22 by Member C with `spikes/f7-round2.mjs`: Timbre speaks, Prisma listens (every third line with 10 dB white noise added), the core parser reads the transcript. **Machine voice, one synthetic voice per language, no human speaker and no real accent.** 48 lines: 12 each in Hindi (Devanagari), Hinglish (romanised, spoken by Timbre's hi-en voice), English and Kannada. The first run found two failures (listed first, both fixed); the table after them is the run on the fixed code. The earlier version of this table (R2-01 to R2-14) was written without running anything and is removed.

| # | Date | Speaker | Lang | Noise | Meant | Said | Heard | App did | Result | Tracker id |
|---|---|---|---|---|---|---|---|---|---|---|
| R2-hinglish-04 (first run) | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹350 | Kavita ka saade teen sau rupaye udhaar | कविता का सादे तीन सौ रुपये उधार। | Saved ₹300 credit with no question | **W, silent (P0)** | F7-1, fixed |
| R2-kn-12 (first run) | 2026-11-22 | machine voice (Timbre) | kn | 10 dB | credit ₹410 | ಮೋಹನ್ ನಾಲ್ಕು ನೂರು ಹತ್ತು ರೂಪಾಯಿ ಉಧಾರ | ಮೋಹನ್ ನಾಲ್ಕುನೂರು ಹತ್ತು ರೂಪಾಯಿ ಉದ್ಧಾರ. | Read ₹10, asked only for the direction | **W** | F7-2, fixed |
| R2-hi-01 | 2026-11-22 | machine voice (Timbre) | hi | clean | credit ₹340 | मोहन का तीन सौ चालीस रुपये उधार | मोहन का तीन सौ चालीस रुपये उधार। | Saved ₹340 credit | R |  |
| R2-hi-02 | 2026-11-22 | machine voice (Timbre) | hi | clean | payment ₹200 | सुनीता ने दो सौ रुपये जमा किए | सुनीता ने दो सौ रुपये जमा किए। | Saved ₹200 payment | R |  |
| R2-hi-03 | 2026-11-22 | machine voice (Timbre) | hi | 10 dB | credit ₹150 | रमेश का डेढ़ सौ रुपये उधार | रमेश का डेढ़ सौ रुपये उधार। | Saved ₹150 credit | R |  |
| R2-hi-04 | 2026-11-22 | machine voice (Timbre) | hi | clean | credit ₹350 | कविता का साढ़े तीन सौ रुपये उधार | कविता का साढ़े तीन सौ रुपये उधार। | Saved ₹350 credit | R |  |
| R2-hi-05 | 2026-11-22 | machine voice (Timbre) | hi | clean | credit ₹2,500 | अनिल का दो हज़ार पाँच सौ रुपये उधार | अनिल का दो हज़ार पाँच सौ रुपये उधार। | Saved ₹2,500 credit | R |  |
| R2-hi-06 | 2026-11-22 | machine voice (Timbre) | hi | 10 dB | payment ₹1,500 | विजय ने डेढ़ हज़ार रुपये दिए | विजय ने डेढ़ हज़ार रुपये दिए। | Saved ₹1,500 payment | R |  |
| R2-hi-07 | 2026-11-22 | machine voice (Timbre) | hi | clean | credit ₹12,000 | मोहन का बारह हज़ार रुपये उधार | मोहन का बारह हज़ार रुपये उधार। | Read back ₹12,000, nothing saved until yes | R |  |
| R2-hi-08 | 2026-11-22 | machine voice (Timbre) | hi | clean | credit ₹25 | सुनीता का पच्चीस रुपये उधार | सुनीता का पच्चीस रुपये उधार। | Saved ₹25 credit | R |  |
| R2-hi-09 | 2026-11-22 | machine voice (Timbre) | hi | 10 dB | credit ₹75 | दिनेश का पचहत्तर रुपये उधार | दिनेश का पचहत्तर रुपये उधार। | Saved ₹75 credit | R |  |
| R2-hi-10 | 2026-11-22 | machine voice (Timbre) | hi | clean | payment ₹500 | मोहन ने कल पाँच सौ रुपये जमा किए | मोहन ने कल पाँच सौ रुपये जमा किए। | Saved ₹500 payment | R |  |
| R2-hi-11 | 2026-11-22 | machine voice (Timbre) | hi | clean | credit ₹100,000 | अनिल का एक लाख रुपये उधार | अनिल का एक लाख रुपये उधार। | Read back ₹100,000, nothing saved until yes | R |  |
| R2-hi-12 | 2026-11-22 | machine voice (Timbre) | hi | 10 dB | credit ₹80 | रमेश का अस्सी रुपये उधार | रमेश का अस्सी रुपये उधार। | Saved ₹80 credit | R |  |
| R2-hinglish-01 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹340 | Mohan ka teen sau chalis rupaye udhaar | मोहन का तीन सौ चालीस रुपये उधार। | Saved ₹340 credit | R |  |
| R2-hinglish-02 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | payment ₹200 | Sunita ne do sau rupaye jama kiye | सुनीता ने दो सौ रुपये जमा किए। | Saved ₹200 payment | R |  |
| R2-hinglish-03 | 2026-11-22 | machine voice (Timbre) | hinglish | 10 dB | credit ₹150 | Ramesh ka dedh sau rupaye udhaar | रमेश का डेढ़ सौ रुपये उधार। | Saved ₹150 credit | R |  |
| R2-hinglish-04 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹350 | Kavita ka saade teen sau rupaye udhaar | कविता का सादे तीन सौ रुपये उधार। | Saved ₹350 credit | R |  |
| R2-hinglish-05 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹2,500 | Anil ka do hazaar paanch sau rupaye udhaar | अनिल का दो हज़ार पाँच सौ रुपये उधार। | Saved ₹2,500 credit | R |  |
| R2-hinglish-06 | 2026-11-22 | machine voice (Timbre) | hinglish | 10 dB | payment ₹1,500 | Vijay ne dedh hazaar rupaye diye | विजय ने डेढ़ हज़ार रुपये दिए। | Saved ₹1,500 payment | R |  |
| R2-hinglish-07 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹500 | Mohan ka paanch sau rupaye udhaar | मोहन का पाँच सौ रुपये उधार। | Saved ₹500 credit | R |  |
| R2-hinglish-08 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹70 | Sunita ka sattar rupaye udhaar | सुनीता का सत्तर रुपये उधार। | Saved ₹70 credit | R |  |
| R2-hinglish-09 | 2026-11-22 | machine voice (Timbre) | hinglish | 10 dB | credit ₹45 | Dinesh ka paintalis rupaye udhaar | दिनेश का पैंतालीस रुपये उधार। | Saved ₹45 credit | R |  |
| R2-hinglish-10 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | payment ₹100 | Ramesh ne kal sau rupaye jama kiye | रमेश ने कल सौ रुपये जमा किए। | Saved ₹100 payment | R |  |
| R2-hinglish-11 | 2026-11-22 | machine voice (Timbre) | hinglish | clean | credit ₹250 | Anil ka dhai sau rupaye udhaar | नील का ढाई सौ रुपये उधार। | Saved ₹250 credit | R |  |
| R2-hinglish-12 | 2026-11-22 | machine voice (Timbre) | hinglish | 10 dB | credit ₹1,200 | Mohan ka ek hazaar do sau rupaye udhaar | मोहन का एक हज़ार दो सौ रुपये उधार। | Saved ₹1,200 credit | R |  |
| R2-en-01 | 2026-11-22 | machine voice (Timbre) | en | clean | credit ₹340 | Mohan owes three hundred and forty rupees | Mohan owes 340 rupees. | Saved ₹340 credit | R |  |
| R2-en-02 | 2026-11-22 | machine voice (Timbre) | en | clean | payment ₹200 | Sunita paid two hundred rupees | Sunita paid 200 rupees. | Saved ₹200 payment | R |  |
| R2-en-03 | 2026-11-22 | machine voice (Timbre) | en | 10 dB | credit ₹150 | Ramesh took one hundred and fifty rupees on credit | Ramesh took 150 rupees on credit. | Saved ₹150 credit | R |  |
| R2-en-04 | 2026-11-22 | machine voice (Timbre) | en | clean | credit ₹2,500 | Kavita owes two thousand five hundred rupees | Kavita owes 2,500 rupees. | Saved ₹2,500 credit | R |  |
| R2-en-05 | 2026-11-22 | machine voice (Timbre) | en | clean | payment ₹1,500 | Anil paid fifteen hundred rupees | Anil paid 1,500 rupees. | Saved ₹1,500 payment | R |  |
| R2-en-06 | 2026-11-22 | machine voice (Timbre) | en | 10 dB | credit ₹12,000 | Vijay owes twelve thousand rupees | Vijay owes 12,000 rupees. | Read back ₹12,000, nothing saved until yes | R |  |
| R2-en-07 | 2026-11-22 | machine voice (Timbre) | en | clean | credit ₹80 | Mohan owes eighty rupees | Mohan owes 80 rupees. | Saved ₹80 credit | R |  |
| R2-en-08 | 2026-11-22 | machine voice (Timbre) | en | clean | payment ₹500 | Sunita paid five hundred rupees yesterday | Sunita paid 500 rupees yesterday. | Saved ₹500 payment | R |  |
| R2-en-09 | 2026-11-22 | machine voice (Timbre) | en | 10 dB | credit ₹75 | Dinesh owes seventy five rupees | Dinesh owes 75 rupees. | Saved ₹75 credit | R |  |
| R2-en-10 | 2026-11-22 | machine voice (Timbre) | en | clean | credit ₹100,000 | Ramesh owes one lakh rupees | Ramesh owes 1,00,000 rupees. | Read back ₹100,000, nothing saved until yes | R |  |
| R2-en-11 | 2026-11-22 | machine voice (Timbre) | en | clean | payment ₹250 | Anil paid two hundred and fifty rupees | Anil paid 250 rupees. | Saved ₹250 payment | R |  |
| R2-en-12 | 2026-11-22 | machine voice (Timbre) | en | 10 dB | credit ₹410 | Mohan owes four hundred and ten rupees | Mohan owes 410 rupees. | Saved ₹410 credit | R |  |
| R2-kn-01 | 2026-11-22 | machine voice (Timbre) | kn | clean | credit ₹340 | ಮೋಹನ್ ಮುನ್ನೂರು ನಲವತ್ತು ರೂಪಾಯಿ ಉಧಾರ | ಮೋಹನ್ ಮುನ್ನೂರು ನಲವತ್ತು ರೂಪಾಯಿ ಉದಾರ. | Saved ₹340 credit | R |  |
| R2-kn-02 | 2026-11-22 | machine voice (Timbre) | kn | clean | payment ₹200 | ಸುನೀತಾ ಇನ್ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು | ಸುನೀತಾ ಇನ್ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು. | Saved ₹200 payment | R |  |
| R2-kn-03 | 2026-11-22 | machine voice (Timbre) | kn | 10 dB | credit ₹150 | ರಮೇಶ್ ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಉಧಾರ | ರಮೇಶ್ ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಉದಾರ. | Saved ₹150 credit | R |  |
| R2-kn-04 | 2026-11-22 | machine voice (Timbre) | kn | clean | credit ₹2,500 | ಕವಿತಾ ಎರಡು ಸಾವಿರ ಐದು ನೂರು ರೂಪಾಯಿ ಉಧಾರ | ಕವಿತಾ ಎರಡು ಸಾವಿರ ಐದು ನೂರು ರೂಪಾಯಿ ಉದಾರ. | Saved ₹2,500 credit | R |  |
| R2-kn-05 | 2026-11-22 | machine voice (Timbre) | kn | clean | payment ₹1,500 | ಅನಿಲ್ ಒಂದು ಸಾವಿರ ಐದು ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು | ಅನಿಲ್ ಒಂದು ಸಾವಿರ ಐದುನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು. | Saved ₹1,500 payment | R |  |
| R2-kn-06 | 2026-11-22 | machine voice (Timbre) | kn | 10 dB | credit ₹12,000 | ವಿಜಯ್ ಹನ್ನೆರಡು ಸಾವಿರ ರೂಪಾಯಿ ಉಧಾರ | ವಿಜಯ್ ಹನ್ನೆರಡು ಸಾವಿರ ರೂಪಾಯಿ ಉದಾರ. | Read back ₹12,000, nothing saved until yes | R |  |
| R2-kn-07 | 2026-11-22 | machine voice (Timbre) | kn | clean | credit ₹80 | ಮೋಹನ್ ಎಂಬತ್ತು ರೂಪಾಯಿ ಉಧಾರ | ಮೋಹನ್ ಎಂಬತ್ತು ರೂಪಾಯಿ ಉದಾರ. | Saved ₹80 credit | R |  |
| R2-kn-08 | 2026-11-22 | machine voice (Timbre) | kn | clean | payment ₹500 | ಸುನೀತಾ ಐದು ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು | ಸುನೀತಾ ಐದು ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು. | Saved ₹500 payment | R |  |
| R2-kn-09 | 2026-11-22 | machine voice (Timbre) | kn | 10 dB | credit ₹75 | ದಿನೇಶ್ ಎಪ್ಪತ್ತೈದು ರೂಪಾಯಿ ಉಧಾರ | ದಿನೇಶ್ ಎಪ್ಪತ್ತೈದು ರೂಪಾಯಿ ಉದಾರ. | Saved ₹75 credit | R |  |
| R2-kn-10 | 2026-11-22 | machine voice (Timbre) | kn | clean | credit ₹100,000 | ರಮೇಶ್ ಒಂದು ಲಕ್ಷ ರೂಪಾಯಿ ಉಧಾರ | ರಮೇಶ್ ಒಂದು ಲಕ್ಷ ರೂಪಾಯಿ ಉದಾರ. | Read back ₹100,000, nothing saved until yes | R |  |
| R2-kn-11 | 2026-11-22 | machine voice (Timbre) | kn | clean | payment ₹250 | ಅನಿಲ್ ಇನ್ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಕೊಟ್ಟರು | ಅನಿಲ್ ಇನ್ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಕೊಟ್ಟರು. | Saved ₹250 payment | R |  |
| R2-kn-12 | 2026-11-22 | machine voice (Timbre) | kn | 10 dB | credit ₹410 | ಮೋಹನ್ ನಾಲ್ಕು ನೂರು ಹತ್ತು ರೂಪಾಯಿ ಉಧಾರ | ಮೋಹನ್ ಲಾಲ್ ಗೆ ನೂರು ಹತ್ತು ರೂಪಾಯಿ ಉದಾರ. | Saved ₹110 credit with no question | W |  |

The F9 synthetic pass (`spikes/f9-speech-pass.mjs`, 36 lines in ta, te, mr and gu, 2026-11-22) is logged in `progress.md`: one wrong amount on the first run (Marathi and Gujarati साडेतीन, fixed), 12 of 12 on the rerun.

What the table does not show: the last run has **one silent wrong amount (kn-12)**. Under 10 dB noise Prisma heard `ಮೋಹನ್ ಲಾಲ್ ಗೆ ನೂರು ಹತ್ತು` for "four hundred ten", which is a valid ₹110, so the parser cannot know. Vidur still speaks the saved amount back and offers Undo; no question comes before saving. Tracked as F7-3.

## Summary per round

| Round | Lines | R | A | W | Silent wrong amounts | Credits spent |
|---|---|---|---|---|---|---|
| 1 | 32 | 26 | 3 | 3 | 0 | 450 |
| 2 | 48 (+2 first-run failures) | 47 | 0 | 1 | 1 (kn-12, a speech-to-text mishearing under noise; the 2 first-run failures were parser bugs and are fixed) | about 8 audio minutes over two runs (about 40 to 120 credits at 5 to 15 per minute; balance not re-read) |
