# Eval results — eval/results/raw/base.jsonl

## Overall

| Metric | Value |
|---|---|
| Records | 240 |
| Intent right | 232/240 (96.7%) |
| Direction right (credit/payment) | 207/208 (99.5%) |
| Amount exact | 182/208 (87.5%) |
| Amount asked (instead of guessing) | 18/208 (8.7%) |
| Silent wrong amount | 3/208 (1.4%) |
| No result (got null) | 0/240 (0.0%) |
| STT latency p50 | 134 ms |
| STT latency p95 | 7251 ms |
| End-to-end p50 | — ms |
| End-to-end p95 | — ms |

## By language × SNR

| lang | snr | n | intent right | direction right | amount exact | amount asked | silent wrong | no result | stt p50 | stt p95 | e2e p50 | e2e p95 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| hi | clean | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 13/13 (100.0%) | 0/13 (0.0%) | 0 | 0 | 132 | 7042 | — | — |
| hi | 15 | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 13/13 (100.0%) | 0/13 (0.0%) | 0 | 0 | 126 | 10760 | — | — |
| hi | 10 | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 13/13 (100.0%) | 0/13 (0.0%) | 0 | 0 | 127 | 15206 | — | — |
| hi | 5 | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 12/13 (92.3%) | 0/13 (0.0%) | 1 | 0 | 127 | 15485 | — | — |
| hinglish | clean | 15 | 14/15 (93.3%) | 13/13 (100.0%) | 9/13 (69.2%) | 4/13 (30.8%) | 0 | 0 | 132 | 7026 | — | — |
| hinglish | 15 | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 9/13 (69.2%) | 4/13 (30.8%) | 0 | 0 | 128 | 12128 | — | — |
| hinglish | 10 | 15 | 14/15 (93.3%) | 13/13 (100.0%) | 9/13 (69.2%) | 4/13 (30.8%) | 0 | 0 | 131 | 4581 | — | — |
| hinglish | 5 | 15 | 14/15 (93.3%) | 13/13 (100.0%) | 10/13 (76.9%) | 3/13 (23.1%) | 0 | 0 | 124 | 10940 | — | — |
| en | clean | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 13/13 (100.0%) | 0/13 (0.0%) | 0 | 0 | 129 | 4656 | — | — |
| en | 15 | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 12/13 (92.3%) | 0/13 (0.0%) | 0 | 0 | 135 | 7284 | — | — |
| en | 10 | 15 | 14/15 (93.3%) | 13/13 (100.0%) | 13/13 (100.0%) | 0/13 (0.0%) | 0 | 0 | 136 | 4540 | — | — |
| en | 5 | 15 | 14/15 (93.3%) | 13/13 (100.0%) | 11/13 (84.6%) | 0/13 (0.0%) | 2 | 0 | 131 | 13076 | — | — |
| kn | clean | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 12/13 (92.3%) | 0/13 (0.0%) | 0 | 0 | 171 | 7097 | — | — |
| kn | 15 | 15 | 15/15 (100.0%) | 13/13 (100.0%) | 12/13 (92.3%) | 0/13 (0.0%) | 0 | 0 | 163 | 11854 | — | — |
| kn | 10 | 15 | 14/15 (93.3%) | 13/13 (100.0%) | 10/13 (76.9%) | 2/13 (15.4%) | 0 | 0 | 156 | 244 | — | — |
| kn | 5 | 15 | 13/15 (86.7%) | 12/13 (92.3%) | 11/13 (84.6%) | 1/13 (7.7%) | 0 | 0 | 168 | 14109 | — | — |

## Silent wrongs

- id=C-0007__Avinash__snr5 heard="रमेश का तीन सौ चालीस उधार, तीन ढाई सौ चार सौ।" expected={"intent":"credit_entry","amount":430,"customer":"Ramesh"} got={"intent":"credit_entry","amountPaise":34000,"needs":[],"customer":"रमेश"}
- id=C-0032__Shivani__snr5 heard="Ramesh 5,000 is Hindu. In English, Ramesh 2,500 credits." expected={"intent":"credit_entry","amount":2500,"customer":"Ramesh"} got={"intent":"credit_entry","amountPaise":500000,"needs":["direction"],"customer":"Ramesh"}
- id=C-0040__Shivani__snr5 heard="1225 credit" expected={"intent":"credit_entry","amount":125,"customer":"Ajay"} got={"intent":"credit_entry","amountPaise":122500,"needs":["customer"]}

SILENT WRONG: 3
