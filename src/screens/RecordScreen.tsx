import { useState, useRef } from 'react';
import type { SpeechLine, UserProgress, LineScore, SyllableScore } from '../types';
import { scoreTranscription, calculateOverallScore, detectPitch } from '../scoring';
import { addLineScore } from '../storage';
import { assetUrl } from '../assetUrl';

interface RecordScreenProps {
  speechLines: SpeechLine[];
  progress: UserProgress;
  onRefresh: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function RecordScreen({ speechLines, progress, onRefresh }: RecordScreenProps) {
  const [selectedLine, setSelectedLine] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [syllableScores, setSyllableScores] = useState<SyllableScore[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [pitchData, setPitchData] = useState<number[]>([]);
  const [hasRecognition, setHasRecognition] = useState(
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );
  const [manualRating, setManualRating] = useState<number>(3);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentLine = speechLines.find(l => l.number === selectedLine);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const pitches = detectPitch(audioBuffer);
          setPitchData(pitches);
        } catch (error) {
          console.error('Error analyzing pitch:', error);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBlob(null);
      setRecognizedText('');
      setSyllableScores([]);
      setOverallScore(null);
      setPitchData([]);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const recognizeSpeech = () => {
    if (!recordedBlob || !currentLine) return;

    if (hasRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setRecognizedText(transcript);
        
        const scores = scoreTranscription(currentLine.chinese, transcript);
        setSyllableScores(scores);
        const overall = calculateOverallScore(scores);
        setOverallScore(overall);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setHasRecognition(false);
        alert('Speech recognition failed. You can still self-rate your pronunciation.');
      };

      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      
      setTimeout(() => {
        recognition.start();
      }, 100);
    }
  };

  const saveScore = async () => {
    if (!currentLine) return;

    let scoreToSave: number;
    if (overallScore !== null) {
      scoreToSave = overallScore;
    } else {
      scoreToSave = (manualRating / 5) * 100;
    }

    const lineScore: LineScore = {
      lineNumber: selectedLine,
      timestamp: Date.now(),
      overallScore: scoreToSave,
      syllableScores: syllableScores,
      audioUrl: recordedBlob ? URL.createObjectURL(recordedBlob) : undefined
    };

    await addLineScore(selectedLine, lineScore);
    onRefresh();
    alert(`Score saved: ${Math.round(scoreToSave)}%`);
  };

  const playRecording = () => {
    if (recordedBlob) {
      const audioUrl = URL.createObjectURL(recordedBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const playReference = () => {
    if (currentLine) {
      if (currentLine.audioUrl) {
        const audio = new Audio(assetUrl(currentLine.audioUrl));
        audio.play();
      } else if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(currentLine.chinese);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const bestScore = progress.lineScores[selectedLine]?.[0];

  return (
    <div className="screen record-screen">
      <h2>Record & Score</h2>

      <div className="line-selector">
        <label htmlFor="line-select">Select Line:</label>
        <select
          id="line-select"
          value={selectedLine}
          onChange={(e) => setSelectedLine(Number(e.target.value))}
        >
          {speechLines.map(line => (
            <option key={line.number} value={line.number}>
              Line {line.number}
            </option>
          ))}
        </select>
      </div>

      {currentLine && (
        <div className="current-line-display">
          <div className="line-chinese">{currentLine.chinese}</div>
          <div className="line-pinyin">{currentLine.pinyin}</div>
          <div className="line-english">{currentLine.english}</div>
        </div>
      )}

      {bestScore && (
        <div className="best-score">
          Best Score: {Math.round(bestScore.overallScore)}%
        </div>
      )}

      <div className="recording-controls">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`record-button ${isRecording ? 'recording' : ''}`}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎤 Start Recording'}
        </button>

        {recordedBlob && (
          <>
            <button onClick={playRecording} className="play-button">
              ▶️ Play Your Recording
            </button>
            <button onClick={playReference} className="play-button">
              🔊 Play Reference
            </button>
            {hasRecognition && (
              <button onClick={recognizeSpeech} className="analyze-button">
                🔍 Analyze & Score
              </button>
            )}
          </>
        )}
      </div>

      {recognizedText && (
        <div className="recognition-result">
          <h3>Recognized:</h3>
          <p>{recognizedText}</p>
        </div>
      )}

      {syllableScores.length > 0 && (
        <div className="syllable-scores">
          <h3>Character-by-Character Analysis:</h3>
          <div className="syllables">
            {syllableScores.map((syl, idx) => (
              <div
                key={idx}
                className={`syllable ${
                  syl.score >= 0.9 ? 'excellent' :
                  syl.score >= 0.7 ? 'good' :
                  syl.score >= 0.4 ? 'fair' : 'needs-work'
                }`}
              >
                <div className="syllable-char">{syl.character}</div>
                <div className="syllable-expected">{syl.expected}</div>
                <div className="syllable-recognized">{syl.recognized || '?'}</div>
                <div className="syllable-breakdown">
                  <span className={syl.initialMatch ? 'match' : 'mismatch'}>I</span>
                  <span className={syl.finalMatch ? 'match' : 'mismatch'}>F</span>
                  <span className={syl.toneMatch ? 'match' : 'mismatch'}>T</span>
                </div>
              </div>
            ))}
          </div>
          <div className="score-legend">
            <span className="excellent">■</span> Excellent
            <span className="good">■</span> Good
            <span className="fair">■</span> Fair
            <span className="needs-work">■</span> Needs Work
          </div>
        </div>
      )}

      {overallScore !== null && (
        <div className="overall-score">
          <h2>Overall Score: {Math.round(overallScore)}%</h2>
          <button onClick={saveScore} className="save-button">
            💾 Save This Score
          </button>
        </div>
      )}

      {!hasRecognition && recordedBlob && (
        <div className="manual-rating">
          <h3>Speech recognition unavailable. Rate yourself:</h3>
          <div className="rating-stars">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                className={`star ${rating <= manualRating ? 'filled' : ''}`}
                onClick={() => setManualRating(rating)}
              >
                ★
              </button>
            ))}
          </div>
          <button onClick={saveScore} className="save-button">
            💾 Save Self-Rating
          </button>
        </div>
      )}

      {pitchData.length > 0 && (
        <div className="pitch-chart">
          <h3>Pitch Contour:</h3>
          <svg width="100%" height="100" viewBox="0 0 400 100">
            <polyline
              points={pitchData
                .map((p, i) => `${(i / pitchData.length) * 400},${100 - ((p - 100) / 300) * 100}`)
                .join(' ')}
              fill="none"
              stroke="#8B0000"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
