import localforage from 'localforage';
import type { UserProgress, LineScore, QuizAttempt, VocabProgress, SpeakAttempt, SpeechLine } from './types';
import type { SpeechDocument, SpeechSnapshot } from './speechRevision';
import { CANONICAL_SPEECH_VERSION, pushHistory, syncSpeechAudio } from './speechRevision';

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


const ATTEMPTS_KEY = 'speak_attempts';
const MAX_STORED_ATTEMPTS = 800;

export async function getSpeakAttempts(): Promise<SpeakAttempt[]> {
  try {
    const stored = await localforage.getItem<SpeakAttempt[]>(ATTEMPTS_KEY);
    return stored || [];
  } catch (error) {
    console.error('Error loading speak attempts:', error);
    return [];
  }
}

export async function addSpeakAttempt(attempt: SpeakAttempt): Promise<void> {
  const attempts = await getSpeakAttempts();
  attempts.push(attempt);
  attempts.sort((a, b) => a.timestamp - b.timestamp);
  const trimmed = attempts.slice(-MAX_STORED_ATTEMPTS);
  await localforage.setItem(ATTEMPTS_KEY, trimmed);
}

export async function clearSpeakAttempts(): Promise<void> {
  await localforage.removeItem(ATTEMPTS_KEY);
}


const SPEECH_DOC_KEY = 'revised_speech_v1';

export async function getSpeechDocument(): Promise<SpeechDocument | null> {
  try {
    return (await localforage.getItem<SpeechDocument>(SPEECH_DOC_KEY)) || null;
  } catch (error) {
    console.error('Error loading revised speech:', error);
    return null;
  }
}

export async function saveSpeechDocument(current: SpeechLine[], previous?: SpeechDocument | null): Promise<SpeechDocument> {
  const history = pushHistory(previous?.history || [], previous?.current || current);
  const doc: SpeechDocument = {
    version: 1,
    canonicalVersion: previous?.canonicalVersion ?? CANONICAL_SPEECH_VERSION,
    current,
    history,
  };
  // If this is the very first save, history already has the previous current;
  // when previous is null, we still want a snapshot of what we are saving.
  if (!previous) {
    doc.history = pushHistory([], current);
    doc.canonicalVersion = CANONICAL_SPEECH_VERSION;
  }
  await localforage.setItem(SPEECH_DOC_KEY, doc);
  return doc;
}

export async function writeSpeechDocument(doc: SpeechDocument): Promise<SpeechDocument> {
  await localforage.setItem(SPEECH_DOC_KEY, doc);
  return doc;
}

export async function restoreSpeechSnapshot(originals: SpeechLine[], snapshot: SpeechSnapshot, previous?: SpeechDocument | null): Promise<SpeechDocument> {
  const current = syncSpeechAudio(snapshot.lines, originals);
  return saveSpeechDocument(current, previous);
}

export async function clearSpeechDocument(): Promise<void> {
  await localforage.removeItem(SPEECH_DOC_KEY);
}

export async function clearLineScores(lineNumbers: number[]): Promise<void> {
  if (!lineNumbers.length) return;
  const progress = await getProgress();
  for (const n of lineNumbers) {
    delete progress.lineScores[n];
  }
  await saveProgress(progress);
}
