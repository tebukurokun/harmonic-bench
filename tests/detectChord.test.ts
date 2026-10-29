import { describe, expect, it } from 'vitest'
import { analyzeNotes } from '../src/theory/analyze'
import { CHORD_TEMPLATES } from '../src/theory/chordTemplates'
import { detectChord, spellChord } from '../src/theory/detectChord'
import { formatSpelling, spellingPitchClass, toLetter } from '../src/theory/noteSpelling'
import { pitchClass } from '../src/theory/pitch'

function symbols(midi: number[]) {
  return detectChord(midi).map((c) => c.symbol)
}

function spelled(midi: number[]) {
  return detectChord(midi)[0].tones.map((t) => formatSpelling(t.spelling))
}

describe('detectChord: 受け入れ基準', () => {
  it('[60,64,67] → C', () => {
    expect(symbols([60, 64, 67])).toEqual(['C'])
    expect(detectChord([60, 64, 67])[0].nameJa).toBe('Cメジャー')
  })

  it('[60,63,67] → Cm', () => {
    expect(symbols([60, 63, 67])[0]).toBe('Cm')
    expect(spelled([60, 63, 67])).toEqual(['C', 'E♭', 'G'])
  })

  it('[60,63,67,70] → Cm7（C/E♭ などと誤判定しない）', () => {
    const result = symbols([60, 63, 67, 70])
    expect(result[0]).toBe('Cm7')
    expect(result).not.toContain('C/E♭')
    expect(spelled([60, 63, 67, 70])).toEqual(['C', 'E♭', 'G', 'B♭'])
  })

  it('[60,64,67,70] → C7', () => {
    expect(symbols([60, 64, 67, 70])[0]).toBe('C7')
    expect(spelled([60, 64, 67, 70])).toEqual(['C', 'E', 'G', 'B♭'])
  })

  it('[60,64,67,71] → Cmaj7', () => {
    expect(symbols([60, 64, 67, 71])).toEqual(['Cmaj7'])
    expect(spelled([60, 64, 67, 71])).toEqual(['C', 'E', 'G', 'B'])
  })

  it('[64,67,72] → C/E（Cメジャーの第1転回形）', () => {
    const [candidate] = detectChord([64, 67, 72])
    expect(candidate.symbol).toBe('C/E')
    expect(candidate.isInversion).toBe(true)
    expect(candidate.inversionLabel).toBe('第1転回形')
  })

  it('[48,60,64,67] → C（オクターブ重複で種類が変わらない）', () => {
    expect(symbols([48, 60, 64, 67])).toEqual(['C'])
  })

  it('C6 と Am7 に相当する集合では複数候補を提示する', () => {
    expect(symbols([60, 64, 67, 69])).toEqual(['C6', 'Am7/C'])
    expect(symbols([57, 60, 64, 67])).toEqual(['Am7', 'C6/A'])
  })

  it('増三和音は3つの根音候補をすべて提示する', () => {
    const result = detectChord([60, 64, 68])
    expect(result).toHaveLength(3)
    expect(result.map((c) => c.rootPitchClass).sort((a, b) => a - b)).toEqual([0, 4, 8])
    expect(result[0].symbol).toBe('Caug')
  })

  it('減七和音は4つの根音候補をすべて提示する', () => {
    const result = detectChord([60, 63, 66, 69])
    expect(result).toHaveLength(4)
    expect(result[0].symbol).toBe('Cdim7')
    expect(spelled([60, 63, 66, 69])).toEqual(['C', 'E♭', 'G♭', 'B𝄫'])
  })

  it('同じ構成音の sus2 と sus4 は両方提示する', () => {
    expect(symbols([60, 62, 67])).toEqual(['Csus2', 'Gsus4/C'])
  })

  it('未定義の音集合には和音名を付けない', () => {
    expect(detectChord([60, 61, 62])).toEqual([])
    expect(detectChord([60, 64, 67, 69, 71])).toEqual([])
    expect(detectChord([60, 67])).toEqual([])
    expect(detectChord([])).toEqual([])
  })

  it('C♯ major を C♯–E♯–G♯ と綴れる', () => {
    const major = CHORD_TEMPLATES.find((t) => t.id === 'major')
    if (!major) throw new Error('major テンプレートがありません')
    expect(spellChord({ letter: 0, accidental: 1 }, major).map(formatSpelling)).toEqual([
      'C♯',
      'E♯',
      'G♯',
    ])
  })

  it('F♯ major の第3音は A♯', () => {
    expect(spelled([66, 70, 73])).toEqual(['F♯', 'A♯', 'C♯'])
  })

  it('黒鍵の根音は変化記号が少ない綴りを選ぶ', () => {
    expect(symbols([61, 65, 68])[0]).toBe('D♭')
    expect(symbols([61, 64, 68])[0]).toBe('C♯m')
    expect(symbols([70, 73, 77])[0]).toBe('B♭m')
    expect(symbols([68, 71, 75])[0]).toBe('G♯m')
  })
})

describe('detectChord: 全テンプレートを12音へ移調', () => {
  for (const template of CHORD_TEMPLATES) {
    for (let root = 0; root < 12; root++) {
      it(`${template.id} / root pc ${root}`, () => {
        const midi = template.intervals.map((interval) => 48 + root + interval)
        const candidates = detectChord(midi)
        const primary = candidates[0]
        expect(primary.template.id).toBe(template.id)
        expect(primary.rootPitchClass).toBe(root)
        expect(primary.isInversion).toBe(false)
        expect(primary.symbol.endsWith(template.suffix)).toBe(true)

        // 綴りは異名同音の差を許容しつつ、度数どおりの文字と正しいピッチクラスであること
        primary.tones.forEach((tone, i) => {
          expect(spellingPitchClass(tone.spelling)).toBe(pitchClass(root + template.intervals[i]))
          expect(tone.spelling.letter).toBe(toLetter(primary.root.letter + template.letterSteps[i]))
          expect(tone.degreeLabel).toBe(template.degreeLabels[i])
        })

        // 転回形でも同じ種類の和音が候補に含まれる
        const inverted = [...midi.slice(1), midi[0] + 12]
        const invertedCandidates = detectChord(inverted)
        expect(
          invertedCandidates.some(
            (c) => c.template.id === template.id && c.rootPitchClass === root && c.isInversion,
          ),
        ).toBe(true)
      })
    }
  }
})

describe('analyzeNotes', () => {
  it('[60] は単音として扱う', () => {
    const result = analyzeNotes([60])
    expect(result.kind).toBe('single')
    expect(result.notes[0].name).toBe('C4')
    expect(result.candidates).toEqual([])
  })

  it('[60,67] は完全5度として扱う', () => {
    const result = analyzeNotes([60, 67])
    expect(result.kind).toBe('interval')
    expect(result.intervals[0].interval.nameJa).toBe('完全5度')
    expect(result.intervals[0].interval.semitones).toBe(7)
  })

  it('2音は、音程名に合うように綴る', () => {
    const names = (midi: number[]) => {
      const result = analyzeNotes(midi)
      return [...result.notes.map((n) => n.name), result.intervals[0].interval.nameJa]
    }
    expect(names([64, 68])).toEqual(['E4', 'G♯4', '長3度'])
    // 低い黒鍵は変化記号の少ないほうで綴る（A♭3–C♭4 ではなく G♯3–B3）
    expect(names([56, 59])).toEqual(['G♯3', 'B3', '短3度'])
    expect(names([61, 63])).toEqual(['C♯4', 'D♯4', '長2度'])
    expect(names([52, 68])).toEqual(['E3', 'G♯4', '長3度＋1オクターブ'])
    // 暫定表記のままで一致するものは変えない
    expect(names([60, 66])).toEqual(['C4', 'F♯4', '増4度／減5度'])
    expect(names([63, 70])).toEqual(['E♭4', 'B♭4', '完全5度'])
    expect(names([60, 72])).toEqual(['C4', 'C5', '完全8度（1オクターブ）'])
    expect(analyzeNotes([64, 68]).intervals[0].matchesSpelling).toBe(true)
  })

  it('判定できない集合では、暫定表記の綴りと合わない音程を区別する', () => {
    const result = analyzeNotes([60, 64, 68, 71])
    expect(result.notes.map((n) => n.name)).toEqual(['C4', 'E4', 'A♭4', 'B4'])
    expect(result.intervals.map((p) => [p.interval.nameJa, p.matchesSpelling])).toEqual([
      ['長3度', true],
      ['長3度', false],
      ['短3度', false],
    ])
  })

  it('和音判定時は構成音に役割と理論上の綴りを付ける', () => {
    const result = analyzeNotes([60, 63, 67, 70])
    expect(result.kind).toBe('chord')
    expect(result.provisionalSpelling).toBe(false)
    expect(result.notes.map((n) => [n.name, n.role?.label, n.role?.semitonesFromRoot])).toEqual([
      ['C4', '根音', 0],
      ['E♭4', '短3度', 3],
      ['G4', '完全5度', 7],
      ['B♭4', '短7度', 10],
    ])
    expect(result.intervals.map((p) => p.interval.nameJa)).toEqual(['短3度', '長3度', '短3度'])
  })

  it('構成音の綴りは和音の構造から決める（C♯m の E は F♭ にしない）', () => {
    const result = analyzeNotes([61, 64, 68])
    expect(result.notes.map((n) => n.name)).toEqual(['C♯4', 'E4', 'G♯4'])
  })

  it('判定できない集合は和音名なしで構成音と音程を返す', () => {
    const result = analyzeNotes([60, 61, 62])
    expect(result.kind).toBe('unknown')
    expect(result.message).toBe('現在対応している和音に一致しません')
    expect(result.notes).toHaveLength(3)
    expect(result.intervals).toHaveLength(2)
    expect(result.provisionalSpelling).toBe(true)
  })

  it('ピッチクラスが2種類しかない3音は判定対象外', () => {
    expect(analyzeNotes([60, 67, 72]).kind).toBe('unsupported')
  })

  it('空の選択', () => {
    expect(analyzeNotes([]).kind).toBe('empty')
  })
})
