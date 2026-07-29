/* ==========================================================================
   data.js
   Static data + pure data-transformation helpers for the Chinese Numbers
   Listening Quiz. No DOM access happens in this file — it only produces
   values that script.js consumes.
   ========================================================================== */

/** Absolute bounds the user is allowed to pick a custom exam range from. */
const RANGE_BOUNDS = { min: 1, max: 1000 };

/** Range shown pre-filled on the start screen before the user adjusts it. */
const DEFAULT_RANGE = { min: 1, max: 100 };

/** Every exam contains exactly this many unique questions. */
const QUESTIONS_PER_EXAM = 20;

/** Every question offers exactly this many MCQ options. */
const OPTIONS_PER_QUESTION = 4;

/** Where audio for a given number lives, e.g. AUDIO_PATH(23) -> "/audio/23.mp3" */
const AUDIO_PATH = (number) => `audio/${number}.mp3`;

/** localStorage key for persisted lifetime stats. */
const STATS_STORAGE_KEY = 'cnQuiz.stats.v1';

/** localStorage key for the saved theme preference. */
const THEME_STORAGE_KEY = 'cnQuiz.theme.v1';

/** Shape used for the persisted stats object (also the default/reset value). */
const DEFAULT_STATS = Object.freeze({
  attempts: 0,        // number of completed exams
  bestScore: 0,        // best percentage (0-100) ever achieved
  totalCorrect: 0,      // lifetime correct answers
  totalWrong: 0,        // lifetime wrong answers
  scoreSum: 0,        // running sum of percentages, used to derive the average
});

const HANZI_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PINYIN_DIGITS = ['líng', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];

/**
 * Converts an integer 1-1000 into its Chinese numeral (Hanzi) representation.
 * @param {number} num
 * @returns {string}
 */
function numberToHanzi(num) {
  if (num === 1000) return '一千';
  if (num === 100) return '一百';
  if (num < 10) return HANZI_DIGITS[num];
  if (num < 20) {
    const ones = num - 10;
    return ones === 0 ? '十' : `十${HANZI_DIGITS[ones]}`;
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return ones === 0 ? `${HANZI_DIGITS[tens]}十` : `${HANZI_DIGITS[tens]}十${HANZI_DIGITS[ones]}`;
  }
  // 100-999
  const hundreds = Math.floor(num / 100);
  const rem = num % 100;
  const head = `${HANZI_DIGITS[hundreds]}百`;
  if (rem === 0) return head;
  if (rem < 10) return `${head}零${HANZI_DIGITS[rem]}`;
  if (rem < 20) {
    const ones = rem - 10;
    return ones === 0 ? `${head}一十` : `${head}一十${HANZI_DIGITS[ones]}`;
  }
  const tens = Math.floor(rem / 10);
  const ones = rem % 10;
  return ones === 0 ? `${head}${HANZI_DIGITS[tens]}十` : `${head}${HANZI_DIGITS[tens]}十${HANZI_DIGITS[ones]}`;
}

/**
 * Converts an integer 1-1000 into an approximate pinyin reading (tone-marked,
 * no spaces normalization edge cases — sufficient for quiz display purposes).
 * @param {number} num
 * @returns {string}
 */
function numberToPinyin(num) {
  if (num === 1000) return 'yī qiān';
  if (num === 100) return 'yī bǎi';
  if (num < 10) return PINYIN_DIGITS[num];
  if (num < 20) {
    const ones = num - 10;
    return ones === 0 ? 'shí' : `shí ${PINYIN_DIGITS[ones]}`;
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return ones === 0 ? `${PINYIN_DIGITS[tens]} shí` : `${PINYIN_DIGITS[tens]} shí ${PINYIN_DIGITS[ones]}`;
  }
  // 100-999
  const hundreds = Math.floor(num / 100);
  const rem = num % 100;
  const head = `${PINYIN_DIGITS[hundreds]} bǎi`;
  if (rem === 0) return head;
  if (rem < 10) return `${head} líng ${PINYIN_DIGITS[rem]}`;
  if (rem < 20) {
    const ones = rem - 10;
    return ones === 0 ? `${head} yī shí` : `${head} yī shí ${PINYIN_DIGITS[ones]}`;
  }
  const tens = Math.floor(rem / 10);
  const ones = rem % 10;
  return ones === 0 ? `${head} ${PINYIN_DIGITS[tens]} shí` : `${head} ${PINYIN_DIGITS[tens]} shí ${PINYIN_DIGITS[ones]}`;
}

/**
 * Bundles the display forms for a given number into one object so the rest
 * of the app never has to call the two converters separately.
 * @param {number} num
 * @returns {{value:number, hanzi:string, pinyin:string}}
 */
function describeNumber(num) {
  return { value: num, hanzi: numberToHanzi(num), pinyin: numberToPinyin(num) };
}
