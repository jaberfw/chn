/* ==========================================================================
   script.js
   All behaviour for the Chinese Numbers Listening Quiz. Depends on the pure
   helpers + constants defined in data.js (loaded first in index.html).
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * DOM references
   * ------------------------------------------------------------------ */
  const $ = (selector) => document.querySelector(selector);

  const screens = {
    start: $('#screen-start'),
    quiz: $('#screen-quiz'),
    result: $('#screen-result'),
    review: $('#screen-review'),
  };

  const el = {
    themeToggle: $('#theme-toggle'),
    startBtn: $('#start-btn'),
    rangeFrom: $('#range-from'),
    rangeTo: $('#range-to'),
    rangeError: $('#range-error'),

    statAttempts: $('#stat-attempts'),
    statBest: $('#stat-best'),
    statAverage: $('#stat-average'),
    statCorrect: $('#stat-total-correct'),
    statWrong: $('#stat-total-wrong'),

    progressLabel: $('#progress-label'),
    progressFill: $('#progress-fill'),
    playBtn: $('#play-btn'),
    playHint: $('#play-hint'),
    optionsGrid: $('#options-grid'),
    feedback: $('#feedback'),
    feedbackText: $('#feedback-text'),
    stamp: $('#stamp'),
    nextBtn: $('#next-btn'),
    quitBtn: $('#quit-btn'),

    resultScore: $('#result-score'),
    resultCorrect: $('#result-correct'),
    resultWrong: $('#result-wrong'),
    resultPercent: $('#result-percent'),
    resultRing: $('#result-ring'),
    resultBest: $('#result-best-note'),
    retryBtn: $('#retry-btn'),
    newExamBtn: $('#new-exam-btn'),
    reviewBtn: $('#review-btn'),
    homeBtn: $('#home-btn'),

    reviewList: $('#review-list'),
    reviewBackBtn: $('#review-back-btn'),
  };

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const state = {
    range: { ...DEFAULT_RANGE }, // { min, max } — chosen on the start screen
    questions: [],   // [{ number, options:[{value,hanzi,pinyin}], correctValue }]
    index: 0,
    answers: [],   // [{ number, correctValue, chosenValue, isCorrect }]
    locked: false,   // true once the current question has been answered
  };

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */

  /** Fisher-Yates shuffle. Returns a new array; does not mutate input. */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Picks `count` unique random integers in [min, max], excluding any in `exclude`. */
  function pickUniqueNumbers(count, min, max, exclude = []) {
    const excluded = new Set(exclude);
    const pool = [];
    for (let n = min; n <= max; n += 1) {
      if (!excluded.has(n)) pool.push(n);
    }
    return shuffle(pool).slice(0, count);
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => {
      const active = key === name;
      node.classList.toggle('active', active);
      node.hidden = !active;
    });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ------------------------------------------------------------------ *
   * Stats persistence
   * ------------------------------------------------------------------ */
  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATS, ...parsed };
    } catch {
      return { ...DEFAULT_STATS };
    }
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch {
      /* localStorage unavailable (private mode, quota, etc.) — fail silently */
    }
  }

  function recordExamResult(correctCount, wrongCount) {
    const stats = loadStats();
    const percent = Math.round((correctCount / QUESTIONS_PER_EXAM) * 100);

    stats.attempts += 1;
    stats.totalCorrect += correctCount;
    stats.totalWrong += wrongCount;
    stats.scoreSum += percent;
    stats.bestScore = Math.max(stats.bestScore, percent);

    saveStats(stats);
    return { stats, percent };
  }

  function syncRangeInputs() {
    el.rangeFrom.value = state.range.min;
    el.rangeTo.value = state.range.max;
  }

  function renderStartStats() {
    const stats = loadStats();
    const average = stats.attempts > 0 ? Math.round(stats.scoreSum / stats.attempts) : 0;
    el.statAttempts.textContent = stats.attempts;
    el.statBest.textContent = `${stats.bestScore}%`;
    el.statAverage.textContent = `${average}%`;
    el.statCorrect.textContent = stats.totalCorrect;
    el.statWrong.textContent = stats.totalWrong;
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    el.themeToggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }

  function initTheme() {
    let theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!theme) {
      theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ *
   * Exam generation
   * ------------------------------------------------------------------ */

  /**
   * Validates the from/to values on the start screen.
   * @returns {{ok:true, range:{min:number,max:number}}|{ok:false, message:string}}
   */
  function readAndValidateRange() {
    const from = Math.trunc(Number(el.rangeFrom.value));
    const to = Math.trunc(Number(el.rangeTo.value));

    if (Number.isNaN(from) || Number.isNaN(to)) {
      return { ok: false, message: 'Enter whole numbers for both fields.' };
    }
    if (from < RANGE_BOUNDS.min || to > RANGE_BOUNDS.max) {
      return { ok: false, message: `Range must stay within ${RANGE_BOUNDS.min}–${RANGE_BOUNDS.max}.` };
    }
    if (from >= to) {
      return { ok: false, message: '"From" must be smaller than "To".' };
    }
    if (to - from + 1 < QUESTIONS_PER_EXAM) {
      return { ok: false, message: `Pick a range covering at least ${QUESTIONS_PER_EXAM} numbers.` };
    }
    return { ok: true, range: { min: from, max: to } };
  }

  /** Builds a fresh set of QUESTIONS_PER_EXAM unique questions from state.range. */
  function generateExam() {
    const { min, max } = state.range;
    const chosenNumbers = pickUniqueNumbers(QUESTIONS_PER_EXAM, min, max);

    state.questions = chosenNumbers.map((correctValue) => {
      const wrongValues = pickUniqueNumbers(OPTIONS_PER_QUESTION - 1, min, max, [correctValue]);
      const options = shuffle([correctValue, ...wrongValues]).map(describeNumber);
      return { number: correctValue, options, correctValue };
    });

    state.index = 0;
    state.answers = [];
    state.locked = false;
  }

  /* ------------------------------------------------------------------ *
   * Quiz rendering
   * ------------------------------------------------------------------ */
  function currentQuestion() {
    return state.questions[state.index];
  }

  function renderQuestion() {
    const q = currentQuestion();
    state.locked = false;

    el.progressLabel.textContent = `Question ${state.index + 1} of ${QUESTIONS_PER_EXAM}`;
    el.progressFill.style.width = `${(state.index / QUESTIONS_PER_EXAM) * 100}%`;

    el.feedback.hidden = true;
    el.feedback.className = 'feedback';
    el.stamp.className = 'stamp';
    el.nextBtn.disabled = true;
    el.playHint.textContent = 'Press play, then choose the number you hear.';

    el.optionsGrid.innerHTML = '';
    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.setAttribute('data-value', String(opt.value));
      btn.setAttribute('aria-label', `Answer option: ${opt.value}`);
      btn.innerHTML = `<span class="option-value">${opt.value}</span>`;
      btn.addEventListener('click', () => handleAnswer(opt.value, btn));
      el.optionsGrid.appendChild(btn);
    });

    el.playBtn.focus({ preventScroll: true });
    playCurrentAudio();
  }

  function playCurrentAudio() {
    const q = currentQuestion();
    const audio = new Audio(AUDIO_PATH(q.number));
    el.playBtn.classList.add('playing');
    audio.addEventListener('ended', () => el.playBtn.classList.remove('playing'));
    audio.play().catch((err) => {
        console.error("Audio error:", err);
        console.error("Source:", audio.src);

        el.playHint.textContent = err.message;
    });
  }

  function handleAnswer(chosenValue, buttonEl) {
    if (state.locked) return;
    state.locked = true;

    const q = currentQuestion();
    const isCorrect = chosenValue === q.correctValue;

    state.answers.push({
      number: q.number,
      correctValue: q.correctValue,
      chosenValue,
      isCorrect,
    });

    const buttons = Array.from(el.optionsGrid.children);
    buttons.forEach((btn) => {
      btn.disabled = true;
      const value = Number(btn.getAttribute('data-value'));
      if (value === q.correctValue) btn.classList.add('is-correct');
      if (value === chosenValue && !isCorrect) btn.classList.add('is-wrong');
    });

    const info = describeNumber(q.correctValue);
    el.feedback.hidden = false;
    el.feedback.className = `feedback ${isCorrect ? 'feedback--correct' : 'feedback--wrong'}`;
    el.feedbackText.textContent = isCorrect
      ? `Correct! ${info.value} is ${info.hanzi} (${info.pinyin}).`
      : `Not quite. ${info.value} is ${info.hanzi} (${info.pinyin}).`;

    el.stamp.textContent = isCorrect ? '对' : '错';
    el.stamp.className = `stamp stamp--show ${isCorrect ? 'stamp--correct' : 'stamp--wrong'}`;

    el.nextBtn.disabled = false;
    el.nextBtn.focus({ preventScroll: true });

    if (buttonEl) buttonEl.classList.add('is-selected');
  }

  function handleNext() {
    state.index += 1;
    if (state.index >= QUESTIONS_PER_EXAM) {
      finishExam();
    } else {
      renderQuestion();
    }
  }

  /* ------------------------------------------------------------------ *
   * Results
   * ------------------------------------------------------------------ */
  function finishExam() {
    const correctCount = state.answers.filter((a) => a.isCorrect).length;
    const wrongCount = QUESTIONS_PER_EXAM - correctCount;
    const { stats, percent } = recordExamResult(correctCount, wrongCount);

    el.resultScore.textContent = `${correctCount} / ${QUESTIONS_PER_EXAM}`;
    el.resultCorrect.textContent = correctCount;
    el.resultWrong.textContent = wrongCount;
    el.resultPercent.textContent = `${percent}%`;

    const circumference = 2 * Math.PI * 54;
    el.resultRing.style.strokeDasharray = `${circumference}`;
    el.resultRing.style.strokeDashoffset = `${circumference * (1 - percent / 100)}`;

    el.resultBest.textContent =
      percent >= stats.bestScore && percent > 0
        ? 'New personal best — 恭喜 (congratulations)!'
        : `Personal best so far: ${stats.bestScore}%`;

    renderStartStats();
    showScreen('result');
  }

  /* ------------------------------------------------------------------ *
   * Review
   * ------------------------------------------------------------------ */
  function renderReview() {
    el.reviewList.innerHTML = '';
    state.answers.forEach((answer, i) => {
      const correctInfo = describeNumber(answer.correctValue);
      const chosenInfo = describeNumber(answer.chosenValue);

      const item = document.createElement('li');
      item.className = `review-item ${answer.isCorrect ? 'review-item--correct' : 'review-item--wrong'}`;

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'review-play-btn';
      replayBtn.setAttribute('aria-label', `Replay audio for question ${i + 1}`);
      replayBtn.textContent = '▶';
      replayBtn.addEventListener('click', () => {
        new Audio(AUDIO_PATH(answer.number)).play().catch(() => {});
      });

      const details = document.createElement('div');
      details.className = 'review-details';
      details.innerHTML = `
        <span class="review-index">Q${i + 1}</span>
        <span class="review-correct">${correctInfo.hanzi} · ${correctInfo.pinyin} (${correctInfo.value})</span>
        ${
          answer.isCorrect
            ? '<span class="review-tag review-tag--correct">Correct</span>'
            : `<span class="review-tag review-tag--wrong">Your answer: ${chosenInfo.hanzi} (${chosenInfo.value})</span>`
        }
      `;

      item.appendChild(replayBtn);
      item.appendChild(details);
      el.reviewList.appendChild(item);
    });
    showScreen('review');
  }

  /* ------------------------------------------------------------------ *
   * Exam lifecycle actions
   * ------------------------------------------------------------------ */
  function startNewExam() {
    const result = readAndValidateRange();
    if (!result.ok) {
      el.rangeError.textContent = result.message;
      el.rangeError.hidden = false;
      return;
    }
    el.rangeError.hidden = true;
    state.range = result.range;
    generateExam();
    showScreen('quiz');
    renderQuestion();
  }

  /** Draws a brand-new random exam from the *same* range as the last one (used by the result screen). */
  function startAnotherExamSameRange() {
    generateExam();
    showScreen('quiz');
    renderQuestion();
  }

  function retrySameExam() {
    // Re-run the exact same 20 numbers, but reshuffle each question's options.
    state.questions = state.questions.map((q) => ({
      ...q,
      options: shuffle(q.options),
    }));
    state.index = 0;
    state.answers = [];
    state.locked = false;
    showScreen('quiz');
    renderQuestion();
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function bindEvents() {
    el.themeToggle.addEventListener('click', toggleTheme);
    el.startBtn.addEventListener('click', startNewExam);

    el.playBtn.addEventListener('click', playCurrentAudio);
    el.nextBtn.addEventListener('click', handleNext);
    el.quitBtn.addEventListener('click', () => {
      syncRangeInputs();
      showScreen('start');
      renderStartStats();
    });

    el.retryBtn.addEventListener('click', retrySameExam);
    el.newExamBtn.addEventListener('click', startAnotherExamSameRange);
    el.reviewBtn.addEventListener('click', renderReview);
    el.homeBtn.addEventListener('click', () => {
      syncRangeInputs();
      showScreen('start');
      renderStartStats();
    });
    el.reviewBackBtn.addEventListener('click', () => showScreen('result'));

    // Keyboard: space/enter on the play button replays audio (native button
    // behaviour already covers this, but Space is explicitly supported here
    // in case of custom focus styles interfering with default handling).
    el.playBtn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') playCurrentAudio();
    });
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  function init() {
    initTheme();
    bindEvents();
    renderStartStats();
    showScreen('start');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
