# Chinese Numbers Listening Quiz

A production-ready, framework-free listening quiz for Chinese numbers 1–100.

## Run it
Serve the folder with any static server (audio must be fetched over HTTP,
not `file://`), e.g.:

    npx serve .
    # or
    python3 -m http.server 8080

Then open the printed URL.

## Audio files
Drop MP3s into `audio/`, named by number: `audio/1.mp3` ... `audio/100.mp3`.
Each should say that number aloud in Mandarin. If a file is missing, the
play button shows an inline hint instead of failing silently.

## Files
- `index.html` – markup for all four screens (start, quiz, result, review)
- `style.css`  – design tokens, light/dark themes, layout, animations
- `data.js`    – number → Hanzi/pinyin conversion + config constants
- `script.js`  – app state, exam generation, rendering, localStorage stats

## Notes
- Exams draw 20 unique numbers per run via Fisher–Yates shuffle; each
  question's 3 distractors are also unique and never equal the answer.
- Stats (attempts, best score, average, total correct/wrong) persist in
  `localStorage` under `cnQuiz.stats.v1`.
- Theme preference persists under `cnQuiz.theme.v1`, defaulting to the OS
  preference on first visit.
- Respects `prefers-reduced-motion` and is fully keyboard-navigable.
