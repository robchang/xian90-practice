export interface SpeechLine {
  number: number;
  chinese: string;
  pinyin: string;
  english: string;
  audioUrl?: string;
}

export interface VocabWord {
  chinese: string;
  pinyin: string;
  english: string;
  example?: string;
  audioUrl?: string;
}

export interface DailyLesson {
  day: number;
  date: string;
  story: {
    title: string;
    content: string;
    keySentence?: {
      chinese: string;
      pinyin: string;
      english: string;
    };
  };
  vocabulary: VocabWord[];
  practiceLines: Array<string | {
    chinese: string;
    pinyin: string;
    english: string;
  }>;
  pronunciationTip: string;
  quiz: QuizQuestion[];
  audioFiles?: {
    story?: string;
    vocab?: string[];
    words?: string;
    shadowing?: string;
    fullNormal?: string;
    fullSlow?: string;
  };
}

export interface QuizQuestion {
  id: string;
  type: 'character-to-pinyin' | 'pinyin-to-character' | 'audio-to-meaning' | 'character-to-meaning';
  question: string;
  correct: string;
  options: string[];
  audioUrl?: string;
}

export interface LineScore {
  lineNumber: number;
  timestamp: number;
  overallScore: number;
  syllableScores: SyllableScore[];
  audioUrl?: string;
}

export interface SyllableScore {
  character: string;
  expected: string;
  recognized: string;
  initialMatch: boolean;
  finalMatch: boolean;
  toneMatch: boolean;
  score: number;
  color?: 'green' | 'yellow' | 'red';
  toneAccepted?: boolean;
}

export interface QuizAttempt {
  questionId: string;
  correct: boolean;
  timestamp: number;
}

export interface VocabProgress {
  wordId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: number;
  lastReviewed: number;
}


export interface SpeakAttempt {
  id: string;
  itemId: string;
  kind: 'line' | 'chunk' | 'word';
  chinese: string;
  score: number;
  syllableScores: SyllableScore[];
  speed: 'normal' | 'slow' | 'slower';
  timestamp: number;
  source: 'speech-recognition' | 'whisper' | 'manual';
}

export interface UserProgress {
  currentDay: number;
  streak: number;
  lastPracticeDate: string;
  lineScores: Record<number, LineScore[]>;
  quizAttempts: QuizAttempt[];
  vocabProgress: Record<string, VocabProgress>;
  completedDays: number[];
}

export interface AppData {
  speechLines: SpeechLine[];
  lessons: DailyLesson[];
  glossary: VocabWord[];
  progress: UserProgress;
}
