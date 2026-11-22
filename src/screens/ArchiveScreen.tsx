import { useState } from 'react';
import type { DailyLesson, UserProgress } from '../types';

interface ArchiveScreenProps {
  lessons: DailyLesson[];
  progress: UserProgress;
}

export default function ArchiveScreen({ lessons, progress }: ArchiveScreenProps) {
  const [selectedLesson, setSelectedLesson] = useState<DailyLesson | null>(null);

  if (selectedLesson) {
    return (
      <div className="screen archive-detail">
        <button className="back-button" onClick={() => setSelectedLesson(null)}>
          ← Back to Archive
        </button>

        <h2>Day {selectedLesson.day}: {selectedLesson.story.title}</h2>
        <p className="lesson-date">{selectedLesson.date}</p>

        <div className="story-card">
          <h3>{selectedLesson.story.title}</h3>
          <p className="story-content">{selectedLesson.story.content}</p>
        </div>

        <div className="vocab-section">
          <h3>Vocabulary</h3>
          <div className="vocab-list">
            {selectedLesson.vocabulary.map((word, idx) => (
              <div key={idx} className="vocab-item">
                <div className="vocab-chinese">{word.chinese}</div>
                <div className="vocab-pinyin">{word.pinyin}</div>
                <div className="vocab-english">{word.english}</div>
                {word.example && <div className="vocab-example">{word.example}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="practice-section">
          <h3>Practice Lines</h3>
          {selectedLesson.practiceLines.map((line, idx) => (
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

        <div className="tip-section">
          <h3>Pronunciation Tip</h3>
          <div className="tip-card">
            <p>{selectedLesson.pronunciationTip}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen archive-screen">
      <h2>Lesson Archive</h2>
      <p className="archive-subtitle">Review past lessons</p>

      <div className="lessons-grid">
        {lessons.map(lesson => {
          const isCompleted = progress.completedDays.includes(lesson.day);
          const isCurrent = lesson.day === progress.currentDay;

          return (
            <button
              key={lesson.day}
              className={`lesson-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => setSelectedLesson(lesson)}
            >
              <div className="lesson-day">Day {lesson.day}</div>
              <div className="lesson-title">{lesson.story.title}</div>
              <div className="lesson-date">{lesson.date}</div>
              <div className="lesson-status">
                {isCompleted && '✓ Completed'}
                {isCurrent && !isCompleted && '→ Current'}
              </div>
            </button>
          );
        })}
      </div>

      {lessons.length === 0 && (
        <div className="empty-state">
          <p>No lessons available yet.</p>
          <p>Check back soon!</p>
        </div>
      )}
    </div>
  );
}
