import type { Letter, NoteSpelling, SpelledPitch } from '../types/music'
import { pitchClass } from './pitch'

export const LETTER_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** 各文字の幹音（♯♭なし）のピッチクラス */
export const NATURAL_PITCH_CLASSES: readonly number[] = [0, 2, 4, 5, 7, 9, 11]

/**
 * キーや和音の文脈がないときの暫定表記。
 * 学習者が目にすることの多い綴り（C♯, E♭, F♯, A♭, B♭）を採用する。
 */
const DEFAULT_SPELLINGS: readonly NoteSpelling[] = [
  { letter: 0, accidental: 0 },
  { letter: 0, accidental: 1 },
  { letter: 1, accidental: 0 },
  { letter: 2, accidental: -1 },
  { letter: 2, accidental: 0 },
  { letter: 3, accidental: 0 },
  { letter: 3, accidental: 1 },
  { letter: 4, accidental: 0 },
  { letter: 5, accidental: -1 },
  { letter: 5, accidental: 0 },
  { letter: 6, accidental: -1 },
  { letter: 6, accidental: 0 },
]

/** -6〜+5 の範囲へ正規化した半音差 */
function wrapSemitones(value: number): number {
  const wrapped = ((value % 12) + 12) % 12
  return wrapped > 6 ? wrapped - 12 : wrapped
}

export function toLetter(value: number): Letter {
  return (((value % 7) + 7) % 7) as Letter
}

export function spellingPitchClass(spelling: NoteSpelling): number {
  return pitchClass(NATURAL_PITCH_CLASSES[spelling.letter] + spelling.accidental)
}

export function defaultSpelling(pc: number): NoteSpelling {
  return DEFAULT_SPELLINGS[pitchClass(pc)]
}

/** 指定した文字でピッチクラスを綴る（例: pc 5 を文字 E で綴ると E♯） */
export function spellWithLetter(pc: number, letter: Letter): NoteSpelling {
  return {
    letter,
    accidental: wrapSemitones(pitchClass(pc) - NATURAL_PITCH_CLASSES[letter]),
  }
}

/** 黒鍵なら ♯系と♭系の2通り、白鍵なら幹音1通り */
export function rootSpellingCandidates(pc: number): NoteSpelling[] {
  const natural = NATURAL_PITCH_CLASSES.indexOf(pitchClass(pc))
  if (natural >= 0) return [{ letter: natural as Letter, accidental: 0 }]
  const lower = NATURAL_PITCH_CLASSES.indexOf(pitchClass(pc - 1))
  return [
    { letter: lower as Letter, accidental: 1 },
    { letter: toLetter(lower + 1), accidental: -1 },
  ]
}

/** 根音から「度数（文字の隔たり）」と半音数を指定して綴る */
export function spellInterval(
  root: NoteSpelling,
  letterSteps: number,
  semitones: number,
): NoteSpelling {
  return spellWithLetter(spellingPitchClass(root) + semitones, toLetter(root.letter + letterSteps))
}

export function accidentalSymbol(accidental: number): string {
  if (accidental === 2) return '𝄪'
  if (accidental === -2) return '𝄫'
  if (accidental > 0) return '♯'.repeat(accidental)
  if (accidental < 0) return '♭'.repeat(-accidental)
  return ''
}

export function formatSpelling(spelling: NoteSpelling): string {
  return LETTER_NAMES[spelling.letter] + accidentalSymbol(spelling.accidental)
}

/** MIDI番号と綴りから、オクターブ付きの綴りを得る（B♯3 = MIDI 60 など） */
export function spellMidi(midi: number, spelling: NoteSpelling): SpelledPitch {
  const naturalMidi = midi - spelling.accidental
  return { ...spelling, octave: Math.floor(naturalMidi / 12) - 1 }
}

export function formatPitch(pitch: SpelledPitch): string {
  return formatSpelling(pitch) + pitch.octave
}

/** 文脈なしの暫定表記での音名＋オクターブ（例: C4, E♭4） */
export function defaultPitchName(midi: number): string {
  return formatPitch(spellMidi(midi, defaultSpelling(pitchClass(midi))))
}

/** 鍵盤用の表示名。黒鍵は ♯/♭ 両方を併記する（例: C♯4 / D♭4） */
export function keyLabel(midi: number): string {
  const [first, second] = rootSpellingCandidates(pitchClass(midi))
  if (!second) return formatPitch(spellMidi(midi, first))
  return `${formatPitch(spellMidi(midi, first))} / ${formatPitch(spellMidi(midi, second))}`
}
