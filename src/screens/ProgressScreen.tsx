import { useState } from 'react';
import type { UserProgress, SpeechLine } from '../types';
import { exportProgress, importProgress } from '../storage';

interface ProgressScreenProps {
  progress: UserProgress;
  speechLines: SpeechLine[];
  onRefresh: () => void;
}

export default function ProgressScreen({ progress, speechLines, onRefresh }: ProgressScreenProps) {
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');
  const [importData, setImportData] = useState('');

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

  const totalAttempts = Object.values(progress.lineScores).reduce((sum, scores) => sum + scores.length, 0);
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
    </div>
  );
}
