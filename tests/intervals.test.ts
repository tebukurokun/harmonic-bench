import { describe, expect, it } from 'vitest'
import { CHORD_TEMPLATES } from '../src/theory/chordTemplates'
import {
  degreeSymbol,
  intervalBetween,
  intervalFromSemitones,
  matchesSemitoneName,
} from '../src/theory/intervals'
import { spellMidi, spellWithLetter } from '../src/theory/noteSpelling'
import type { Letter } from '../src/types/music'

function pitch(midi: number, letter: Letter) {
  return spellMidi(midi, spellWithLetter(midi, letter))
}

describe('intervalFromSemitones', () => {
  it.each([
    [0, '完全1度（同音）'],
    [1, '短2度'],
    [2, '長2度'],
    [3, '短3度'],
    [4, '長3度'],
    [5, '完全4度'],
    [7, '完全5度'],
    [8, '短6度'],
    [9, '長6度'],
    [10, '短7度'],
    [11, '長7度'],
    [12, '完全8度（1オクターブ）'],
    [16, '長3度＋1オクターブ'],
    [24, '2オクターブ'],
  ])('%i半音 → %s', (semitones, name) => {
    expect(intervalFromSemitones(semitones).nameJa).toBe(name)
  })

  it('三全音は増4度と減5度を区別できないため曖昧として扱う', () => {
    const info = intervalFromSemitones(6)
    expect(info.nameJa).toBe('増4度／減5度')
    expect(info.ambiguous).toBe(true)
    expect(info.spelled).toBe(false)
  })

  it('オクターブ数を返す', () => {
    expect(intervalFromSemitones(19).octaves).toBe(1)
    expect(intervalFromSemitones(7).octaves).toBe(0)
  })
})

describe('intervalBetween（綴りを考慮）', () => {
  it('C4→E4 は長3度（4半音）', () => {
    const info = intervalBetween(pitch(60, 0), pitch(64, 2))
    expect(info).toMatchObject({ nameJa: '長3度', semitones: 4, spelled: true })
  })

  it('同じ半音数でも綴りで名称が変わる', () => {
    expect(intervalBetween(pitch(60, 0), pitch(68, 4)).nameJa).toBe('増5度')
    expect(intervalBetween(pitch(60, 0), pitch(68, 5)).nameJa).toBe('短6度')
    expect(intervalBetween(pitch(60, 0), pitch(66, 3)).nameJa).toBe('増4度')
    expect(intervalBetween(pitch(60, 0), pitch(66, 4)).nameJa).toBe('減5度')
    expect(intervalBetween(pitch(60, 0), pitch(69, 6)).nameJa).toBe('減7度')
  })

  it('複音程と8度を扱う', () => {
    expect(intervalBetween(pitch(60, 0), pitch(72, 0)).nameJa).toBe('完全8度')
    expect(intervalBetween(pitch(60, 0), pitch(71, 0)).nameJa).toBe('減8度')
    expect(intervalBetween(pitch(60, 0), pitch(76, 2)).nameJa).toBe('長3度＋1オクターブ')
  })

  it('異名同音の同音は減2度などとして区別する', () => {
    expect(intervalBetween(pitch(60, 6), pitch(60, 0)).nameJa).toBe('減2度')
  })
})

describe('matchesSemitoneName（綴りと半音数による音程名の一致）', () => {
  it('綴りの度数が半音数による音程名と同じなら一致する', () => {
    expect(matchesSemitoneName(pitch(64, 2), pitch(68, 4))).toBe(true) // E→G♯ 長3度
    expect(matchesSemitoneName(pitch(64, 2), pitch(68, 5))).toBe(false) // E→A♭ 減4度
    expect(matchesSemitoneName(pitch(60, 0), pitch(72, 0))).toBe(true) // C→C 1オクターブ
    expect(matchesSemitoneName(pitch(52, 2), pitch(68, 4))).toBe(true) // 長3度＋1オクターブ
  })

  it('6半音は増4度・減5度のどちらでも一致する', () => {
    expect(matchesSemitoneName(pitch(60, 0), pitch(66, 3))).toBe(true)
    expect(matchesSemitoneName(pitch(60, 0), pitch(66, 4))).toBe(true)
  })
})

describe('degreeSymbol', () => {
  it.each([
    ['major', 'R 3 5'],
    ['minor', 'R ♭3 5'],
    ['dominant7', 'R 3 5 ♭7'],
    ['major7', 'R 3 5 7'],
    ['minor7', 'R ♭3 5 ♭7'],
    ['diminished', 'R ♭3 ♭5'],
    ['augmented', 'R 3 ♯5'],
    ['halfDiminished7', 'R ♭3 ♭5 ♭7'],
    ['diminished7', 'R ♭3 ♭5 𝄫7'],
    ['major6', 'R 3 5 6'],
    ['minor6', 'R ♭3 5 6'],
    ['sus4', 'R 4 5'],
    ['sus2', 'R 2 5'],
  ])('%s の度数は %s', (id, expected) => {
    const template = CHORD_TEMPLATES.find((t) => t.id === id)
    const symbols = template?.intervals.map((semitones, i) =>
      degreeSymbol(template.letterSteps[i], semitones),
    )
    expect(symbols?.join(' ')).toBe(expected)
  })
})
