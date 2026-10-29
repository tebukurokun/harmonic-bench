export interface ChordTemplate {
  id: string
  /** コード記号の接尾辞（例: m7）。根音名の後ろに付ける */
  suffix: string
  /** 根音名の後ろに付ける日本語名（例: マイナーセブンス） */
  displayNameJa: string
  /** 根音からの半音差 */
  intervals: readonly number[]
  /** 根音からの文字の隔たり（3度なら 2、7度なら 6）。綴りの決定に使う */
  letterSteps: readonly number[]
  /** 構成音の役割（intervals と同じ順序） */
  degreeLabels: readonly string[]
  descriptionJa: string
}

/**
 * MVPで扱うコードテンプレート。
 * 配列の順序は、同じ音集合に複数の解釈があるときの優先順位としても使う。
 */
export const CHORD_TEMPLATES: readonly ChordTemplate[] = [
  {
    id: 'major',
    suffix: '',
    displayNameJa: 'メジャー',
    intervals: [0, 4, 7],
    letterSteps: [0, 2, 4],
    degreeLabels: ['根音', '長3度', '完全5度'],
    descriptionJa: '根音に長3度と完全5度を重ねた長三和音。明るく安定した響き。',
  },
  {
    id: 'minor',
    suffix: 'm',
    displayNameJa: 'マイナー',
    intervals: [0, 3, 7],
    letterSteps: [0, 2, 4],
    degreeLabels: ['根音', '短3度', '完全5度'],
    descriptionJa: '根音に短3度と完全5度を重ねた短三和音。長三和音より暗く落ち着いた響き。',
  },
  {
    id: 'dominant7',
    suffix: '7',
    displayNameJa: 'セブンス',
    intervals: [0, 4, 7, 10],
    letterSteps: [0, 2, 4, 6],
    degreeLabels: ['根音', '長3度', '完全5度', '短7度'],
    descriptionJa:
      '長三和音に短7度を加えた和音（属七の和音）。次の和音へ進みたくなる緊張感がある。',
  },
  {
    id: 'major7',
    suffix: 'maj7',
    displayNameJa: 'メジャーセブンス',
    intervals: [0, 4, 7, 11],
    letterSteps: [0, 2, 4, 6],
    degreeLabels: ['根音', '長3度', '完全5度', '長7度'],
    descriptionJa: '長三和音に長7度を加えた和音。第7音と、そのすぐ上の根音との間は半音になる。',
  },
  {
    id: 'minor7',
    suffix: 'm7',
    displayNameJa: 'マイナーセブンス',
    intervals: [0, 3, 7, 10],
    letterSteps: [0, 2, 4, 6],
    degreeLabels: ['根音', '短3度', '完全5度', '短7度'],
    descriptionJa: '短三和音に短7度を加えた和音。',
  },
  {
    id: 'diminished',
    suffix: 'dim',
    displayNameJa: 'ディミニッシュ',
    intervals: [0, 3, 6],
    letterSteps: [0, 2, 4],
    degreeLabels: ['根音', '短3度', '減5度'],
    descriptionJa: '短3度を2つ重ねた減三和音。根音と第5音が減5度になり、緊張感のある響き。',
  },
  {
    id: 'augmented',
    suffix: 'aug',
    displayNameJa: 'オーグメント',
    intervals: [0, 4, 8],
    letterSteps: [0, 2, 4],
    degreeLabels: ['根音', '長3度', '増5度'],
    descriptionJa:
      '長3度を2つ重ねた増三和音。オクターブを3等分する対称的な構造のため、どの構成音も根音と解釈できる。',
  },
  {
    id: 'halfDiminished7',
    suffix: 'm7♭5',
    displayNameJa: 'マイナーセブンス・フラットファイブ',
    intervals: [0, 3, 6, 10],
    letterSteps: [0, 2, 4, 6],
    degreeLabels: ['根音', '短3度', '減5度', '短7度'],
    descriptionJa: '減三和音に短7度を加えた和音（半減七の和音、ハーフディミニッシュ）。',
  },
  {
    id: 'diminished7',
    suffix: 'dim7',
    displayNameJa: 'ディミニッシュセブンス',
    intervals: [0, 3, 6, 9],
    letterSteps: [0, 2, 4, 6],
    degreeLabels: ['根音', '短3度', '減5度', '減7度'],
    descriptionJa:
      '減三和音に減7度を加えた和音（減七の和音）。短3度を3つ重ねた対称的な構造のため、4つの構成音のどれも根音と解釈できる。',
  },
  {
    id: 'major6',
    suffix: '6',
    displayNameJa: 'シックス',
    intervals: [0, 4, 7, 9],
    letterSteps: [0, 2, 4, 5],
    degreeLabels: ['根音', '長3度', '完全5度', '長6度'],
    descriptionJa:
      '長三和音に長6度を加えた和音。構成音が短七の和音（例: C6 と Am7）と同じで、どちらと読むかは文脈で決まる。',
  },
  {
    id: 'minor6',
    suffix: 'm6',
    displayNameJa: 'マイナーシックス',
    intervals: [0, 3, 7, 9],
    letterSteps: [0, 2, 4, 5],
    degreeLabels: ['根音', '短3度', '完全5度', '長6度'],
    descriptionJa:
      '短三和音に長6度を加えた和音。構成音が半減七の和音（例: Cm6 と Am7♭5）と同じで、どちらと読むかは文脈で決まる。',
  },
  {
    id: 'sus4',
    suffix: 'sus4',
    displayNameJa: 'サスフォー',
    intervals: [0, 5, 7],
    letterSteps: [0, 3, 4],
    degreeLabels: ['根音', '完全4度', '完全5度'],
    descriptionJa: '第3音の代わりに完全4度を置いた和音。長短が定まらず、3度へ解決したくなる響き。',
  },
  {
    id: 'sus2',
    suffix: 'sus2',
    displayNameJa: 'サスツー',
    intervals: [0, 2, 7],
    letterSteps: [0, 1, 4],
    degreeLabels: ['根音', '長2度', '完全5度'],
    descriptionJa: '第3音の代わりに長2度を置いた和音。長短が定まらない、開放的で浮遊感のある響き。',
  },
]
