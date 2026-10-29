import type { NoteSpelling } from '../types/music'
import { CHORD_TEMPLATES, type ChordTemplate } from './chordTemplates'
import { degreeSymbol } from './intervals'
import {
  defaultSpelling,
  formatSpelling,
  rootSpellingCandidates,
  spellInterval,
} from './noteSpelling'
import { pitchClass } from './pitch'

export interface ChordTone {
  pitchClass: number
  spelling: NoteSpelling
  degreeLabel: string
  /** 度数の短い記号（例: R, ♭3, 5） */
  degreeSymbol: string
  semitonesFromRoot: number
}

export interface ChordCandidate {
  template: ChordTemplate
  rootPitchClass: number
  root: NoteSpelling
  /** 実際に選ばれた最低音のピッチクラスと綴り */
  bassPitchClass: number
  bass: NoteSpelling
  isInversion: boolean
  /** 基本形 / 第1転回形 / 第2転回形 / 第3転回形 */
  inversionLabel: string
  /** コード記号（例: Cm7, C/E） */
  symbol: string
  /** 日本語名（例: Cマイナーセブンス） */
  nameJa: string
  /** 構成音（根音から積み上げた順） */
  tones: ChordTone[]
}

const INVERSION_LABELS = ['基本形', '第1転回形', '第2転回形', '第3転回形']

/** 根音の綴りとテンプレートから、構成音を音楽理論上の文字で綴る */
export function spellChord(root: NoteSpelling, template: ChordTemplate): NoteSpelling[] {
  return template.intervals.map((semitones, i) =>
    spellInterval(root, template.letterSteps[i], semitones),
  )
}

/** 変化記号が少なく、重変化記号を含まない綴りほど小さい */
export function spellingCost(spellings: readonly NoteSpelling[]): number {
  return spellings.reduce((cost, s) => {
    const size = Math.abs(s.accidental)
    return cost + size + (size >= 2 ? 10 : 0)
  }, 0)
}

/**
 * 黒鍵が根音のとき、♯系と♭系のどちらで綴るかを決める（例: pc 1 のメジャーは D♭、マイナーは C♯m）。
 * キーが選ばれていないため、あくまで暫定の表記である。
 */
export function chooseRootSpelling(rootPc: number, template: ChordTemplate): NoteSpelling {
  const preferred = defaultSpelling(rootPc)
  let best: NoteSpelling | null = null
  let bestCost = Infinity
  for (const candidate of rootSpellingCandidates(rootPc)) {
    const cost = spellingCost(spellChord(candidate, template))
    const isPreferred = candidate.letter === preferred.letter
    if (cost < bestCost || (cost === bestCost && isPreferred)) {
      best = candidate
      bestCost = cost
    }
  }
  return best ?? preferred
}

function buildCandidate(template: ChordTemplate, rootPc: number, bassPc: number): ChordCandidate {
  const root = chooseRootSpelling(rootPc, template)
  const spellings = spellChord(root, template)
  const tones = template.intervals.map((semitones, i) => ({
    pitchClass: pitchClass(rootPc + semitones),
    spelling: spellings[i],
    degreeLabel: template.degreeLabels[i],
    degreeSymbol: degreeSymbol(template.letterSteps[i], semitones),
    semitonesFromRoot: semitones,
  }))
  const bassIndex = tones.findIndex((tone) => tone.pitchClass === bassPc)
  const bass = tones[bassIndex].spelling
  const isInversion = bassIndex !== 0
  const rootName = formatSpelling(root)
  const symbol = `${rootName}${template.suffix}${isInversion ? `/${formatSpelling(bass)}` : ''}`
  return {
    template,
    rootPitchClass: rootPc,
    root,
    bassPitchClass: bassPc,
    bass,
    isInversion,
    inversionLabel: INVERSION_LABELS[bassIndex],
    symbol,
    nameJa: `${rootName}${template.displayNameJa}`,
    tones,
  }
}

/**
 * 選択されたMIDIノートから和音候補を求める。
 * - オクターブ重複は無視し、3〜4種類のピッチクラスのみ判定する
 * - テンプレートとの完全一致のみ（省略音・テンションは推測しない）
 * - 並び順: 最低音が根音の候補 → テンプレートの優先順 → 最低音からの根音の距離
 */
export function detectChord(midiNotes: readonly number[]): ChordCandidate[] {
  if (midiNotes.length === 0) return []
  const pcs = [...new Set(midiNotes.map(pitchClass))]
  if (pcs.length < 3 || pcs.length > 4) return []
  const bassPc = pitchClass(Math.min(...midiNotes))

  const candidates: { candidate: ChordCandidate; order: number[] }[] = []
  for (const rootPc of pcs) {
    const relative = pcs.map((pc) => pitchClass(pc - rootPc)).sort((a, b) => a - b)
    CHORD_TEMPLATES.forEach((template, templateIndex) => {
      if (template.intervals.length !== relative.length) return
      if (!template.intervals.every((interval, i) => interval === relative[i])) return
      candidates.push({
        candidate: buildCandidate(template, rootPc, bassPc),
        order: [rootPc === bassPc ? 0 : 1, templateIndex, pitchClass(rootPc - bassPc)],
      })
    })
  }

  return candidates
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2])
    .map(({ candidate }) => candidate)
}
