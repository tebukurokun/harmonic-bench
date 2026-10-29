import { describe, expect, it } from 'vitest'
import {
  defaultPitchName,
  formatPitch,
  keyLabel,
  spellMidi,
  spellWithLetter,
} from '../src/theory/noteSpelling'
import {
  formatFrequency,
  isBlackKey,
  midiToFrequency,
  octaveOf,
  pitchClass,
  sortUniqueMidi,
} from '../src/theory/pitch'

describe('pitch', () => {
  it('MIDI番号から周波数を求める（表示は小数第2位）', () => {
    expect(formatFrequency(midiToFrequency(69))).toBe('440.00')
    expect(formatFrequency(midiToFrequency(60))).toBe('261.63')
    expect(formatFrequency(midiToFrequency(63))).toBe('311.13')
    expect(formatFrequency(midiToFrequency(67))).toBe('392.00')
    expect(formatFrequency(midiToFrequency(70))).toBe('466.16')
    expect(midiToFrequency(81)).toBeCloseTo(880, 10)
  })

  it('周波数の計算自体は丸めない', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.6255653, 6)
  })

  it('ピッチクラスとオクターブを求める', () => {
    expect(pitchClass(60)).toBe(0)
    expect(pitchClass(71)).toBe(11)
    expect(pitchClass(-1)).toBe(11)
    expect(octaveOf(60)).toBe(4)
    expect(octaveOf(59)).toBe(3)
    expect(octaveOf(36)).toBe(2)
  })

  it('黒鍵を判定する', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
    ])
  })

  it('MIDI番号を重複なしの昇順にする', () => {
    expect(sortUniqueMidi([67, 60, 64, 60])).toEqual([60, 64, 67])
  })
})

describe('noteSpelling', () => {
  it('文脈なしでは暫定の音名で表示する', () => {
    expect(defaultPitchName(60)).toBe('C4')
    expect(defaultPitchName(63)).toBe('E♭4')
    expect(defaultPitchName(70)).toBe('B♭4')
    expect(defaultPitchName(61)).toBe('C♯4')
    expect(defaultPitchName(83)).toBe('B5')
  })

  it('鍵盤の黒鍵は♯と♭の両方を表示する', () => {
    expect(keyLabel(61)).toBe('C♯4 / D♭4')
    expect(keyLabel(60)).toBe('C4')
  })

  it('綴りに応じてオクターブ番号を決める', () => {
    expect(formatPitch(spellMidi(60, spellWithLetter(0, 6)))).toBe('B♯3')
    expect(formatPitch(spellMidi(59, spellWithLetter(11, 0)))).toBe('C♭4')
    expect(formatPitch(spellMidi(65, spellWithLetter(5, 2)))).toBe('E♯4')
  })
})
