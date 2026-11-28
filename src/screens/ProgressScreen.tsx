import { useState } from 'react';
import type { UserProgress, SpeechLine, SpeakAttempt } from '../types';
import { exportProgress, importProgress } from '../storage';
import { computeWeaknesses } from '../focusSession';
import { buildLabel } from '../buildInfo';
import { buildCoachSummary, serializeCoachSummary } from '../progressSummary';

interface ProgressScreenProps {
  progress: UserProgress;
  speechLines: SpeechLine[];
  attempts: SpeakAttempt[];
  todayLessonLines: SpeechLine[];
  onRefresh: () => void;
  onOpenArchive: () => void;
  unknownChars?: string[];
}

export default function ProgressScreen({ progress, speechLines, attempts, todayLessonLines, onRefresh, onOpenArchive, unknownChars = [] }: ProgressScreenProps) {
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');
  const [importData, setImportData] = useState('');
  const [shareNote, setShareNote] = useState('');

  const handleExport = async () => {
    const data = await exportProgress();
    setExportData(data);
    setShowExport(true);
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      alert('Please paste your progress data first.');
      return;
    }

    try {
      const success = await importProgress(importData);
      if (success) {
        alert('Progress imported successfully!');
        setImportData('');
        onRefresh();
      } else {
        alert('Failed to import progress. Please check the data format.');
      }
    } catch (error) {
      alert('Failed to import progress. Invalid JSON.');
    }
  };

  const downloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xian90-progress-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareCoach = async () => {
    const summary = buildCoachSummary({ attempts, speechLines, todayLessonLines, unknownChars });
    const text = serializeCoachSummary(summary);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Xi'an 90 practice summary", text });
        setShareNote('Shared. Paste it into chat with your coach when you are ready.');
        return;
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote('Copied to the clipboard. Paste it into chat with your coach.');
    } catch {
      setExportData(text);
      setShowExport(true);
      setShareNote('Copy the JSON below and paste it into chat with your coach.');
    }
  };

  const trouble = computeWeaknesses(attempts).filter((w) => w.kind === 'word' || !w.id.startsWith('line-')).slice(0, 5);
  const summary = buildCoachSummary({ attempts, speechLines, todayLessonLines, unknownChars });

  const totalAttempts = attempts.length || Object.values(progress.lineScores).reduce((sum, scores) => sum + scores.length, 0);
  const quizAccuracy = progress.quizAttempts.length > 0
    ? Math.round((progress.quizAttempts.filter(a => a.correct).length / progress.quizAttempts.length) * 100)
    : 0;

  return (
    <div className="screen progress-screen">
      <h2>Your Progress</h2>

      <div className="progress-stats">
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{progress.streak}</div>
          <div className="stat-label">Day Streak</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎤</div>
          <div className="stat-value">{totalAttempts}</div>
          <div className="stat-label">Recordings</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✏️</div>
          <div className="stat-value">{progress.quizAttempts.length}</div>
          <div className="stat-label">Quiz Questions</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-value">{quizAccuracy}%</div>
          <div className="stat-label">Quiz Accuracy</div>
        </div>
      </div>

      <div className="coach-share-card">
        <h3>Send progress to my coach</h3>
        <p>A compact summary of weak words, line scores, and recent practice counts. There is no server — this copies the JSON so you can paste it into chat.</p>
        <button className="coach-primary" onClick={handleShareCoach} data-testid="share-coach">
          Send progress to my coach
        </button>
        {shareNote && <p className="share-note">{shareNote}</p>}
        <button className="text-link" onClick={onOpenArchive}>Prior lessons (archive)</button>
      </div>

      {trouble.length > 0 && (
        <div className="trouble-section">
          <h3>Top 5 trouble words</h3>
          <ul className="trouble-list">
            {trouble.map((w) => (
              <li key={w.id}>
                <strong>{w.chinese}</strong>
                <span> {Math.round(w.recentAvg)}% recent · {w.attempts} tries</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="line-trend-section">
        <h3>Per-line trend</h3>
        <div className="line-trends">
          {summary.lineScores.map((line) => (
            <div key={line.line} className={`line-trend status-${line.status}`}>
              <div className="line-trend-head">
                <span>Line {line.line}</span>
                <span>{line.status}</span>
              </div>
              <p className="line-preview">{line.chinese.slice(0, 16)}{line.chinese.length > 16 ? '…' : ''}</p>
              <div className="trend-bars" aria-hidden="true">
                {(line.trend.length ? line.trend : [0]).map((s, i) => (
                  <span key={i} className="trend-bar" style={{ height: `${Math.max(8, s)}%` }} title={`${s}`} />
                ))}
              </div>
              <div className="line-trend-meta">
                {line.latest !== null ? `Latest ${line.latest}% · best ${line.best}%` : 'Not practiced yet'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="line-scores-section">
        <h3>Line Scores</h3>
        <div className="line-scores-grid">
          {speechLines.map(line => {
            const scores = progress.lineScores[line.number] || [];
            const bestScore = scores[0];
            const attempts = scores.length;

            return (
              <div key={line.number} className="line-score-card">
                <div className="line-number">Line {line.number}</div>
                <div className="line-preview">{line.chinese.substring(0, 10)}...</div>
                {bestScore ? (
                  <>
                    <div className="best-score">
                      Best: {Math.round(bestScore.overallScore)}%
                    </div>
                    <div className="attempts-count">{attempts} attempt{attempts !== 1 ? 's' : ''}</div>
                  </>
                ) : (
                  <div className="no-attempts">Not practiced yet</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="vocab-progress-section">
        <h3>Vocabulary Progress</h3>
        <p className="vocab-count">
          {Object.keys(progress.vocabProgress).length} words reviewed
        </p>
      </div>

      <div className="completed-days-section">
        <h3>Completed Days</h3>
        <div className="completed-days">
          {progress.completedDays.length > 0 ? (
            progress.completedDays.map(day => (
              <span key={day} className="completed-day">Day {day}</span>
            ))
          ) : (
            <p>No days completed yet. Keep practicing!</p>
          )}
        </div>
      </div>

      <div className="data-management">
        <h3>Data Management</h3>
        <div className="data-buttons">
          <button onClick={handleExport} className="export-button">
            📤 Export Progress
          </button>
        </div>

        {showExport && (
          <div className="export-section">
            <p>Copy this data or download it:</p>
            <textarea
              value={exportData}
              readOnly
              rows={8}
              className="export-textarea"
            />
            <button onClick={downloadExport} className="download-button">
              ⬇️ Download JSON File
            </button>
          </div>
        )}

        <div className="import-section">
          <h4>Import Progress</h4>
          <p>Paste your exported progress data:</p>
          <textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste your progress JSON here..."
            rows={6}
            className="import-textarea"
          />
          <button onClick={handleImport} className="import-button">
            📥 Import Progress
          </button>
        </div>
      </div>
      <p className="progress-build">Build {buildLabel()}</p>
    </div>
  );
}
