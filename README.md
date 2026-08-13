# HSK Vocabulary Quiz

A production-ready, framework-free listening + reading quiz built from
`database.json` — an HSK 1–5 (+ Extra) Chinese vocabulary set with per-word
audio, categories, and example sentences.

## Run it
Serve the folder with any static server (audio and `database.json` must be
fetched over HTTP, not `file://`), e.g.:
  npx serve .  # or  python3 -m http.server 8080

Then open the printed URL.

## Audio files
Drop your MP3s into `audio/`, matching the `audio` path stored on each word
in `database.json` — e.g. `audio/电话.mp3`. If a file is missing, the
play button shows an inline hint instead of failing silently.

For **Listen mode** (see below), also drop the matching meaning MP3s into
`audioeng/` (English) and `audiobng/` (Bangla), using the **exact same
filename** as the Chinese file — e.g. Chinese `audio/电话.mp3` pairs with
`audioeng/电话.mp3` and `audiobng/电话.mp3`.

Listen mode follows the **Language** toggle on the home screen:

| Language selected | Playback order |
| --- | --- |
| বাংলা | `audio/` → `audiobng/` |
| English | `audio/` → `audioeng/` |

If a Bangla file is missing, it falls back to the English one for that word;
if neither exists, it shows a brief hint and moves on instead of getting stuck.

All clips are **preloaded while the previous one is still playing**, so the
Chinese → Bangla/English hand-off is effectively gapless (~45ms, i.e. no
audible pause) rather than waiting on a download.

## What's new in this update
- **Listen mode** — a third practice mode alongside Exam and Reading. Pick a
  level, category, order (serial/random), which batch of words, and how many
  times to repeat each word (1–10×, default 3×), then it plays every word's
  Chinese audio followed immediately by its Bangla or English audio (whichever
  language is selected), that many times, moving automatically to the next
  word — looping back to the first word once it reaches the end. Playback only
  stops when you tap Pause or Stop; nothing else interrupts it.
  Previous/Next buttons let you jump between words without waiting.
- **Listen batches** — in Listen mode the "How many words" row offers
  **10 / 10-20 / 20-30 / 30-40 / 40-50 / All**. Each option is a *slice* of the
  filtered word list (10 = words 1–10, 10-20 = words 11–20, and so on), so you
  can drill one batch at a time. Exam and Reading keep the plain
  10 / 20 / 30 / 50 / All counts.
- **Database-driven**: reads `database.json` (HSK 1–5 + Extra, ~3,960 words)
  instead of a fixed number range.
- **Level & category filters** on the home screen — pick one or more HSK
  levels, then narrow further by category (with a search box, since some
  levels have 40+ categories). Nothing is pre-selected when the page loads —
  pick a level, a mode, and a word count each visit.
- **Three practice modes**:
  - **Exam** — hear the audio, pick the matching word from four multiple-  choice options shown as English meanings only (numeric digits for the  Numbers category, e.g. "7" instead of "seven").
  - **Reading** — a paginated flashcard study mode. Each page shows 5 words  at once, with hanzi, pinyin, and the English meaning already visible  (no guessing), plus a play button per word. Audio does not auto-play —  tap any card to hear it.
  - **Listen** — hands-free Chinese → Bangla/English listening drill, described above.
- **Question count** is selectable (10 / 20 / 30 / 50 / **All**) for Exam and
  Reading — "All" uses every word in the filtered pool. Listen mode uses the
  batch ranges described above instead.
- **Mobile responsive**: header, chip rows, prompt card, reading cards,
  listen card/controls, and option grid all adapt down to small phone widths.

## Files
- `index.html` – markup for all five screens (start, quiz, reading, listen, result, review)
- `style.css`  – design tokens, light/dark themes, layout, animations
- `data.js`    – database loading, filtering, and exam/session-building helpers
- `script.js`  – app state, rendering, event wiring, localStorage stats
- `database.json` – the vocabulary source of truth

## Notes
- Exam questions draw unique words from the filtered pool; each question's 3
  distractors are also unique and never equal the answer.
- Reading sessions are ungraded — they're for study, not scoring.
- Stats (attempts, best score, average, total correct/wrong) persist in
  `localStorage` under `hskQuiz.stats.v1` and only track Exam mode results.
- Theme preference persists under `hskQuiz.theme.v1`, defaulting to the OS
  preference on first visit.
- Respects `prefers-reduced-motion` and is fully keyboard-navigable.
