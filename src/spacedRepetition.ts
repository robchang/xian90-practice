import type { VocabProgress } from './types';

const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

export function initializeVocabProgress(wordId: string): VocabProgress {
  return {
    wordId,
    easeFactor: INITIAL_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    dueDate: Date.now(),
    lastReviewed: 0
  };
}

export function updateVocabProgressAfterReview(
  progress: VocabProgress,
  quality: number
): VocabProgress {
  let { easeFactor, interval, repetitions } = progress;
  
  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }
  
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < MIN_EASE_FACTOR) {
    easeFactor = MIN_EASE_FACTOR;
  }
  
  const now = Date.now();
  const dueDate = now + interval * 24 * 60 * 60 * 1000;
  
  return {
    ...progress,
    easeFactor,
    interval,
    repetitions,
    dueDate,
    lastReviewed: now
  };
}

export function getDueWords(vocabProgress: Record<string, VocabProgress>): string[] {
  const now = Date.now();
  return Object.values(vocabProgress)
    .filter(p => p.dueDate <= now)
    .map(p => p.wordId);
}

export function getNewWords(
  allWords: string[],
  vocabProgress: Record<string, VocabProgress>,
  limit: number = 5
): string[] {
  const newWords = allWords.filter(wordId => !vocabProgress[wordId]);
  return newWords.slice(0, limit);
}
