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
import {
  playBlob,
  playReference,
  startPhraseRecording,
  prepareMic,
  releaseSharedMic,
  resumeAudioContext,
  waitMs,
  POST_PLAYBACK_DELAY_MS,
  type MicSession,
  type RecorderHandles,
} from '../speakAudio';
import { detectPitch } from '../scoring';
import { startLiveRecognition, transcribeRecording } from '../recognition';
import { preferTapToTalk, useLiveSpeechRecognition } from '../platform';
import { shouldScoreAttempt } from '../vad';
import {
  diag,
  isInterruptedEnd,
  isScorableEnd,
  type TakeEndReason,
} from '../diagnostics';

interface SpeakScreenProps {
  speechLines: SpeechLine[];
  focusItems: FocusItem[];
  onRefresh: () => void;
  autoStart?: boolean;
  demo?: 'prompt' | 'result' | 'drill' | null;
}

type Phase = 'idle' | 'playing' | 'your-turn' | 'recording' | 'scoring' | 'result' | 'nospeech' | 'interrupted' | 'done';

function lineByItemId(id: string, speechLines: SpeechLine[]): SpeechLine | undefined {
  const match = /^line-(\d+)$/.exec(id);
  if (!match) return undefined;
  return speechLines.find((line) => line.number === Number(match[1]));
}

function toCoachInputs(focusItems: FocusItem[], speechLines: SpeechLine[]): CoachItem[] {
  const overlay = (id: string, kind: CoachItem['kind'], fallback: { chinese: string; pinyin?: string; english?: string; audioUrl?: string }): CoachItem => {
    const line = lineByItemId(id, speechLines);
    return {
      id,
      kind,
      chinese: line?.chinese ?? fallback.chinese,
      pinyin: line?.pinyin || fallback.pinyin || '',
      english: line?.english ?? fallback.english,
      audioUrl: line ? line.audioUrl : fallback.audioUrl,
      speed: 'normal' as const,
      playbackRate: 1,
    };
  };
  const fromFocus = focusItems
    .filter((item) => !item.id.startsWith('line-') || lineByItemId(item.id, speechLines))
    .map((item) => overlay(item.id, item.kind, item));
  if (fromFocus.length > 0) return fromFocus;
  return speechLines.map((line) => overlay(`line-${line.number}`, 'line', line));
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

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
    demo === 'result'
      ? 'result'
      : demo === 'prompt' || demo === 'drill'
        ? 'recording'
        : 'idle'
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
          ? 'Recording... tap to stop'
          : ''
  );
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [handsFree, setHandsFree] = useState(() => (demo ? false : !preferTapToTalk()));
  const tapMode = preferTapToTalk() || !handsFree;

  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<RecorderHandles | null>(null);
  const liveStopRef = useRef<(() => void) | null>(null);
  const pendingLiveRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const micRef = useRef<MicSession | null>(null);
  const recordingRef = useRef(false);
  const finishingRef = useRef(false);
  const skippedRef = useRef(false);
  const referenceMsRef = useRef(0);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lastEndReasonRef = useRef<TakeEndReason | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const messageRef = useRef(message);
  messageRef.current = message;

  const current = session?.current;

  const setPhaseLogged = (next: Phase, reason: string, extra?: Record<string, unknown>) => {
    diag('phase', `${phaseRef.current} -> ${next}`, { reason, ...extra });
    if (next === 'scoring') {
      try {
        console.info('[coach] entering scoring because:', reason, extra ?? {});
      } catch { /* ignore */ }
    }
    setPhase(next);
  };

  useEffect(() => {
    const hook = {
      getPhase: () => phaseRef.current,
      getScore: () => scoreRef.current?.overall ?? null,
      getMessage: () => messageRef.current,
      getEndReason: () => lastEndReasonRef.current,
    };
    (window as Window & { __COACH_TEST__?: typeof hook }).__COACH_TEST__ = hook;
    (window as Window & { __coachRecording?: boolean }).__coachRecording = phase === 'recording' || phase === 'playing';
    return () => {
      delete (window as Window & { __COACH_TEST__?: typeof hook }).__COACH_TEST__;
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      abortRef.current?.abort();
      liveStopRef.current?.();
      releaseSharedMic();
    };
  }, []);

  const scoreAndStore = async (
    ladder: LadderSession,
    text: string,
    src: SpeakAttempt['source'],
    blob: Blob
  ) => {
    const item = ladder.current;
    let pitchGuesses: Array<number | null> | undefined;
    try {
      if (micRef.current) await resumeAudioContext(micRef.current.ctx);
      const ctx = micRef.current?.ctx || new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      const pitches = detectPitch(audioBuffer);
      const count = Array.from(item.chinese).filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
      pitchGuesses = guessTonesFromPitch(pitches, count);
      if (!micRef.current) await ctx.close();
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
    setPhaseLogged('result', 'score-ready', { score: utterance.overall });
    onRefresh();
  };

  const finishRecording = async (reason: TakeEndReason) => {
    if (finishingRef.current) return;
    const recorder = recorderRef.current;
    const ladder = sessionRef.current;
    if (!recorder || !ladder) return;
    finishingRef.current = true;
    recordingRef.current = false;
    recorderRef.current = null;
    lastEndReasonRef.current = reason;
    diag('take', 'finishRecording called', { reason });

    if (isInterruptedEnd(reason)) {
      liveStopRef.current?.();
      liveStopRef.current = null;
      try { await recorder.stop('interrupted'); } catch { /* ignore */ }
      setError('');
      setMessage('Microphone was interrupted, tap to try again');
      setPhaseLogged('interrupted', reason);
      finishingRef.current = false;
      return;
    }

    if (!isScorableEnd(reason)) {
      liveStopRef.current?.();
      setMessage('Microphone was interrupted, tap to try again');
      setPhaseLogged('interrupted', reason || 'unknown');
      finishingRef.current = false;
      return;
    }

    setPhaseLogged('scoring', reason);
    setMessage('Scoring...');
    liveStopRef.current?.();
    liveStopRef.current = null;
    try {
      const recorded = await recorder.stop(reason);
      lastEndReasonRef.current = recorded.endReason || reason;
      if (isInterruptedEnd(recorded.endReason)) {
        setMessage('Microphone was interrupted, tap to try again');
        setPhaseLogged('interrupted', recorded.endReason);
        return;
      }
      setRecordedBlob(recorded.blob);
      const result = await transcribeRecording({
        samples16k: recorded.samples16k,
        liveTranscript: pendingLiveRef.current,
        onProgress: (msg) => setWhisperStatus(msg),
      });
      pendingLiveRef.current = null;
      diag('take', 'transcribed', { source: result.source, text: result.text, heardSpeech: recorded.heardSpeech });
      if (!shouldScoreAttempt(recorded.heardSpeech, result.text)) {
        setError('');
        setMessage("I didn't hear anything, tap to try again");
        setPhaseLogged('nospeech', 'no-speech-or-empty', { text: result.text, heardSpeech: recorded.heardSpeech });
        return;
      }
      await scoreAndStore(ladder, result.text, result.source, recorded.blob);
    } catch (err) {
      console.error(err);
      diag('take', 'scoring failed', { error: String(err) });
      setError('Scoring failed. You can try that phrase again.');
      setPhaseLogged('idle', 'score-error');
    } finally {
      setWhisperStatus('');
      finishingRef.current = false;
    }
  };

  const beginRecording = async () => {
    const mic = micRef.current || (await prepareMic());
    micRef.current = mic;
    await resumeAudioContext(mic.ctx);
    pendingLiveRef.current = null;
    recordingRef.current = true;
    finishingRef.current = false;
    lastEndReasonRef.current = null;
    setError('');
    setScore(null);
    setRecordedBlob(null);
    setLevel(0);
    setElapsedMs(0);
    setPhaseLogged('recording', 'beginRecording', {
      tapMode,
      liveSR: useLiveSpeechRecognition(),
    });
    setMessage('Recording... tap to stop');

    // Never start webkitSpeechRecognition on iOS/Safari/mobile: it steals the
    // getUserMedia track and can end the take immediately.
    if (useLiveSpeechRecognition()) {
      const live = startLiveRecognition({
        shouldContinue: () => recordingRef.current,
      });
      liveStopRef.current = live.stop;
      void live.result.then((text) => {
        if (text && text.trim()) pendingLiveRef.current = text;
      });
      diag('recognition', 'live SpeechRecognition started (desktop only)');
    } else {
      liveStopRef.current = null;
      diag('recognition', 'live SpeechRecognition skipped (using Whisper after stop)');
    }

    try {
      const recorder = await startPhraseRecording({
        stream: mic.stream,
        audioContext: mic.ctx,
        tapMode,
        handsFree: !tapMode && handsFreeRef.current,
        referenceDurationMs: referenceMsRef.current,
        onLevel: setLevel,
        onTick: setElapsedMs,
        onAutoStop: (why) => {
          diag('take', 'onAutoStop', { why });
          void finishRecording(why);
        },
        onInterrupted: (why) => {
          diag('take', 'onInterrupted', { why });
          void finishRecording(why);
        },
      });
      recorderRef.current = recorder;
    } catch (err) {
      recordingRef.current = false;
      liveStopRef.current?.();
      diag('mic', 'startPhraseRecording failed', { error: String(err) });
      setError('Could not open the microphone. Check permissions and try again.');
      setPhaseLogged('idle', 'mic-open-failed');
    }
  };

  const startListening = async (ladder: LadderSession) => {
    pendingLiveRef.current = null;
    skippedRef.current = false;
    const item = ladder.current;
    setError('');
    setScore(null);
    setRecordedBlob(null);
    setMessage('Listen to the example');
    setPhaseLogged('playing', 'startListening');
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      micRef.current = await prepareMic();
    } catch (err) {
      diag('mic', 'prepareMic failed', { error: String(err) });
      setError('Could not open the microphone. Check permissions and try again.');
      setPhaseLogged('idle', 'mic-permission-failed');
      return;
    }

    let durationMs = 0;
    try {
      const played = await playReference({
        audioUrl: item.audioUrl,
        text: item.chinese,
        playbackRate: item.playbackRate,
        signal: abort.signal,
      });
      durationMs = played.durationMs;
      diag('audio', 'reference ended', { durationMs });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError' && !skippedRef.current) return;
      diag('audio', 'reference error or skip', { error: String(err), skipped: skippedRef.current });
    }
    if (abort.signal.aborted && !skippedRef.current) return;
    try {
      await waitMs(POST_PLAYBACK_DELAY_MS, abort.signal);
    } catch {
      if (!skippedRef.current) return;
    }
    if (abort.signal.aborted && !skippedRef.current) return;
    referenceMsRef.current = durationMs;

    // Always wait for a tap on iOS/mobile (and whenever hands-free is off).
    if (tapMode) {
      setPhaseLogged('your-turn', 'reference-settled');
      setMessage('Tap the mic to speak');
      return;
    }
    await beginRecording();
  };

  useEffect(() => {
    if (demo) return;
    if (preferTapToTalk()) return;
    if (autoStart && session && !startedRef.current) {
      startedRef.current = true;
      void startListening(session);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, demo]);

  const handleBegin = async () => {
    if (!session) return;
    startedRef.current = true;
    try {
      micRef.current = await prepareMic();
    } catch (err) {
      diag('mic', 'prepareMic failed on begin', { error: String(err) });
      setError('Could not open the microphone. Check permissions and try again.');
      setPhaseLogged('idle', 'mic-permission-failed');
      return;
    }
    void startListening(session);
  };

  const handleTapToSpeak = async () => {
    if (!session) return;
    try {
      micRef.current = await prepareMic();
    } catch (err) {
      diag('mic', 'prepareMic failed on tap-to-speak', { error: String(err) });
      setError('Could not open the microphone. Check permissions and try again.');
      return;
    }
    await beginRecording();
  };

  const handleStop = () => {
    void finishRecording('user-stop');
  };

  const handleSkipAudio = () => {
    skippedRef.current = true;
    abortRef.current?.abort();
  };

  const handleContinue = () => {
    if (!session) return;
    if (session.done) {
      setPhaseLogged('done', 'user-finish');
      return;
    }
    void handleBegin();
  };

  const handleTryAgain = () => {
    if (!session) return;
    void handleBegin();
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
  const meterWidth = Math.min(100, Math.max(4, Math.round(level * 500)));
  const showYourTurn = phase === 'your-turn' || phase === 'recording' || (demo && (demo === 'prompt' || demo === 'drill'));

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
        {!current.audioUrl && (
          <p className="audio-needed">New audio needed — I will use a device voice for this line.</p>
        )}
      </div>

      {showYourTurn && (
        <div className="coach-your-turn" data-testid="coach-your-turn">
          <p className="coach-your-turn-label">
            {phase === 'recording' ? 'Recording...' : 'Your turn'}
          </p>
          <p className="coach-status" data-testid="coach-status">
            {phase === 'recording' && <span className="coach-pulse" aria-hidden="true" />}
            {phase === 'recording' ? 'Recording... tap to stop' : message || 'Tap the mic to speak'}
          </p>
          {phase === 'recording' && (
            <p className="coach-timer" data-testid="coach-timer">{formatTimer(elapsedMs)}</p>
          )}
          <div className={`coach-meter ${phase === 'recording' ? 'live' : ''}`} aria-hidden="true">
            <div className="coach-meter-bar" style={{ width: `${phase === 'recording' ? meterWidth : 8}%` }} />
          </div>
        </div>
      )}

      {!showYourTurn && (
        <p className="coach-status" data-testid="coach-status">
          {phase === 'nospeech' ? (
            <span data-testid="coach-nospeech">{message || "I didn't hear anything, tap to try again"}</span>
          ) : phase === 'interrupted' ? (
            <span data-testid="coach-interrupted">{message || 'Microphone was interrupted, tap to try again'}</span>
          ) : (
            message || (phase === 'idle' ? 'I will play the example, then it is your turn.' : '')
          )}
        </p>
      )}

      {whisperStatus && <p className="coach-whisper">{whisperStatus}</p>}
      {error && <p className="coach-error">{error}</p>}

      {phase === 'result' && score && (
        <div className="coach-result" data-testid="coach-result">
          <div className="coach-score-row">
            <div className="coach-score" data-testid="coach-score">{score.overall}</div>
            <div>
              <strong>{score.overall >= 85 ? 'Ready to move on' : "Let's tighten this"}</strong>
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
          <button className="coach-primary" onClick={() => void handleBegin()} data-testid="coach-start">
            Listen to the example
          </button>
        )}
        {phase === 'playing' && (
          <button className="coach-secondary" onClick={handleSkipAudio}>
            Skip audio
          </button>
        )}
        {phase === 'your-turn' && (
          <button className="coach-primary" onClick={() => void handleTapToSpeak()} data-testid="coach-tap-start">
            Tap the mic to speak
          </button>
        )}
        {phase === 'recording' && (
          <button className="coach-primary recording" onClick={handleStop} data-testid="coach-stop">
            Tap to stop
          </button>
        )}
        {phase === 'scoring' && <p className="coach-status" data-testid="coach-scoring">Scoring...</p>}
        {(phase === 'nospeech' || phase === 'interrupted') && (
          <button className="coach-primary" onClick={handleTryAgain} data-testid="coach-try-again">
            Tap to try again
          </button>
        )}
        {phase === 'result' && (
          <>
            <button className="coach-primary" onClick={handleContinue} data-testid="coach-continue">
              {session.done ? 'Finish' : 'Next'}
            </button>
            <button className="coach-secondary" onClick={handleTryAgain} data-testid="coach-retry">
              Try again
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

      {!preferTapToTalk() && (
        <label className="coach-handsfree">
          <input
            type="checkbox"
            checked={handsFree}
            onChange={(e) => setHandsFree(e.target.checked)}
            data-testid="hands-free-toggle"
          />
          <span>
            <strong>Hands-free</strong>
            <em>Auto-stop when you finish. On iPhone this stays off so you tap to start and tap to stop.</em>
          </span>
        </label>
      )}
    </div>
  );
}
