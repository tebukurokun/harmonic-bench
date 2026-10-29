import type { SpelledPitch } from '../types/music'
import { accidentalSymbol, NATURAL_PITCH_CLASSES } from './noteSpelling'

/** 綴りが分からないときに半音数（0〜11）から決める音程名 */
const SEMITONE_INTERVAL_NAMES = [
  '完全1度',
  '短2度',
  '長2度',
  '短3度',
  '長3度',
  '完全4度',
  '増4度／減5度',
  '完全5度',
  '短6度',
  '長6度',
  '短7度',
  '長7度',
] as const

/**
 * 半音数（0〜11）から決めた音程名が表す度数（文字の隔たり）。
 * 6半音は増4度（4度）と減5度（5度）の両方を表す。
 */
export const SEMITONE_LETTER_STEPS: readonly (readonly number[])[] = [
  [0],
  [1],
  [1],
  [2],
  [2],
  [3],
  [3, 4],
  [4],
  [5],
  [5],
  [6],
  [6],
]

export interface IntervalInfo {
  /** 低い音から高い音への半音数 */
  semitones: number
  /** 含まれるオクターブ数（複音程のとき 1 以上） */
  octaves: number
  /** 日本語の音程名（例: 長3度、完全5度＋1オクターブ） */
  nameJa: string
  /** 綴りから増減まで確定できたか。false なら半音数からの判定 */
  spelled: boolean
  /** 半音数だけでは名称が一つに決まらない（増4度／減5度など） */
  ambiguous: boolean
}

function withOctaves(simpleName: string, octaves: number): string {
  return octaves > 0 ? `${simpleName}＋${octaves}オクターブ` : simpleName
}

/** 半音数のみから音程名を求める */
export function intervalFromSemitones(semitones: number): IntervalInfo {
  const distance = Math.abs(semitones)
  const octaves = Math.floor(distance / 12)
  const simple = distance % 12
  let nameJa: string
  if (simple === 0 && octaves === 0) nameJa = '完全1度（同音）'
  else if (simple === 0 && octaves === 1) nameJa = '完全8度（1オクターブ）'
  else if (simple === 0) nameJa = `${octaves}オクターブ`
  else nameJa = withOctaves(SEMITONE_INTERVAL_NAMES[simple], octaves)
  return { semitones: distance, octaves, nameJa, spelled: false, ambiguous: simple === 6 }
}

/** 1・4・5・8度は完全系、2・3・6・7度は長短系 */
const PERFECT_DEGREES = new Set([0, 3, 4])

function qualityName(degreeIndex: number, deviation: number): string | null {
  if (PERFECT_DEGREES.has(degreeIndex)) {
    const names: Record<number, string> = {
      [-2]: '重減',
      [-1]: '減',
      0: '完全',
      1: '増',
      2: '重増',
    }
    return names[deviation] ?? null
  }
  const names: Record<number, string> = {
    [-3]: '重減',
    [-2]: '減',
    [-1]: '短',
    0: '長',
    1: '増',
    2: '重増',
  }
  return names[deviation] ?? null
}

function absoluteSteps(pitch: SpelledPitch): number {
  return pitch.letter + pitch.octave * 7
}

function absoluteMidi(pitch: SpelledPitch): number {
  return (pitch.octave + 1) * 12 + NATURAL_PITCH_CLASSES[pitch.letter] + pitch.accidental
}

/**
 * 2音の綴りが、半音数から決めた音程名と同じ度数になっているか。
 * 例: E→G♯ は長3度で一致、E→A♭ は綴りの上では減4度なので一致しない。低い音を lower に渡すこと。
 */
export function matchesSemitoneName(lower: SpelledPitch, upper: SpelledPitch): boolean {
  const semitones = absoluteMidi(upper) - absoluteMidi(lower)
  if (semitones < 0) return false
  const steps = absoluteSteps(upper) - absoluteSteps(lower)
  const octaveSteps = Math.floor(semitones / 12) * 7
  return SEMITONE_LETTER_STEPS[semitones % 12].some((step) => step + octaveSteps === steps)
}

/**
 * 綴りを考慮して音程名を求める（例: C→G♯ は増5度、C→A♭ は短6度）。
 * 低い音を lower に渡すこと。名称を確定できない場合は半音数による判定に戻す。
 */
export function intervalBetween(lower: SpelledPitch, upper: SpelledPitch): IntervalInfo {
  const semitones = absoluteMidi(upper) - absoluteMidi(lower)
  const steps = absoluteSteps(upper) - absoluteSteps(lower)
  if (semitones < 0 || steps < 0) return intervalFromSemitones(semitones)

  // 8度ちょうどの文字差（C→C♭ など）は「1度＋1オクターブ」ではなく「8度」として扱う
  let octaves = Math.floor(steps / 7)
  const degreeIndex = steps % 7
  let baseSemitones = NATURAL_PITCH_CLASSES[degreeIndex]
  const isOctave = degreeIndex === 0 && octaves > 0
  if (isOctave) {
    octaves -= 1
    baseSemitones = 12
  }
  const quality = qualityName(degreeIndex, semitones - octaves * 12 - baseSemitones)
  if (!quality) return intervalFromSemitones(semitones)

  const simpleName = `${quality}${isOctave ? 8 : degreeIndex + 1}度`
  return {
    semitones,
    octaves: Math.floor(semitones / 12),
    nameJa: withOctaves(simpleName, octaves),
    spelled: true,
    ambiguous: false,
  }
}

/**
 * 根音からの度数を鍵盤に載せる短い記号で表す（例: 根音 R、長3度 3、短3度 ♭3、増5度 ♯5、減7度 𝄫7）。
 * 長音程・完全音程を基準にし、そこからの差を変化記号で示す。
 */
export function degreeSymbol(letterSteps: number, semitones: number): string {
  const degreeIndex = letterSteps % 7
  if (degreeIndex === 0 && semitones === 0) return 'R'
  return `${accidentalSymbol(semitones - NATURAL_PITCH_CLASSES[degreeIndex])}${degreeIndex + 1}`
}
