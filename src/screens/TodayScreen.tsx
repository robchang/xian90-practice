import { useState, useEffect } from 'react';
import type { DailyLesson, UserProgress } from '../types';
import { updateStreak, markDayComplete } from '../storage';

interface TodayScreenProps {
  lessons: DailyLesson[];
  progress: UserProgress;
  targetDate: Date;
  onRefresh: () => void;
}

export default function TodayScreen({ lessons, progress, targetDate, onRefresh }: TodayScreenProps) {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [showAnswer, setShowAnswer] = useState<number | null>(null);

  useEffect(() => {
    updateStreak();
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining('Today is the day!');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const currentLesson = lessons.find(l => l.day === progress.currentDay) || lessons[0];

  if (!currentLesson) {
    return <div className="screen">No lesson available for today.</div>;
  }

  const handleCompleteDay = async () => {
    await markDayComplete(currentLesson.day);
    onRefresh();
  };

  return (
    <div className="screen today-screen">
      <section className="countdown-section">
        <h2>Countdown to Beijing</h2>
        <div className="countdown">
          <div className="countdown-value">{timeRemaining}</div>
          <div className="countdown-label">until December 12, 2026</div>
        </div>
        <div className="event-info">
          90th Anniversary of the Xi'an Incident
        </div>
      </section>

      <section className="lesson-section">
        <h2>Day {currentLesson.day}: {currentLesson.story.title}</h2>
        
        <div className="story-card">
          <p className="story-content">{currentLesson.story.content}</p>
          {currentLesson.story.keySentence && currentLesson.story.keySentence.chinese && (
            <div className="key-sentence">
              <h4>Key Sentence:</h4>
              <div className="key-chinese">{currentLesson.story.keySentence.chinese}</div>
              <div className="key-pinyin">{currentLesson.story.keySentence.pinyin}</div>
              <div className="key-english">{currentLesson.story.keySentence.english}</div>
            </div>
          )}
        </div>

        <h3>Today's Vocabulary</h3>
        <div className="vocab-list">
          {currentLesson.vocabulary.map((word, idx) => (
            <div key={idx} className="vocab-item">
              <div className="vocab-chinese">{word.chinese}</div>
              <div className="vocab-pinyin">{word.pinyin}</div>
              <div className="vocab-english">{word.english}</div>
              {word.example && <div className="vocab-example">{word.example}</div>}
            </div>
          ))}
        </div>

        <h3>Practice Lines</h3>
        <div className="practice-lines">
          {currentLesson.practiceLines.map((line, idx) => (
            <div key={idx} className="practice-line">
              {typeof line === 'string' ? line : (
                <>
                  <div className="practice-chinese">{line.chinese}</div>
                  <div className="practice-pinyin">{line.pinyin}</div>
                  <div className="practice-english">{line.english}</div>
                </>
              )}
            </div>
          ))}
        </div>

        <h3>Pronunciation Tip</h3>
        <div className="tip-card">
          <p>{currentLesson.pronunciationTip}</p>
        </div>

        <h3>Quick Quiz</h3>
        <div className="quiz-preview">
          {currentLesson.quiz.slice(0, 3).map((q, idx) => (
            <div key={q.id} className="quiz-question">
              <div className="question-text">{q.question}</div>
              <div className="quiz-options">
                {q.options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    className={`quiz-option ${
                      showAnswer === idx && opt === q.correct ? 'correct' : ''
                    }`}
                    onClick={() => setShowAnswer(idx)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="reminder-card">
          <h3>📢 Daily Reminder</h3>
          <p>Don't forget to listen to the full speech today!</p>
          <p>Practice makes perfect. Even 10 minutes of listening helps.</p>
        </div>

        <button className="complete-button" onClick={handleCompleteDay}>
          Mark Day {currentLesson.day} Complete ✓
        </button>
      </section>
    </div>
  );
}
