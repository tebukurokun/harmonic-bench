import type { Analysis } from '../theory/analyze'
import { formatSpelling } from '../theory/noteSpelling'
import type { Mode } from '../types/music'

interface Props {
  analysis: Analysis
  mode: Mode
}

function Headline({ analysis, mode }: Props) {
  const [primary] = analysis.candidates
  switch (analysis.kind) {
    case 'empty':
      return (
        <p className="result__placeholder">
          {mode === 'chord'
            ? '鍵盤をタップして音を選ぶと、和音名や音程が表示されます。'
            : '鍵盤を押している間、押している音を分析します。'}
        </p>
      )
    case 'single':
      return (
        <>
          <p className="result__label">単音</p>
          <p className="result__symbol">{analysis.notes[0].name}</p>
        </>
      )
    case 'interval': {
      const [pair] = analysis.intervals
      return (
        <>
          <p className="result__label">音程</p>
          <p className="result__symbol">{pair.interval.nameJa}</p>
          <p className="result__sub">
            {pair.from.name} → {pair.to.name}（{pair.interval.semitones}半音）
          </p>
        </>
      )
    }
    case 'chord':
      return (
        <>
          <p className="result__label">判定結果</p>
          <p className="result__symbol">{primary.symbol}</p>
          <p className="result__sub">
            {primary.nameJa}
            {primary.isInversion &&
              `（${primary.inversionLabel}・最低音 ${formatSpelling(primary.bass)}）`}
          </p>
        </>
      )
    case 'unknown':
    case 'unsupported':
      return (
        <>
          <p className="result__label">判定結果</p>
          <p className="result__none">{analysis.message}</p>
        </>
      )
  }
}

export function ChordAnalysis({ analysis, mode }: Props) {
  const alternatives = analysis.candidates.slice(1)
  return (
    <section className="result" aria-labelledby="result-heading" aria-live="polite">
      <h2 id="result-heading" className="visually-hidden">
        分析結果
      </h2>
      <div className="result__main">
        <Headline analysis={analysis} mode={mode} />
      </div>
      {alternatives.length > 0 && (
        <div className="result__alternatives">
          <p className="result__label">別の解釈</p>
          <ul>
            {alternatives.map((candidate) => (
              <li key={candidate.symbol}>
                <span className="chip">{candidate.symbol}</span>
                <span className="chip__note">{candidate.nameJa}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
