import { useState, useRef, useEffect } from 'react';
import type { SpeechLine } from '../types';
import { assetUrl } from '../assetUrl';

interface SpeechScreenProps {
  speechLines: SpeechLine[];
}

type ViewMode = 'normal' | 'podium';

export default function SpeechScreen({ speechLines }: SpeechScreenProps) {
  const [showPinyin, setShowPinyin] = useState(true);
  const [showEnglish, setShowEnglish] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [shadowingMode, setShadowingMode] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const playLine = (index: number) => {
    const line = speechLines[index];
    if (line.audioUrl && audioRef.current) {
      audioRef.current.src = assetUrl(line.audioUrl);
      audioRef.current.play();
    } else {
      speakLine(line.chinese);
    }
  };

  const speakLine = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleShadowingNext = () => {
    if (currentLineIndex < speechLines.length - 1) {
      const nextIndex = currentLineIndex + 1;
      setCurrentLineIndex(nextIndex);
      playLine(nextIndex);
      
      setTimeout(() => {
        setIsPaused(true);
        setTimeout(() => {
          setIsPaused(false);
        }, 3000);
      }, 2000);
    } else {
      setShadowingMode(false);
      setCurrentLineIndex(0);
    }
  };

  const startShadowing = () => {
    setShadowingMode(true);
    setCurrentLineIndex(0);
    playLine(0);
    setTimeout(() => {
      setIsPaused(true);
      setTimeout(() => {
        setIsPaused(false);
      }, 3000);
    }, 2000);
  };

  useEffect(() => {
    if (shadowingMode && !isPaused) {
      const timer = setTimeout(handleShadowingNext, 1000);
      return () => clearTimeout(timer);
    }
  }, [shadowingMode, isPaused, currentLineIndex]);

  if (viewMode === 'podium') {
    return (
      <div className="screen podium-view">
        <button className="back-button" onClick={() => setViewMode('normal')}>
          ← Back
        </button>
        <div className="podium-content">
          {speechLines.map(line => (
            <div key={line.number} className="podium-line">
              <div className="podium-chinese">{line.chinese}</div>
              {showPinyin && <div className="podium-pinyin">{line.pinyin}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="screen speech-screen">
      <audio ref={audioRef} />
      
      <div className="controls">
        <label>
          <input
            type="checkbox"
            checked={showPinyin}
            onChange={(e) => setShowPinyin(e.target.checked)}
          />
          Show Pinyin
        </label>
        <label>
          <input
            type="checkbox"
            checked={showEnglish}
            onChange={(e) => setShowEnglish(e.target.checked)}
          />
          Show English
        </label>
      </div>

      <div className="speech-actions">
        <button onClick={() => setViewMode('podium')} className="action-button">
          📋 Podium View
        </button>
        <button
          onClick={startShadowing}
          className="action-button"
          disabled={shadowingMode}
        >
          🔁 Start Shadowing
        </button>
      </div>

      {shadowingMode && (
        <div className="shadowing-indicator">
          <h3>Shadowing Mode Active</h3>
          <p>Line {currentLineIndex + 1} of {speechLines.length}</p>
          {isPaused && <p className="pulse">🎤 Your turn - repeat now!</p>}
        </div>
      )}

      <div className="speech-lines">
        {speechLines.map((line, idx) => (
          <div
            key={line.number}
            className={`speech-line ${shadowingMode && idx === currentLineIndex ? 'active' : ''}`}
          >
            <div className="line-number">{line.number}</div>
            <div className="line-content">
              <div className="line-chinese">{line.chinese}</div>
              {showPinyin && <div className="line-pinyin">{line.pinyin}</div>}
              {showEnglish && <div className="line-english">{line.english}</div>}
              <button
                className="play-button"
                onClick={() => playLine(idx)}
                disabled={shadowingMode}
              >
                ▶️ Play
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="full-speech-controls">
        <h3>Full Speech Audio</h3>
        <div className="audio-buttons">
          <button onClick={() => {
            if (audioRef.current) {
              audioRef.current.src = assetUrl('/audio/full_speech_normal.mp3');
              audioRef.current.play();
            }
          }}>
            🔊 Play Normal Speed
          </button>
          <button onClick={() => {
            if (audioRef.current) {
              audioRef.current.src = assetUrl('/audio/full_speech_slow.mp3');
              audioRef.current.play();
            }
          }}>
            🐢 Play Slow Speed
          </button>
          <button onClick={() => {
            if (audioRef.current) {
              audioRef.current.src = assetUrl('/audio/shadowing_drill.mp3');
              audioRef.current.play();
            }
          }}>
            🔁 Shadowing Drill
          </button>
        </div>
      </div>

      <div className="tricky-words-section">
        <h3>Tricky Words Practice</h3>
        <p>Listen to these challenging words and phrases from the speech:</p>
        <div className="tricky-words-list">
          <span>张居信</span>
          <span>张学良</span>
          <span>孙子</span>
          <span>主办方</span>
          <span>邀请</span>
          <span>杨虎城</span>
          <span>一致抗日</span>
          <span>西安事变</span>
          <span>失去自由</span>
          <span>赵一荻</span>
          <span>一直</span>
          <span>一岁</span>
          <span>看望</span>
          <span>故事</span>
          <span>同胞</span>
          <span>心痛</span>
          <span>心里</span>
          <span>不是自己</span>
          <span>原则</span>
          <span>不怕死</span>
          <span>不爱钱</span>
          <span>下一代</span>
          <span>中华民族</span>
          <span>繁荣</span>
        </div>
        <button
          className="action-button"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.src = assetUrl('/audio/tricky_words.mp3');
              audioRef.current.play();
            }
          }}
        >
          🎧 Play Tricky Words Audio
        </button>
      </div>
    </div>
  );
}
