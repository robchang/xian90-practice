import localforage from 'localforage';
import type { UserProgress, LineScore, QuizAttempt, VocabProgress } from './types';

const PROGRESS_KEY = 'user_progress';

const defaultProgress: UserProgress = {
  currentDay: 1,
  streak: 0,
  lastPracticeDate: '',
  lineScores: {},
  quizAttempts: [],
  vocabProgress: {},
  completedDays: []
};

export async function getProgress(): Promise<UserProgress> {
  try {
    const stored = await localforage.getItem<UserProgress>(PROGRESS_KEY);
    return stored || defaultProgress;
  } catch (error) {
    console.error('Error loading progress:', error);
    return defaultProgress;
  }
}

export async function saveProgress(progress: UserProgress): Promise<void> {
  try {
    await localforage.setItem(PROGRESS_KEY, progress);
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

export async function addLineScore(lineNumber: number, score: LineScore): Promise<void> {
  const progress = await getProgress();
  if (!progress.lineScores[lineNumber]) {
    progress.lineScores[lineNumber] = [];
  }
  progress.lineScores[lineNumber].push(score);
  progress.lineScores[lineNumber].sort((a, b) => b.overallScore - a.overallScore);
  progress.lineScores[lineNumber] = progress.lineScores[lineNumber].slice(0, 10);
  await saveProgress(progress);
}

export async function addQuizAttempt(attempt: QuizAttempt): Promise<void> {
  const progress = await getProgress();
  progress.quizAttempts.push(attempt);
  await saveProgress(progress);
}

export async function updateVocabProgress(wordId: string, vocabProgress: VocabProgress): Promise<void> {
  const progress = await getProgress();
  progress.vocabProgress[wordId] = vocabProgress;
  await saveProgress(progress);
}

export async function updateStreak(): Promise<void> {
  const progress = await getProgress();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (progress.lastPracticeDate === yesterday) {
    progress.streak += 1;
  } else if (progress.lastPracticeDate !== today) {
    progress.streak = 1;
  }
  
  progress.lastPracticeDate = today;
  await saveProgress(progress);
}

export async function markDayComplete(day: number): Promise<void> {
  const progress = await getProgress();
  if (!progress.completedDays.includes(day)) {
    progress.completedDays.push(day);
    progress.completedDays.sort((a, b) => a - b);
  }
  await saveProgress(progress);
}

export async function exportProgress(): Promise<string> {
  const progress = await getProgress();
  return JSON.stringify(progress, null, 2);
}

export async function importProgress(jsonString: string): Promise<boolean> {
  try {
    const progress = JSON.parse(jsonString) as UserProgress;
    await saveProgress(progress);
    return true;
  } catch (error) {
    console.error('Error importing progress:', error);
    return false;
  }
}
