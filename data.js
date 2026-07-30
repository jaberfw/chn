/* ==========================================================================
   data.js
   Static config + pure data helpers for the HSK Vocabulary Quiz.
   No DOM access happens in this file — it only loads/filters/shapes data
   for script.js to render. Depends on database.json (fetched at runtime).
   ========================================================================== */

/** Path to the vocabulary database, relative to index.html. */
const DATABASE_PATH = 'database.json';

/** Levels in canonical display order. 'extra' = words outside the HSK 1-5 core lists. */
const LEVEL_ORDER = ['1', '2', '3', '4', '5', 'extra'];

/** Every exam offers exactly this many MCQ options per question. */
const OPTIONS_PER_QUESTION = 4;

/** Question-count choices offered on the start screen. 'all' uses the entire filtered pool. */
const QUESTION_COUNT_CHOICES = [10, 20, 30, 50, 'all'];

/** Minimum words a filtered pool must contain to generate a valid exam (1 correct + 3 distractors). */
const MIN_POOL_SIZE = OPTIONS_PER_QUESTION;

/** Words shown per page in Reading mode. */
const READING_PAGE_SIZE = 5;

/** localStorage key for persisted lifetime stats. */
const STATS_STORAGE_KEY = 'hskQuiz.stats.v1';

/** localStorage key for the saved theme preference. */
const THEME_STORAGE_KEY = 'hskQuiz.theme.v1';

/** Shape used for the persisted stats object (also the default/reset value). */
const DEFAULT_STATS = Object.freeze({
  attempts: 0,
  bestScore: 0,
  totalCorrect: 0,
  totalWrong: 0,
  scoreSum: 0,
});

/**
 * Loads and caches the vocabulary database.
 * @returns {Promise<{version:string,total_unique:number,levels:Object,words:Array}>}
 */
let _dbPromise = null;
function loadDatabase() {
  if (!_dbPromise) {
    _dbPromise = fetch(DATABASE_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load database (${res.status})`);
        return res.json();
      })
      .then((db) => {
        db.words.forEach((w) => {
          w.level = String(w.level);
        });
        return db;
      });
  }
  return _dbPromise;
}

/** Human-friendly label for a level key ('1' -> 'HSK 1', 'extra' -> 'Extra'). */
function levelLabel(level) {
  return level === 'extra' ? 'Extra' : `HSK ${level}`;
}

/** Turns a raw category slug ('daily_life') into a display label ('Daily Life'). */
function prettyCategory(cat) {
  if (!cat) return 'Uncategorized';
  return cat
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Returns the sorted, de-duplicated list of category slugs found among `words`. */
function categoriesInWords(words) {
  const set = new Set(words.map((w) => w.category || 'uncategorized'));
  return Array.from(set).sort((a, b) => prettyCategory(a).localeCompare(prettyCategory(b)));
}

/** Filters `words` down to those whose level is in `levelSet` (Set of string keys). */
function wordsForLevels(words, levelSet) {
  if (!levelSet || levelSet.size === 0) return [];
  return words.filter((w) => levelSet.has(w.level));
}

/**
 * Filters `words` (already level-filtered) down to those whose category is in
 * `categorySet`. If `categorySet` is null, no category filtering is applied
 * (treated as "all categories").
 */
function wordsForCategories(words, categorySet) {
  if (!categorySet) return words;
  return words.filter((w) => categorySet.has(w.category || 'uncategorized'));
}

/** First, shortest clause of an English gloss — used as a clean MCQ answer string. */
function primaryMeaning(english) {
  if (!english) return '—';
  const clause = english.split(/[;,]/)[0].trim();
  return clause || english.trim();
}

/**
 * Maps a "numbers" category word's primary English meaning to its numeral form
 * (e.g. 'seven' -> '7', 'ten thousand' -> '10,000', 'first' -> '1st'). Only exact,
 * unambiguous number words are mapped; anything else (e.g. 'occasionally',
 * 'measure word meaning times') is left as-is so it still reads sensibly.
 */
const NUMBER_WORD_TO_DIGIT = {
  zero: '0', one: '1', two: '2', 'two (used before measure words)': '2',
  three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', twenty: '20', thirty: '30', forty: '40',
  fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  hundred: '100', 'one hundred': '100', 'two hundred': '200',
  thousand: '1,000', 'one thousand': '1,000',
  'ten thousand': '10,000', 'one hundred thousand': '100,000',
  million: '1,000,000', 'ten million': '10,000,000',
  'hundred million': '100,000,000', 'one hundred million': '100,000,000',
  billion: '1,000,000,000',
  half: '0.5', 'one half (fraction)': '1/2', 'one third': '1/3', 'one quarter': '1/4',
  'one hundred percent': '100%', 'ten percent': '10%',
  first: '1st', second: '2nd', third: '3rd',
};

/**
 * Display text for an MCQ option: the English meaning, except for words in the
 * "numbers" category, which show as numerals (e.g. '7' instead of 'seven') when
 * the meaning maps cleanly to one.
 */
function optionLabel(word) {
  const meaning = primaryMeaning(word.english);
  const category = (word.category || '').toLowerCase();
  if (category === 'numbers') {
    const digit = NUMBER_WORD_TO_DIGIT[meaning.toLowerCase()];
    if (digit) return digit;
  }
  return meaning;
}

/** Fisher-Yates shuffle. Returns a new array; does not mutate input. */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Picks `count` unique random items from `arr`, excluding any whose `key(item)` is in `excludeKeys`. */
function pickUniqueBy(arr, count, key, excludeKeys) {
  const excluded = new Set(excludeKeys);
  const seen = new Set();
  const pool = arr.filter((item) => {
    const k = key(item);
    if (excluded.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return shuffle(pool).slice(0, count);
}

/**
 * Builds a fresh exam from `pool` (already level+category filtered). Exam mode always
 * plays audio and asks the learner to pick the matching hanzi among distractors.
 * @param {Array} pool - filtered word list to draw from.
 * @param {number} count - number of questions to generate.
 * @param {'random'|'serial'} [order='random'] - 'random' shuffles which words are asked
 *   and in what order; 'serial' keeps the pool's original order (first `count` words).
 * @returns {Array<{word:Object, options:Array, correctKey:string}>}
 */
function buildExam(pool, count, order = 'random') {
  const limit = Math.min(count, pool.length);
  const chosenWords = order === 'serial' ? pool.slice(0, limit) : shuffle(pool).slice(0, limit);
  const optionKey = (w) => w.hanzi;

  return chosenWords.map((word) => {
    const distractorWords = pickUniqueBy(pool, OPTIONS_PER_QUESTION - 1, optionKey, [optionKey(word)]);
    const optionWords = shuffle([word, ...distractorWords]);

    const options = optionWords.map((w) => ({
      key: optionKey(w),
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      meaning: optionLabel(w),
    }));

    return {
      word,
      options,
      correctKey: optionKey(word),
    };
  });
}

/**
 * Builds a Reading session: a shuffled slice of `pool`, later paged `READING_PAGE_SIZE`
 * words at a time. Reading mode is a study/flashcard flow (word + audio + answer shown
 * up front) rather than a scored quiz.
 * @param {Array} pool - filtered word list to draw from.
 * @param {number} count - number of words to include (already resolved from 'all').
 * @param {'random'|'serial'} [order='random'] - 'random' shuffles the words; 'serial'
 *   keeps the pool's original order (first `count` words).
 * @returns {Array} words for the session.
 */
function buildReadingSession(pool, count, order = 'random') {
  const limit = Math.min(count, pool.length);
  return order === 'serial' ? pool.slice(0, limit) : shuffle(pool).slice(0, limit);
}
