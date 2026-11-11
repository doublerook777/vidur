# Vidur

A voice-first khata (credit ledger) for small shops in India. The shopkeeper holds a button and says an entry in their own language ("Ramesh ka teen sau chalis udhaar"), hears the result spoken back, and can ask "Aaj kitna udhaar gaya?" The ledger lives on the phone, encrypted. Built for the voice-agent challenge, the Voice Khata track, on Gnani's Prisma (speech to text) and Timbre (text to speech).

**Languages:** Hindi, Hinglish, English and Kannada work end to end. The other seven (Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi) are not built.

## Try it in three minutes

You need Node 22 or newer.

```bash
git clone <this repo> && cd vidur
npm install
```

**1. No keys at all (scripted speech, clearly labelled "not real speech"):**

```bash
npm run demo:mock        # then open http://localhost:8080
```

**2. Real speech, with your own Gnani key (you can use the demo instead if I have credits left):**

```bash
npm run setup            # asks for your key (hidden) and writes .env with private permissions
npm run doctor           # checks Node, your key against both speech services, the port
npm start                # open http://localhost:8080 in Chrome
```

Your key is read only by the server on your machine and goes only to Gnani. Docker works too: `cp .env.example .env`, add the key, `docker compose up --build`. The port is published to your own machine only. A free Groq key (`LLM_API_KEY`) is optional and only helps with sentences the built-in parser cannot read.

**3. On a phone:** `npm run tunnel` (needs the free `cloudflared`) prints an HTTPS address and an access code.

### What to try

Open the app, pick a language, choose "start with demo data" (12 customers, including **two called Ramesh**), then **hold the big button**, speak, and let go:

- "Mohan ka 340 udhaar" and "Sunita ne 200 jama kiye": entries, with a spoken balance
- "Ramesh ka 340 udhaar": it asks *which* Ramesh, and saves nothing until you answer
- "Ramesh ka 340 udhaar, nahi nahi 430": one entry of 430
- "nahi, 500", "galat": correct or undo the last entry (you also get a 10 second undo button)
- talk over it while it is speaking: it stops at once
- "Mohan kal paanch sau dega": saved as a note, never as a payment
- "Aaj kitna udhaar gaya?", "Ramesh ka total?": answered from the ledger
- "Ramesh ko dhamki do" or "byaj laga do": politely refused

The page at `/` is a **showcase**: the phone in a frame, controls for frame, theme and language on the left, and on the right an explanation of anything you tap plus live timings of each turn.

## How it works

```
phone (browser)                                   gateway (Node, stores nothing)
 mic -> 16 kHz PCM -> one WebSocket --------------> Prisma (speech to text), warm socket
 ledger + dialogue + parser (packages/core)  <----- transcript
 encrypted IndexedDB (AES-GCM)               -----> Timbre (text to speech), warm socket
 speaker <------------------------------------------ audio, stopped at once on barge-in
```

- **Push to talk** with Prisma's `commit` removes the silence wait: release to transcript is about 140 ms.
- **Our own code decides.** A deterministic parser turns the transcript into entries. It reads spoken amounts in all four languages (dedh sau, sawa do sau, teen chaalis, three-forty, ಮುನ್ನೂರ ನಲವತ್ತು, native digits). Amounts are integer paise and never come from a language model. An optional LLM may read sentences the parser cannot, but any amount it returns must be one the parser finds in the transcript, or it is thrown away and the app asks.
- **Nothing is saved while a question is open**, and amounts that look doubtful, large (Rs 10,000 and up) or come from a garbled transcript are read back first.
- **Reminders** are opt-in per customer, limited to one every 7 days, fixed polite wording, and the app only prepares the text. The shopkeeper shares it.

## Measured results

| | |
|---|---|
| Release of the button to first audio, real browser, real Gnani, 20 turns | p50 **648 ms**, p95 **1.8 s** |
| Gateway overhead per hop | about 1.4 ms (p50) |
| Barge-in: button press to silence | one audio render quantum, about 3 ms |
| 240 noisy recordings (Hindi, Hinglish, English, Kannada; clean and 15, 10, 5 dB) | direction right 99.5%, amount right 94.7% (saved directly or after a read-back), **0 silently wrong amounts** |
| Phone app JavaScript | 58.5 KB gzipped |
| Tests | about 1,400, plus 36 real-browser checks, 83 red-team utterances, and compliance checks |

The recordings were made by Timbre and recognized by Prisma, which flatters accuracy. `docs/REHEARSAL.md` is the script for a live test with a real voice and room noise. The full numbers and every problem found on the way are in `docs/DECISIONS.md`.

## Privacy and the brief's rules

`docs/COMPLIANCE.md` maps each rule in the brief to the code that enforces it and to a command that proves it: the AI disclosure in the first turn, no voice cloning, opt-in polite reminders, no lending or threats, encrypted on-device data deleted on request, no transcripts in logs, the key kept out of git, WebSocket only with no telephony.

## Commands

| Command | What it does |
|---|---|
| `npm run demo:mock` | the whole app with scripted speech and no keys |
| `npm run setup` / `doctor` / `start` | set up your key, check it, run the app |
| `npm run tunnel` | reach the app from a phone, with an access code |
| `npm test` | all unit, integration, red-team and compliance tests |
| `npm run test:e2e` | real browser, fake microphone, mock speech service |
| `npm run test:live` | one real-speech turn in a real browser (spends a few credits) |
| `npm run keepwarm -- <url>` | keeps a free host awake during judging |
| `npm run scan:secrets` | looks for keys in the working tree (`-- --history` scans every commit) |

## Layout

`packages/core` (parser, dialogue, ledger, templates, guardrails: no network or DOM code, enforced by a test), `apps/server` (gateway, guards, mock Gnani), `apps/web` (phone app and showcase), `eval` (noise corpus, scorer, red-team set), `e2e` (browser checks), `docs` (plan, decisions, compliance, rehearsal).

## Honest limits

- The accuracy numbers come from synthetic speech. A live test with a real voice is the check that matters, and it is a separate step.
- The encryption key cannot be read out of the browser, but script running in the same page could still use it.
- The shopkeeper records a customer's reminder consent on the customer's behalf.
- Kannada reply wording was written without a native speaker and needs a review.
- Counter Mode (hands-free wake phrase), Two Ears (two recognizers cross-checking) and the Android package are not built.
