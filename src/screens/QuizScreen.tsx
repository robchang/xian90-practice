import { useState, useEffect } from 'react';
import type { DailyLesson, VocabWord, UserProgress, QuizAttempt } from '../types';
import { addQuizAttempt, updateVocabProgress } from '../storage';
import {
  initializeVocabProgress,
  updateVocabProgressAfterReview,
  getDueWords,
  getNewWords
} from '../spacedRepetition';

interface QuizScreenProps {
  lessons: DailyLesson[];
  glossary: VocabWord[];
  progress: UserProgress;
  onRefresh: () => void;
}

type QuizMode = 'character-to-pinyin' | 'pinyin-to-character' | 'audio-to-meaning' | 'mixed';

interface QuizQuestion {
  word: VocabWord;
  questionText: string;
  correctAnswer: string;
  options: string[];
  mode: QuizMode;
}

export default function QuizScreen({ lessons, glossary, progress, onRefresh }: QuizScreenProps) {
  const [quizMode, setQuizMode] = useState<QuizMode>('mixed');
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [allWords, setAllWords] = useState<VocabWord[]>([]);

  useEffect(() => {
    const lessonWords = lessons.flatMap(l => l.vocabulary);
    const combined = [...glossary, ...lessonWords];
    const unique = Array.from(new Map(combined.map(w => [w.chinese, w])).values());
    setAllWords(unique);
  }, [lessons, glossary]);

  useEffect(() => {
    if (allWords.length > 0 && !currentQuestion) {
      generateQuestion();
    }
  }, [allWords, currentQuestion]);

  const generateQuestion = () => {
    if (allWords.length === 0) return;

    const dueWordIds = getDueWords(progress.vocabProgress);
    const newWordIds = getNewWords(
      allWords.map(w => w.chinese),
      progress.vocabProgress,
      3
    );

    const availableWords = [...dueWordIds, ...newWordIds];
    
    let wordId: string;
    if (availableWords.length > 0) {
      wordId = availableWords[Math.floor(Math.random() * availableWords.length)];
    } else {
      wordId = allWords[Math.floor(Math.random() * allWords.length)].chinese;
    }

    const word = allWords.find(w => w.chinese === wordId);
    if (!word) return;

    const modes: QuizMode[] = quizMode === 'mixed' 
      ? ['character-to-pinyin', 'pinyin-to-character', 'audio-to-meaning']
      : [quizMode];
    
    const selectedMode = modes[Math.floor(Math.random() * modes.length)];

    let questionText: string;
    let correctAnswer: string;
    let options: string[];

    switch (selectedMode) {
      case 'character-to-pinyin':
        questionText = `What is the pinyin for: ${word.chinese}?`;
        correctAnswer = word.pinyin;
        options = generateOptions(allWords.map(w => w.pinyin), correctAnswer, 4);
        break;
      
      case 'pinyin-to-character':
        questionText = `Which character matches: ${word.pinyin}?`;
        correctAnswer = word.chinese;
        options = generateOptions(allWords.map(w => w.chinese), correctAnswer, 4);
        break;
      
      case 'audio-to-meaning':
        questionText = word.chinese;
        correctAnswer = word.english;
        options = generateOptions(allWords.map(w => w.english), correctAnswer, 4);
        speakWord(word.chinese);
        break;
      
      default:
        questionText = word.chinese;
        correctAnswer = word.english;
        options = generateOptions(allWords.map(w => w.english), correctAnswer, 4);
    }

    setCurrentQuestion({
      word,
      questionText,
      correctAnswer,
      options: shuffle(options),
      mode: selectedMode
    });
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const generateOptions = (pool: string[], correct: string, count: number): string[] => {
    const options = [correct];
    const available = pool.filter(p => p !== correct);
    
    while (options.length < count && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      options.push(available[idx]);
      available.splice(idx, 1);
    }
    
    return options;
  };

  const shuffle = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const speakWord = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!currentQuestion || showResult) return;

    setSelectedAnswer(answer);
    setShowResult(true);

    const isCorrect = answer === currentQuestion.correctAnswer;
    
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));

    const attempt: QuizAttempt = {
      questionId: currentQuestion.word.chinese,
      correct: isCorrect,
      timestamp: Date.now()
    };
    await addQuizAttempt(attempt);

    const wordId = currentQuestion.word.chinese;
    const existingProgress = progress.vocabProgress[wordId] || initializeVocabProgress(wordId);
    const quality = isCorrect ? 4 : 2;
    const updatedProgress = updateVocabProgressAfterReview(existingProgress, quality);
    await updateVocabProgress(wordId, updatedProgress);

    onRefresh();
  };

  const handleNext = () => {
    generateQuestion();
  };

  if (!currentQuestion) {
    return <div className="screen">Loading quiz...</div>;
  }

  const accuracy = sessionStats.total > 0 
    ? Math.round((sessionStats.correct / sessionStats.total) * 100)
    : 0;

  return (
    <div className="screen quiz-screen">
      <h2>Vocabulary Quiz</h2>

      <div className="quiz-stats">
        <div className="stat">
          <span className="stat-label">Session:</span>
          <span className="stat-value">{sessionStats.correct}/{sessionStats.total}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Accuracy:</span>
          <span className="stat-value">{accuracy}%</span>
        </div>
      </div>

      <div className="quiz-mode-selector">
        <label>Mode:</label>
        <select value={quizMode} onChange={(e) => setQuizMode(e.target.value as QuizMode)}>
          <option value="mixed">Mixed</option>
          <option value="character-to-pinyin">Character → Pinyin</option>
          <option value="pinyin-to-character">Pinyin → Character</option>
          <option value="audio-to-meaning">Audio → Meaning</option>
        </select>
      </div>

      <div className="quiz-question-card">
        <h3 className="question-text">{currentQuestion.questionText}</h3>
        
        {currentQuestion.mode === 'audio-to-meaning' && (
          <button
            className="replay-audio"
            onClick={() => speakWord(currentQuestion.word.chinese)}
          >
            🔊 Replay
          </button>
        )}

        <div className="quiz-options">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              className={`quiz-option ${
                showResult && option === currentQuestion.correctAnswer ? 'correct' :
                showResult && option === selectedAnswer ? 'incorrect' : ''
              }`}
              onClick={() => handleAnswer(option)}
              disabled={showResult}
            >
              {option}
            </button>
          ))}
        </div>

        {showResult && (
          <div className={`result ${selectedAnswer === currentQuestion.correctAnswer ? 'correct' : 'incorrect'}`}>
            {selectedAnswer === currentQuestion.correctAnswer ? (
              <p>✅ Correct!</p>
            ) : (
              <p>❌ Incorrect. The answer is: {currentQuestion.correctAnswer}</p>
            )}
            <div className="word-details">
              <p><strong>{currentQuestion.word.chinese}</strong></p>
              <p>{currentQuestion.word.pinyin}</p>
              <p>{currentQuestion.word.english}</p>
              {currentQuestion.word.example && <p className="example">{currentQuestion.word.example}</p>}
            </div>
            <button className="next-button" onClick={handleNext}>
              Next Question →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
