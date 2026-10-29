import type { SpelledPitch } from '../types/music'
import { type ChordCandidate, detectChord } from './detectChord'
import { type IntervalInfo, intervalBetween, intervalFromSemitones } from './intervals'
import { defaultSpelling, formatPitch, spellMidi } from './noteSpelling'
import { midiToFrequency, pitchClass, sortUniqueMidi } from './pitch'

export type AnalysisKind =
  /** 音が選ばれていない */
  | 'empty'
  /** 単音 */
  | 'single'
  /** 2音（音程を主表示） */
  | 'interval'
  /** 和音として判定できた */
  | 'chord'
  /** 判定対象だが標準的な和音に該当しない */
  | 'unknown'
  /** ピッチクラスが1〜2種類、または5種類以上でMVPの判定対象外 */
  | 'unsupported'

export interface NoteInfo {
  midi: number
  pitch: SpelledPitch
  name: string
  frequency: number
  /** 和音判定時の根音からの役割 */
  role?: { label: string; symbol: string; semitonesFromRoot: number }
}

export interface IntervalPair {
  from: NoteInfo
  to: NoteInfo
  interval: IntervalInfo
}

export interface Analysis {
  kind: AnalysisKind
  notes: NoteInfo[]
  pitchClassCount: number
  candidates: ChordCandidate[]
  /** 隣り合う音（低い→高い）の音程 */
  intervals: IntervalPair[]
  /** 和音の文脈がなく、音名が暫定表記であるか */
  provisionalSpelling: boolean
  /** 判定できない理由など */
  message?: string
}

function unsupportedMessage(pitchClassCount: number): string {
  if (pitchClassCount === 1) return '同じ音名のオクターブ違いのみのため、和音名は判定しません。'
  if (pitchClassCount === 2)
    return '2種類の音名だけでは和音名を判定しません。音程を確認してください。'
  return '5種類以上の音名を含む集合は、現在の判定対象外です。'
}

export function analyzeNotes(midiNotes: readonly number[]): Analysis {
  const sorted = sortUniqueMidi(midiNotes)
  const pitchClassCount = new Set(sorted.map(pitchClass)).size
  const candidates = detectChord(sorted)
  const primary = candidates.at(0)

  const notes: NoteInfo[] = sorted.map((midi) => {
    const pc = pitchClass(midi)
    const tone = primary?.tones.find((t) => t.pitchClass === pc)
    const pitch = spellMidi(midi, tone?.spelling ?? defaultSpelling(pc))
    return {
      midi,
      pitch,
      name: formatPitch(pitch),
      frequency: midiToFrequency(midi),
      role: tone && {
        label: tone.degreeLabel,
        symbol: tone.degreeSymbol,
        semitonesFromRoot: tone.semitonesFromRoot,
      },
    }
  })

  const intervals = notes.slice(1).map((to, i) => {
    const from = notes[i]
    return {
      from,
      to,
      interval: primary
        ? intervalBetween(from.pitch, to.pitch)
        : intervalFromSemitones(to.midi - from.midi),
    }
  })

  let kind: AnalysisKind
  let message: string | undefined
  if (sorted.length === 0) kind = 'empty'
  else if (sorted.length === 1) kind = 'single'
  else if (sorted.length === 2) kind = 'interval'
  else if (primary) kind = 'chord'
  else if (pitchClassCount >= 3 && pitchClassCount <= 4) {
    kind = 'unknown'
    message = '判定できる標準的な和音なし'
  } else {
    kind = 'unsupported'
    message = unsupportedMessage(pitchClassCount)
  }

  return {
    kind,
    notes,
    pitchClassCount,
    candidates,
    intervals,
    provisionalSpelling: !primary,
    message,
  }
}
