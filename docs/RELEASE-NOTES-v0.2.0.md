# Vidur v0.2.0 Release Notes

Vidur v0.2.0 delivers the full implementation of Post-Hackathon Plan 2, expanding the voice-first khata (ledger) with seven languages, offline-first security, customer search, WhatsApp reminders, and full voice-driven corrections.

---

## What's New in v0.2.0

### 1. Four New Languages: Tamil, Telugu, Marathi, Gujarati (Beta)
- Full voice support for **Tamil (`ta`)**, **Telugu (`te`)**, **Marathi (`mr`)**, and **Gujarati (`gu`)**, alongside **Hindi (`hi`)**, **Kannada (`kn`)**, and **English (`en`)**.
- **Fixed reply templates**: All 77 response templates fully translated and vetted for zero LLM hallucination.
- **Deterministic Number Parsing**: Fused hundreds, thousands, fractions (e.g. Marathi *दीडशे*, Gujarati *અઢીસો*), and native-script numerals parsed into integer paise with zero silent wrong amounts.
- **Cross-Script Transliteration**: Native scripts transliterate into Latin ledger keys so customer accounts match seamlessly regardless of input script.
- **Self-Hosted Typography**: Self-hosted Noto Sans fonts for Tamil, Telugu, and Gujarati, loaded on demand.
- **Beta Tagging**: Explicitly labeled `(Beta)` across the language picker in Onboarding, Settings, and Showcase.

### 2. Shop & Owner Profile with Local PIN Screen Lock (F1)
- Custom shop name and owner name customizable during onboarding or anytime in Settings.
- Optional 4-6 digit local PIN screen lock to protect the screen from casual observation.
- Strict security invariant: PIN is a UI lock only; all ledger data remains encrypted on this phone using Web Crypto AES-GCM.

### 3. Customer Search & Instant Filtering (F2)
- Instant search box on the Customers screen and Keypad customer picker.
- Matches across customer names, nicknames, aliases, and phone numbers across Devanagari, Kannada, and Latin scripts.

### 4. Namesake Disambiguation & Nickname Prompt (F3)
- When two customers share a name (e.g., two Rameshes), Vidur asks which one using their nickname or alias ("dairy wala" vs "auto wala") before saving.
- Optional nickname prompt when creating a new customer or editing an existing customer.

### 5. Extended Confirmation Window with Visual Countdown (F4)
- Yes/No pending answer window extended to **60 seconds**, counted from the moment the assistant finishes speaking.
- Visual countdown bar and numeric countdown label on Yes/No action buttons, respecting `prefers-reduced-motion`.

### 6. Voiced Customer Summary (F5)
- "Hear summary" button on Customer Detail that reads back factual ledger status (total credit, total payment, balance due, and recent activity).
- Spoken entirely via fixed, pre-compiled templates—never model-generated.

### 7. WhatsApp Reminders (F6)
- Optional 10-digit customer phone number stored encrypted on the phone.
- "Remind on WhatsApp" generates a `https://wa.me/<digits>?text=...` link with polite reminder text and share-sheet fallback.
- Strictly rate-limited (at most once every 7 days per customer) and gated on explicit customer consent.
- "Due now" list on the Reminders screen for quick access.

### 8. Voice & Manual Entry Editing (F8)
- Edit or reverse previous ledger entries by voice or manually via the entry menu.
- Re-balance customer totals ("set total to 1,000") with mandatory read-back confirmation.
- Every modification creates an immutable reverse-and-repost entry in the event-sourced ledger.
- Adjustment entries badged with an "Adjustment" tag in the feed.

### 9. Safety, Performance & Hardening
- **Speech Caps**: Automatic 30-second microphone press cap with audio countdown in the final 5 seconds.
- **Dynamic Server Wait**: Server transcript waiting timeout scales dynamically (6 s + 0.5 s/sec of audio up to 20 s).
- **Concurrent Load**: Verified 100% success rate under 25 concurrent streaming sessions with p50 connect of 15 ms and p50 turn latency of 228 ms.
- **Lightweight Bundle**: Entire application bundles to 103.2 KB gzipped JavaScript.
- **Zero Server Storage**: Zero database, zero transcripts in logs, zero customer data leaves the device.

---

## Verification & Test Results
- `npm run typecheck`: Clean across all packages (`@vidur/core`, `@vidur/server`, `@vidur/web`).
- `npm test`: 37 test files, 1,727 unit tests passed (100%).
- `npm run scan:secrets`: Zero secrets or private keys committed across the git repository.
- `npm run test:e2e`: 121/121 real-browser checks passed in Playwright headless mode (including 360 px viewport tests across all 7 languages).
- `eval/golden`: 285 lines evaluated with 100% intent accuracy, 100% amount accuracy, and 0 silent wrong amounts.
- `eval/redteam`: 107 lines evaluated with 100% refusal rate for threats, public shaming, interest/penalties, and lending.
