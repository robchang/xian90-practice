import { describe, expect, test } from 'vitest'
import { isInterruptedEnd, isScorableEnd, type TakeEndReason } from './diagnostics'
import { preferTapToTalk, useLiveSpeechRecognition } from './platform'

describe('take-end guards', () => {
  test('only intentional ends may go to scoring', () => {
    const score: TakeEndReason[] = ['user-stop', 'max-duration', 'vad-silence']
    const interrupt: TakeEndReason[] = [
      'interrupted',
      'track-ended',
      'track-mute',
      'mediarecorder-onstop-unexpected',
      'mediarecorder-error',
    ]
    for (const reason of score) {
      expect(isScorableEnd(reason)).toBe(true)
      expect(isInterruptedEnd(reason)).toBe(false)
    }
    for (const reason of interrupt) {
      expect(isScorableEnd(reason)).toBe(false)
      expect(isInterruptedEnd(reason)).toBe(true)
    }
    expect(isScorableEnd(null)).toBe(false)
  })
})

describe('platform defaults', () => {
  test('platform helpers are callable', () => {
    expect(typeof preferTapToTalk()).toBe('boolean')
    expect(typeof useLiveSpeechRecognition()).toBe('boolean')
  })
})
