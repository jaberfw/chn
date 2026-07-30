# HSK Vocabulary Quiz

A production-ready, framework-free listening + reading quiz built from
`database.json` — an HSK 1–5 (+ extra) Chinese vocabulary set with per-word
audio, categories, and example sentences.

## Run it
Serve the folder with any static server (audio and `database.json` must be
fetched over HTTP, not `file://`), e.g.:

    npx serve .
    # or
    python3 -m http.server 8080

Then open the printed URL.

## Audio files
Drop your MP3s into `audio/`, matching the `audio` path stored on each word
in `database.json` — e.g. `audio/hsk1/电话.mp3`. If a file is missing, the
play button shows an inline hint instead of failing silently.

## What's new in this update
- **Database-driven**: reads `database.json` (HSK 1–5 + extra, ~3,960 words)
  instead of a fixed number range.
- **Level & category filters** on the home screen — pick one or more HSK
  levels, then narrow further by category (with a search box, since some
  levels have 40+ categories). Nothing is pre-selected when the page loads —
  pick a level, a mode, and a word count each visit.
- **Two practice modes**:
  - **Exam** — hear the audio, pick the matching word from four multiple-
    choice options shown as English meanings only (numeric digits for the
    Numbers category, e.g. "7" instead of "seven").
  - **Reading** — a paginated flashcard study mode. Each page shows 5 words
    at once, with hanzi, pinyin, and the English meaning already visible
    (no guessing), plus a play button per word. Audio does not auto-play —
    tap any card to hear it.
- **Question count** is selectable (10 / 20 / 30 / 50 / **All**) and applies
  to both modes — "All" uses every word in the filtered pool.
- **Mobile responsive**: header, chip rows, prompt card, reading cards, and
  option grid all adapt down to small phone widths.

## Files
- `index.html` – markup for all four screens (start, quiz, result, review)
- `style.css`  – design tokens, light/dark themes, layout, animations
- `data.js`    – database loading, filtering, and exam-generation helpers
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
