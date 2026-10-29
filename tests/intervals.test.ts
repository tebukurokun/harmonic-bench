import { describe, expect, it } from 'vitest'
import { intervalBetween, intervalFromSemitones } from '../src/theory/intervals'
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
