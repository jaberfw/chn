/* ==========================================================================
   script.js
   All behaviour for the HSK Vocabulary Quiz. Depends on the pure helpers +
   constants defined in data.js (loaded first in index.html).
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
    reading: $('#screen-reading'),
    result: $('#screen-result'),
    review: $('#screen-review'),
  };

  const el = {
    themeToggle: $('#theme-toggle'),

    dbLoading: $('#db-loading'),
    dbError: $('#db-error'),
    setup: $('#setup'),

    levelChips: $('#level-chips'),
    categoryChips: $('#category-chips'),
    categoryFilter: $('#category-filter'),
    catToggleAll: $('#cat-toggle-all'),
    modeToggle: $('#mode-toggle'),
    modeHint: $('#mode-hint'),
    orderToggle: $('#order-toggle'),
    countChips: $('#count-chips'),
    poolInfo: $('#pool-info'),
    setupError: $('#setup-error'),
    startBtn: $('#start-btn'),

    statAttempts: $('#stat-attempts'),
    statBest: $('#stat-best'),
    statAverage: $('#stat-average'),
    statCorrect: $('#stat-total-correct'),
    statWrong: $('#stat-total-wrong'),

    progressLabel: $('#progress-label'),
    progressFill: $('#progress-fill'),
    quizLevelTag: $('#quiz-level-tag'),

    listenZone: $('#listen-zone'),
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

    readingProgressLabel: $('#reading-progress-label'),
    readingProgressFill: $('#reading-progress-fill'),
    readingCards: $('#reading-cards'),
    readingPrevBtn: $('#reading-prev-btn'),
    readingNextBtn: $('#reading-next-btn'),
    readingQuitBtn: $('#reading-quit-btn'),
  };

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const state = {
    db: null,               // full database (words + levels meta)
    levels: new Set(),      // selected level keys, e.g. {'1','2'} — empty until the learner picks one
    allCategoriesForLevels: [], // category slugs available for the current level selection
    categories: new Set(),  // selected category slugs (subset of allCategoriesForLevels)
    mode: null,             // null | 'exam' | 'reading' — nothing selected until the learner picks one
    order: 'random',        // 'random' | 'serial' — order questions/cards are presented in
    questionCount: null,    // null | 10 | 20 | 30 | 50 | 'all'

    pool: [],       // words matching current level+category filters
    questions: [],  // built exam: [{word, options, correctKey}]
    index: 0,
    answers: [],    // [{word, correctKey, chosenKey, isCorrect}]
    locked: false,

    readingWords: [],    // words for the current Reading session
    readingIndex: 0,     // current page index (0-based)
    readingAudioToken: 0, // bumped to cancel a card's in-flight audio when the page changes
  };

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */
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
      /* localStorage unavailable — fail silently */
    }
  }

  function recordExamResult(correctCount, totalCount, wrongCount) {
    const stats = loadStats();
    const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    stats.attempts += 1;
    stats.totalCorrect += correctCount;
    stats.totalWrong += wrongCount;
    stats.scoreSum += percent;
    stats.bestScore = Math.max(stats.bestScore, percent);

    saveStats(stats);
    return { stats, percent };
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
   * Setup screen: level / category / mode / count chips
   * ------------------------------------------------------------------ */
  function renderLevelChips() {
    el.levelChips.innerHTML = '';
    LEVEL_ORDER.filter((lvl) => (state.db.levels[lvl] || 0) > 0).forEach((lvl) => {
      const count = state.db.levels[lvl] || 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.level = lvl;
      btn.setAttribute('aria-pressed', String(state.levels.has(lvl)));
      btn.classList.toggle('is-active', state.levels.has(lvl));
      btn.innerHTML = `${levelLabel(lvl)} <span class="chip-count">${count}</span>`;
      btn.addEventListener('click', () => toggleLevel(lvl));
      el.levelChips.appendChild(btn);
    });
  }

  function toggleLevel(lvl) {
    if (state.levels.has(lvl)) {
      if (state.levels.size === 1) return; // keep at least one level selected
      state.levels.delete(lvl);
    } else {
      state.levels.add(lvl);
    }
    refreshCategoriesForLevels();
    renderLevelChips();
    renderCategoryChips();
    updatePoolInfo();
  }

  function refreshCategoriesForLevels() {
    const levelWords = wordsForLevels(state.db.words, state.levels);
    state.allCategoriesForLevels = categoriesInWords(levelWords);
    // Keep only still-valid selected categories. Nothing is auto-selected here —
    // an empty selection just means "no category filter yet" (see currentPool()),
    // so category chips stay unchecked until the learner picks one.
    const stillValid = new Set(state.allCategoriesForLevels);
    state.categories.forEach((c) => {
      if (!stillValid.has(c)) state.categories.delete(c);
    });
  }

  function renderCategoryChips() {
    const filterText = (el.categoryFilter.value || '').trim().toLowerCase();
    el.categoryChips.innerHTML = '';

    const levelWords = wordsForLevels(state.db.words, state.levels);
    const counts = {};
    levelWords.forEach((w) => {
      const c = w.category || 'uncategorized';
      counts[c] = (counts[c] || 0) + 1;
    });

    const visible = state.allCategoriesForLevels.filter((c) =>
      !filterText || prettyCategory(c).toLowerCase().includes(filterText)
    );

    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'category-empty';
      empty.textContent = state.levels.size === 0
        ? 'Pick a level above to see its categories.'
        : 'No categories match your filter.';
      el.categoryChips.appendChild(empty);
      return;
    }

    visible.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip chip--sm';
      btn.dataset.category = cat;
      const active = state.categories.has(cat);
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
      btn.innerHTML = `${prettyCategory(cat)} <span class="chip-count">${counts[cat] || 0}</span>`;
      btn.addEventListener('click', () => toggleCategory(cat));
      el.categoryChips.appendChild(btn);
    });

    updateCatToggleLabel();
  }

  function toggleCategory(cat) {
    if (state.categories.has(cat)) {
      state.categories.delete(cat);
    } else {
      state.categories.add(cat);
    }
    renderCategoryChips();
    updatePoolInfo();
  }

  function updateCatToggleLabel() {
    const allSelected = state.allCategoriesForLevels.every((c) => state.categories.has(c));
    el.catToggleAll.textContent = allSelected ? 'Clear all' : 'Select all';
  }

  function handleCatToggleAll() {
    const allSelected = state.allCategoriesForLevels.every((c) => state.categories.has(c));
    if (allSelected) {
      state.categories.clear();
    } else {
      state.allCategoriesForLevels.forEach((c) => state.categories.add(c));
    }
    renderCategoryChips();
    updatePoolInfo();
  }

  function renderCountChips() {
    el.countChips.innerHTML = '';
    QUESTION_COUNT_CHOICES.forEach((count) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.count = String(count);
      const active = state.questionCount === count;
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.toggle('is-active', active);
      btn.textContent = count === 'all' ? 'All' : String(count);
      btn.addEventListener('click', () => {
        state.questionCount = count;
        renderCountChips();
        updatePoolInfo();
      });
      el.countChips.appendChild(btn);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    Array.from(el.modeToggle.children).forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    if (mode === 'reading') {
      el.modeHint.textContent = 'See each word with its pinyin and meaning — 5 per page. Tap a card to hear it.';
      el.startBtn.textContent = 'Start reading';
    } else if (mode === 'exam') {
      el.modeHint.textContent = 'Listen to the audio, then pick the matching word.';
      el.startBtn.textContent = 'Start exam';
    } else {
      el.modeHint.textContent = 'Choose a mode to continue.';
      el.startBtn.textContent = 'Start';
    }
    updatePoolInfo();
  }

  function setOrder(order) {
    state.order = order;
    Array.from(el.orderToggle.children).forEach((btn) => {
      const active = btn.dataset.order === order;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  function currentPool() {
    const levelWords = wordsForLevels(state.db.words, state.levels);
    // No category chips checked, or every one checked, both mean "no filter" —
    // the difference is purely visual (chips aren't pre-checked on load/level change).
    const noFilter = state.categories.size === 0 || state.categories.size === state.allCategoriesForLevels.length;
    const catSet = noFilter ? null : state.categories;
    return wordsForCategories(levelWords, catSet);
  }

  function updatePoolInfo() {
    state.pool = currentPool();
    const size = state.pool.length;

    if (state.levels.size === 0) {
      el.poolInfo.textContent = 'Pick at least one level to continue.';
      el.startBtn.disabled = true;
      return;
    }
    if (!state.mode) {
      el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match. Choose a mode to continue.`;
      el.startBtn.disabled = true;
      return;
    }
    if (!state.questionCount) {
      el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match. Choose how many words to practice.`;
      el.startBtn.disabled = true;
      return;
    }

    const minNeeded = state.mode === 'exam' ? MIN_POOL_SIZE : 1;
    if (size < minNeeded) {
      el.poolInfo.textContent = `${size} word${size === 1 ? '' : 's'} match — need at least ${minNeeded} to start.`;
      el.startBtn.disabled = true;
      return;
    }

    const requested = state.questionCount === 'all' ? size : state.questionCount;
    const usable = Math.min(requested, size);
    el.poolInfo.textContent = usable < requested
      ? `${size} words match — session will use all ${usable} of them.`
      : `${size} words match this selection.`;
    el.startBtn.disabled = false;
  }

  /* ------------------------------------------------------------------ *
   * Setup init
   * ------------------------------------------------------------------ */
  function initSetup() {
    // Nothing is pre-selected when the main page loads — the learner picks
    // level(s), a mode, and a question count from scratch each visit.
    state.levels = new Set();
    state.categories = new Set();
    state.allCategoriesForLevels = [];
    state.mode = null;
    state.questionCount = null;

    renderLevelChips();
    renderCategoryChips();
    renderCountChips();
    setMode(null);
    setOrder('random');
    updatePoolInfo();
  }

  /* ------------------------------------------------------------------ *
   * Quiz rendering
   * ------------------------------------------------------------------ */
  function currentQuestion() {
    return state.questions[state.index];
  }

  function audioFor(word) {
    return new Audio(word.audio);
  }

  function renderQuestion() {
    const q = currentQuestion();
    state.locked = false;
    const total = state.questions.length;

    el.progressLabel.textContent = `Question ${state.index + 1} of ${total}`;
    el.progressFill.style.width = `${(state.index / total) * 100}%`;
    el.quizLevelTag.textContent = levelLabel(q.word.level);

    el.feedback.hidden = true;
    el.feedback.className = 'feedback';
    el.stamp.className = 'stamp';
    el.nextBtn.disabled = true;
    el.playHint.textContent = 'Press play, then choose the word you hear.';

    el.optionsGrid.innerHTML = '';
    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.setAttribute('data-key', opt.key);
      btn.setAttribute('aria-label', `Answer option: ${opt.meaning}`);
      btn.innerHTML = `<span class="option-value">${escapeHtml(opt.meaning)}</span>`;
      btn.addEventListener('click', () => handleAnswer(opt.key, btn));
      el.optionsGrid.appendChild(btn);
    });

    el.playBtn.focus({ preventScroll: true });
    playCurrentAudio();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function playCurrentAudio() {
    const q = currentQuestion();
    const audio = audioFor(q.word);
    el.playBtn.classList.add('playing');
    audio.addEventListener('ended', () => el.playBtn.classList.remove('playing'));
    audio.play().catch((err) => {
      el.playBtn.classList.remove('playing');
      el.playHint.textContent = `Audio unavailable (${q.word.audio}).`;
      console.error('Audio error:', err, 'Source:', audio.src);
    });
  }

  function handleAnswer(chosenKey, buttonEl) {
    if (state.locked) return;
    state.locked = true;

    const q = currentQuestion();
    const isCorrect = chosenKey === q.correctKey;

    state.answers.push({
      word: q.word,
      correctKey: q.correctKey,
      chosenKey,
      isCorrect,
    });

    const buttons = Array.from(el.optionsGrid.children);
    buttons.forEach((btn) => {
      btn.disabled = true;
      const key = btn.getAttribute('data-key');
      if (key === q.correctKey) btn.classList.add('is-correct');
      if (key === chosenKey && !isCorrect) btn.classList.add('is-wrong');
    });

    el.stamp.textContent = isCorrect ? 'CORRECT' : 'WRONG';
    el.stamp.className = `stamp stamp--show ${isCorrect ? 'stamp--correct' : 'stamp--wrong'}`;

    playAnswerSound(isCorrect);

    el.nextBtn.disabled = false;
    el.nextBtn.focus({ preventScroll: true });

    if (buttonEl) buttonEl.classList.add('is-selected');
  }

  /* ------------------------------------------------------------------ *
   * Answer sound effects (synthesized — no audio files needed)
   * ------------------------------------------------------------------ */
  let _sfxCtx = null;
  function getSfxContext() {
    if (!_sfxCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _sfxCtx = new AC();
    }
    if (_sfxCtx.state === 'suspended') _sfxCtx.resume();
    return _sfxCtx;
  }

  function playTone(ctx, freq, startTime, duration, type, peakGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function playAnswerSound(isCorrect) {
    const ctx = getSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      if (isCorrect) {
        // Bright two-note ascending chime
        playTone(ctx, 880, now, 0.18, 'sine', 0.25);
        playTone(ctx, 1318.5, now + 0.1, 0.22, 'sine', 0.25);
      } else {
        // Low descending buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.37);
      }
    } catch {
      /* audio not available — fail silently */
    }
  }

  function handleNext() {
    state.index += 1;
    if (state.index >= state.questions.length) {
      finishExam();
    } else {
      renderQuestion();
    }
  }

  /* ------------------------------------------------------------------ *
   * Results
   * ------------------------------------------------------------------ */
  function finishExam() {
    const total = state.questions.length;
    const correctCount = state.answers.filter((a) => a.isCorrect).length;
    const wrongCount = total - correctCount;
    const { stats, percent } = recordExamResult(correctCount, total, wrongCount);

    el.resultScore.textContent = `${correctCount} / ${total}`;
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
      const item = document.createElement('li');
      item.className = `review-item ${answer.isCorrect ? 'review-item--correct' : 'review-item--wrong'}`;

      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'review-play-btn';
      replayBtn.setAttribute('aria-label', `Replay audio for question ${i + 1}`);
      replayBtn.textContent = '▶';
      replayBtn.addEventListener('click', () => {
        audioFor(answer.word).play().catch(() => {});
      });

      const details = document.createElement('div');
      details.className = 'review-details';
      const chosenLabel = answer.isCorrect
        ? ''
        : `<span class="review-tag review-tag--wrong">You picked: ${escapeHtml(answer.chosenKey)}</span>`;

      details.innerHTML = `
        <span class="review-index">Q${i + 1}</span>
        <span class="review-correct">${escapeHtml(answer.word.hanzi)} · ${escapeHtml(answer.word.pinyin)} — ${escapeHtml(primaryMeaning(answer.word.english))}</span>
        ${answer.isCorrect ? '<span class="review-tag review-tag--correct">Correct</span>' : chosenLabel}
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
  function resolvedCount() {
    return state.questionCount === 'all' ? state.pool.length : state.questionCount;
  }

  function startSession() {
    state.pool = currentPool();
    if (state.mode === 'reading') {
      startReadingSession();
    } else {
      startExamSession();
    }
  }

  function startExamSession() {
    if (state.pool.length < MIN_POOL_SIZE) {
      el.setupError.textContent = `Not enough words match this selection (need at least ${MIN_POOL_SIZE}).`;
      el.setupError.hidden = false;
      return;
    }
    el.setupError.hidden = true;

    state.questions = buildExam(state.pool, resolvedCount(), state.order);
    state.index = 0;
    state.answers = [];
    state.locked = false;

    el.progressFill.parentElement.setAttribute('aria-valuemax', String(state.questions.length));

    showScreen('quiz');
    renderQuestion();
  }

  function startAnotherExamSameRange() {
    state.questions = buildExam(state.pool, resolvedCount(), state.order);
    state.index = 0;
    state.answers = [];
    state.locked = false;
    showScreen('quiz');
    renderQuestion();
  }

  function retrySameExam() {
    // Re-run the exact same words, but reshuffle each question's options.
    state.questions = state.questions.map((q) => ({ ...q, options: shuffle(q.options) }));
    state.index = 0;
    state.answers = [];
    state.locked = false;
    showScreen('quiz');
    renderQuestion();
  }

  /* ------------------------------------------------------------------ *
   * Reading mode: paginated flashcards (5 words/page), audio plays on tap
   * ------------------------------------------------------------------ */
  function startReadingSession() {
    if (state.pool.length < 1) {
      el.setupError.textContent = 'Not enough words match this selection.';
      el.setupError.hidden = false;
      return;
    }
    el.setupError.hidden = true;

    state.readingWords = buildReadingSession(state.pool, resolvedCount(), state.order);
    state.readingIndex = 0;

    el.readingProgressFill.parentElement.setAttribute('aria-valuemax', String(totalReadingPages()));

    showScreen('reading');
    renderReadingPage();
  }

  function totalReadingPages() {
    return Math.max(1, Math.ceil(state.readingWords.length / READING_PAGE_SIZE));
  }

  function stopReadingAudio() {
    state.readingAudioToken += 1;
  }

  function renderReadingPage() {
    const total = totalReadingPages();
    const start = state.readingIndex * READING_PAGE_SIZE;
    const pageWords = state.readingWords.slice(start, start + READING_PAGE_SIZE);

    el.readingProgressLabel.textContent = `Page ${state.readingIndex + 1} of ${total} · Words ${start + 1}–${start + pageWords.length} of ${state.readingWords.length}`;
    el.readingProgressFill.style.width = `${(state.readingIndex / total) * 100}%`;

    el.readingCards.innerHTML = '';
    pageWords.forEach((word) => {
      const card = document.createElement('div');
      card.className = 'reading-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Play pronunciation for ${word.hanzi}`);

      card.innerHTML = `
        <span class="reading-card-hanzi">${escapeHtml(word.hanzi)}</span>
        <div class="reading-card-body">
          <span class="reading-card-pinyin">${escapeHtml(word.pinyin)}</span>
          <span class="reading-card-meaning">${escapeHtml(optionLabel(word))}</span>
          <span class="reading-card-level">${escapeHtml(levelLabel(word.level))}</span>
        </div>
        <span class="reading-card-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="100%" height="100%"><path d="M6 9v6h3.5l4.5 4V5l-4.5 4H6Z" fill="currentColor" /><path d="M17 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </span>
      `;

      const playThisCard = () => {
        stopReadingAudio();
        playReadingCardAudio(word, card);
      };
      card.addEventListener('click', playThisCard);
      card.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') playThisCard();
      });

      el.readingCards.appendChild(card);
    });

    el.readingPrevBtn.disabled = state.readingIndex === 0;
    el.readingNextBtn.textContent = state.readingIndex >= total - 1 ? 'Finish' : 'Next page';

    // Audio does NOT auto-play in Reading mode — tap a card to hear it.
    stopReadingAudio();
  }

  /** Plays one word's audio, toggling its card's playing state. Resolves when done. */
  function playReadingCardAudio(word, card) {
    return new Promise((resolve) => {
      const audio = audioFor(word);
      card?.classList.add('is-playing');
      const finish = () => {
        card?.classList.remove('is-playing');
        resolve();
      };
      audio.addEventListener('ended', finish);
      audio.play().catch(finish);
    });
  }

  function handleReadingNext() {
    if (state.readingIndex >= totalReadingPages() - 1) {
      stopReadingAudio();
      showScreen('start');
      renderStartStats();
      return;
    }
    state.readingIndex += 1;
    renderReadingPage();
  }

  function handleReadingPrev() {
    if (state.readingIndex === 0) return;
    state.readingIndex -= 1;
    renderReadingPage();
  }

  function quitReading() {
    stopReadingAudio();
    showScreen('start');
    renderStartStats();
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function bindEvents() {
    el.themeToggle.addEventListener('click', toggleTheme);
    el.startBtn.addEventListener('click', startSession);

    el.catToggleAll.addEventListener('click', handleCatToggleAll);
    el.categoryFilter.addEventListener('input', renderCategoryChips);

    Array.from(el.modeToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    Array.from(el.orderToggle.children).forEach((btn) => {
      btn.addEventListener('click', () => setOrder(btn.dataset.order));
    });

    el.playBtn.addEventListener('click', playCurrentAudio);
    el.nextBtn.addEventListener('click', handleNext);
    el.quitBtn.addEventListener('click', () => {
      showScreen('start');
      renderStartStats();
    });

    el.retryBtn.addEventListener('click', retrySameExam);
    el.newExamBtn.addEventListener('click', startAnotherExamSameRange);
    el.reviewBtn.addEventListener('click', renderReview);
    el.homeBtn.addEventListener('click', () => {
      showScreen('start');
      renderStartStats();
    });
    el.reviewBackBtn.addEventListener('click', () => showScreen('result'));

    el.playBtn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') playCurrentAudio();
    });

    el.readingNextBtn.addEventListener('click', handleReadingNext);
    el.readingPrevBtn.addEventListener('click', handleReadingPrev);
    el.readingQuitBtn.addEventListener('click', quitReading);
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  async function init() {
    initTheme();
    bindEvents();
    renderStartStats();
    showScreen('start');

    try {
      state.db = await loadDatabase();
      el.dbLoading.hidden = true;
      el.setup.hidden = false;
      initSetup();
    } catch (err) {
      console.error(err);
      el.dbLoading.hidden = true;
      el.dbError.textContent = 'Could not load database.json. Make sure you are serving this folder over HTTP.';
      el.dbError.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
