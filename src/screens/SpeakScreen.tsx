import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpeechLine, SpeakAttempt } from '../types';
import type { FocusItem } from '../focusSession';
import {
  applyScore,
  createLadder,
  type CoachItem,
  type LadderSession,
} from '../coachLadder';
import { guessTonesFromPitch, scoreUtterance, type UtteranceScore } from '../scoring';
import { addSpeakAttempt, addLineScore } from '../storage';
import { playBlob, playReference, startPhraseRecording, type RecorderHandles } from '../speakAudio';
import { detectPitch } from '../scoring';
import { startLiveRecognition, transcribeRecording } from '../recognition';

interface SpeakScreenProps {
  speechLines: SpeechLine[];
  focusItems: FocusItem[];
  onRefresh: () => void;
  autoStart?: boolean;
  demo?: 'prompt' | 'result' | 'drill' | null;
}

type Phase = 'idle' | 'playing' | 'recording' | 'scoring' | 'result' | 'done';

function toCoachInputs(focusItems: FocusItem[], speechLines: SpeechLine[]): CoachItem[] {
  const fromFocus = focusItems.map((item) => {
    const line = item.id.startsWith('line-')
      ? speechLines.find((l) => `line-${l.number}` === item.id)
      : undefined;
    return {
      id: item.id,
      kind: item.kind,
      chinese: item.chinese,
      pinyin: item.pinyin || line?.pinyin || '',
      english: item.english || line?.english,
      audioUrl: item.audioUrl || line?.audioUrl,
      speed: 'normal' as const,
      playbackRate: 1,
    };
  });
  if (fromFocus.length > 0) return fromFocus;
  return speechLines.map((line) => ({
    id: `line-${line.number}`,
    kind: 'line' as const,
    chinese: line.chinese,
    pinyin: line.pinyin,
    english: line.english,
    audioUrl: line.audioUrl,
    speed: 'normal' as const,
    playbackRate: 1,
  }));
}

function demoScore(): UtteranceScore {
  return scoreUtterance('不怕死，不爱钱。', '不怕死，不要钱。');
}

function demoSession(kind: 'prompt' | 'result' | 'drill'): LadderSession {
  const items = [
    {
      id: 'line-12',
      kind: 'line' as const,
      chinese: '祖父做人的原则是："不怕死，不爱钱。"',
      pinyin: 'Zǔfù zuòrén de yuánzé shì: "Bú pà sǐ, bú ài qián."',
      english: "My grandfather's principles were: \"Not afraid of death, not loving money.\"",
      audioUrl: '/audio/lines/line_12.mp3',
    },
  ];
  const session = createLadder(items);
  if (kind === 'drill') {
    return {
      ...session,
      stage: 'word-drill',
      current: {
        id: 'line-12-word-0-不爱钱',
        kind: 'word',
        chinese: '不爱钱',
        pinyin: 'bú ài qián',
        english: 'not loving money',
        parentId: 'line-12',
        speed: 'slower',
        playbackRate: 0.6,
      },
      events: [{ kind: 'word-drill', message: "Let's concentrate on 不爱钱 together." }],
    };
  }
  return session;
}


export default function SpeakScreen({
  speechLines,
  focusItems,
  onRefresh,
  autoStart = false,
  demo = null,
}: SpeakScreenProps) {
  const inputs = useMemo(() => toCoachInputs(focusItems, speechLines), [focusItems, speechLines]);
  const [session, setSession] = useState<LadderSession | null>(() =>
    demo ? demoSession(demo) : inputs.length ? createLadder(inputs) : null
  );
  const [phase, setPhase] = useState<Phase>(
    demo === 'result' ? 'result' : demo === 'prompt' || demo === 'drill' ? 'recording' : 'idle'
  );
  const [score, setScore] = useState<UtteranceScore | null>(
    demo === 'result' ? demoScore() : null
  );
  const [source, setSource] = useState<string>(demo ? 'whisper' : '');
  const [message, setMessage] = useState(
    demo === 'drill'
      ? "Let's concentrate on 不爱钱 together."
      : demo === 'result'
        ? 'Close — check the second half.'
        : demo === 'prompt'
          ? 'Your turn — speak now.'
          : ''
  );
  const [level, setLevel] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<RecorderHandles | null>(null);
  const liveStopRef = useRef<(() => void) | null>(null);
  const pendingLiveRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const current = session?.current;

  const scoreAndStore = async (
    ladder: LadderSession,
    text: string,
    src: SpeakAttempt['source'],
    blob: Blob
  ) => {
    const item = ladder.current;
    let pitchGuesses: Array<number | null> | undefined;
    try {
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      const pitches = detectPitch(audioBuffer);
      const count = Array.from(item.chinese).filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
      pitchGuesses = guessTonesFromPitch(pitches, count);
      await ctx.close();
    } catch {
      pitchGuesses = undefined;
    }
    const utterance = scoreUtterance(item.chinese, text, { pitchToneGuesses: pitchGuesses });
    const next = applyScore(ladder, utterance.overall, utterance.syllables);
    const attempt: SpeakAttempt = {
      id: `${item.id}-${Date.now()}`,
      itemId: item.parentId || item.id,
      kind: item.kind,
      chinese: item.chinese,
      score: utterance.overall,
      syllableScores: utterance.syllables,
      speed: item.speed,
      timestamp: Date.now(),
      source: src,
    };
    await addSpeakAttempt(attempt);
    if (item.kind === 'line' && item.id.startsWith('line-')) {
      const lineNumber = Number(item.id.replace('line-', ''));
      if (!Number.isNaN(lineNumber)) {
        await addLineScore(lineNumber, {
          lineNumber,
          timestamp: attempt.timestamp,
          overallScore: attempt.score,
          syllableScores: attempt.syllableScores,
        });
      }
    }
    setSession(next);
    setScore(utterance);
    setSource(src);
    setMessage(next.events[0]?.message || utterance.tip);
    setPhase(next.done && utterance.overall >= 85 ? 'done' : 'result');
    onRefresh();
  };

  const finishRecording = async () => {
    const recorder = recorderRef.current;
    const ladder = sessionRef.current;
    if (!recorder || !ladder) return;
    recorderRef.current = null;
    setPhase('scoring');
    setMessage('Scoring…');
    liveStopRef.current?.();
    try {
      const recorded = await recorder.stop();
      setRecordedBlob(recorded.blob);
      const result = await transcribeRecording({
        samples16k: recorded.samples16k,
        liveTranscript: pendingLiveRef.current,
        onProgress: (msg) => setWhisperStatus(msg),
      });
      pendingLiveRef.current = null;
      await scoreAndStore(ladder, result.text, result.source, recorded.blob);
    } catch (err) {
      console.error(err);
      setError('Scoring failed. You can try that phrase again.');
      setPhase('idle');
    } finally {
      setWhisperStatus('');
    }
  };

  const startListening = async (ladder: LadderSession) => {
    pendingLiveRef.current = null;
    const item = ladder.current;
    setError('');
    setScore(null);
    setRecordedBlob(null);
    setMessage(item.speed === 'normal' ? 'Listen…' : `Listen — ${item.speed === 'slow' ? 'a little slower' : 'slowly'}…`);
    setPhase('playing');
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await playReference({
        audioUrl: item.audioUrl,
        text: item.chinese,
        playbackRate: item.playbackRate,
        signal: abort.signal,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
    }
    if (abort.signal.aborted) return;
    setPhase('recording');
    setMessage('Your turn — speak now.');
    const live = startLiveRecognition();
    liveStopRef.current = live.stop;
    void live.result.then((text) => {
      if (text) pendingLiveRef.current = text;
    });
    try {
      const recorder = await startPhraseRecording({
        onLevel: setLevel,
        onAutoStop: () => {
          live.stop();
          void finishRecording();
        },
      });
      recorderRef.current = recorder;
    } catch {
      live.stop();
      setError('Could not open the microphone. Check permissions and try again.');
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (demo) return;
    if (autoStart && session && !startedRef.current) {
      startedRef.current = true;
      void startListening(session);
    }
    // startListening is stable enough for mount-only autoplay after a user tap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, demo]);

  const handleStart = () => {
    if (!session) return;
    startedRef.current = true;
    void startListening(session);
  };

  const handleStop = () => {
    liveStopRef.current?.();
    void finishRecording();
  };

  const handleContinue = () => {
    if (!session) return;
    if (session.done) {
      setPhase('done');
      return;
    }
    void startListening(session);
  };

  if (!session || !current) {
    return (
      <div className="screen speak-screen">
        <h2>Speak</h2>
        <p>No practice lines are loaded yet.</p>
      </div>
    );
  }

  const stageLabel =
    current.kind === 'word'
      ? 'Word focus'
      : session.stage === 'rebuild'
        ? 'Put it back together'
        : session.stage === 'slow-retry'
          ? 'A little slower'
          : current.kind === 'line' && current.id.startsWith('line-')
            ? `Line ${current.id.replace('line-', '')}`
            : 'Practice';

  const speedLabel = current.speed === 'normal' ? 'Normal speed' : current.speed === 'slow' ? 'Slower (0.75×)' : 'Slow (0.6×)';

  return (
    <div className="screen speak-screen">
      <div className="coach-top">
        <div>
          <p className="coach-kicker">{stageLabel}</p>
          <h2>Speak coach</h2>
        </div>
        <div className="coach-speed">{speedLabel}</div>
      </div>

      <div className="coach-card" data-testid="coach-prompt">
        <div className="coach-chinese">{current.chinese}</div>
        <div className="coach-pinyin">{current.pinyin}</div>
        {current.english && <div className="coach-english">{current.english}</div>}
      </div>

      <p className="coach-status" data-testid="coach-status">
        {phase === 'recording' && <span className="coach-pulse" aria-hidden="true" />}
        {message || (phase === 'idle' ? 'I will play the phrase, then listen to you.' : '')}
      </p>

      {phase === 'recording' && (
        <div className="coach-meter" aria-hidden="true">
          <div className="coach-meter-bar" style={{ width: `${Math.min(100, Math.round(level * 400))}%` }} />
        </div>
      )}

      {whisperStatus && <p className="coach-whisper">{whisperStatus}</p>}
      {error && <p className="coach-error">{error}</p>}

      {phase === 'result' && score && (
        <div className="coach-result" data-testid="coach-result">
          <div className="coach-score-row">
            <div className="coach-score" data-testid="coach-score">{score.overall}</div>
            <div>
              <strong>{score.overall >= 85 ? "Ready to move on" : "Let's tighten this"}</strong>
              <p className="coach-tip">{score.tip}</p>
            </div>
          </div>
          <div className="coach-chars" data-testid="coach-chars">
            {score.syllables.map((syl, i) => (
              <div key={`${syl.character}-${i}`} className={`coach-char ${syl.color}`}>
                <span className="coach-char-han">{syl.character}</span>
                {syl.color !== 'green' && (
                  <span className="coach-char-py">{syl.expected}</span>
                )}
              </div>
            ))}
          </div>
          {score.missedPinyin.length > 0 && (
            <p className="coach-misses">Missed: {score.missedPinyin.join(' · ')}</p>
          )}
        </div>
      )}

      <div className="coach-actions">
        {phase === 'idle' && (
          <button className="coach-primary" onClick={handleStart} data-testid="coach-start">
            Start this phrase
          </button>
        )}
        {phase === 'playing' && (
          <button className="coach-secondary" onClick={() => abortRef.current?.abort()}>
            Skip audio
          </button>
        )}
        {phase === 'recording' && (
          <button className="coach-primary recording" onClick={handleStop} data-testid="coach-stop">
            I'm done
          </button>
        )}
        {phase === 'scoring' && <p className="coach-status">Scoring your take…</p>}
        {phase === 'result' && (
          <>
            <button className="coach-primary" onClick={handleContinue} data-testid="coach-continue">
              {session.done ? 'Finish' : 'Continue'}
            </button>
            <div className="coach-replay">
              <button
                className="coach-secondary"
                onClick={() => recordedBlob && playBlob(recordedBlob)}
                disabled={!recordedBlob && !demo}
              >
                Play you
              </button>
              <button
                className="coach-secondary"
                onClick={() =>
                  current &&
                  playReference({
                    audioUrl: current.audioUrl,
                    text: current.chinese,
                    playbackRate: current.playbackRate,
                  })
                }
              >
                Play reference
              </button>
            </div>
            <p className="coach-honesty">
              Syllable match comes from speech-to-text
              {source === 'whisper' ? ' (on-device Whisper)' : source === 'speech-recognition' ? ' (Safari/Chrome recognition)' : ''}.
              Software cannot reliably hear tones; the pitch line is only a guide.
            </p>
          </>
        )}
        {phase === 'done' && (
          <p className="coach-tip">{"That's today's speaking set. You can start again anytime."}</p>
        )}
      </div>
    </div>
  );
}
