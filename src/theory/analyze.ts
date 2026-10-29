import type { NoteSpelling, SpelledPitch } from '../types/music'
import { type ChordCandidate, detectChord, spellingCost } from './detectChord'
import {
  type IntervalInfo,
  intervalBetween,
  intervalFromSemitones,
  matchesSemitoneName,
  SEMITONE_LETTER_STEPS,
} from './intervals'
import {
  defaultSpelling,
  formatPitch,
  rootSpellingCandidates,
  spellInterval,
  spellMidi,
} from './noteSpelling'
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
  /** 判定対象だが、対応している和音に一致しない */
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
  /**
   * 表示する綴りと音程名の度数が一致するか。
   * false のとき、音程名は半音数から決めた「相当」の名前（例: E→A♭ を長3度相当とする）
   */
  matchesSpelling: boolean
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

/**
 * 2音の綴りを、半音数から決めた音程名に合わせる（例: E4 と A♭4 は E4–G♯4 の長3度とする）。
 * 暫定表記のままで一致すればそのまま使う。合わなければ上の音を音程に合わせて綴り直し、
 * 黒鍵の低い音は♯系と♭系のうち変化記号の少ないほうを選ぶ（同点なら暫定表記）。
 */
function spellIntervalPair(lower: number, upper: number): [NoteSpelling, NoteSpelling] {
  const lowerPc = pitchClass(lower)
  const provisional = defaultSpelling(lowerPc)
  const provisionalUpper = defaultSpelling(pitchClass(upper))
  if (matchesSemitoneName(spellMidi(lower, provisional), spellMidi(upper, provisionalUpper))) {
    return [provisional, provisionalUpper]
  }
  const simple = (upper - lower) % 12
  const candidates = rootSpellingCandidates(lowerPc).sort(
    (a, b) => Number(b.letter === provisional.letter) - Number(a.letter === provisional.letter),
  )
  let best: [NoteSpelling, NoteSpelling] = [provisional, provisionalUpper]
  let bestCost = Infinity
  for (const candidate of candidates) {
    const pair: [NoteSpelling, NoteSpelling] = [
      candidate,
      spellInterval(candidate, SEMITONE_LETTER_STEPS[simple][0], simple),
    ]
    const cost = spellingCost(pair)
    if (cost < bestCost) {
      best = pair
      bestCost = cost
    }
  }
  return best
}

export function analyzeNotes(midiNotes: readonly number[]): Analysis {
  const sorted = sortUniqueMidi(midiNotes)
  const pitchClassCount = new Set(sorted.map(pitchClass)).size
  const candidates = detectChord(sorted)
  const primary = candidates.at(0)
  const pairSpellings = sorted.length === 2 ? spellIntervalPair(sorted[0], sorted[1]) : null

  const notes: NoteInfo[] = sorted.map((midi, i) => {
    const pc = pitchClass(midi)
    const tone = primary?.tones.find((t) => t.pitchClass === pc)
    const pitch = spellMidi(midi, tone?.spelling ?? pairSpellings?.[i] ?? defaultSpelling(pc))
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
    if (primary)
      return { from, to, interval: intervalBetween(from.pitch, to.pitch), matchesSpelling: true }
    return {
      from,
      to,
      interval: intervalFromSemitones(to.midi - from.midi),
      matchesSpelling: matchesSemitoneName(from.pitch, to.pitch),
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
    message = '現在対応している和音に一致しません'
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
