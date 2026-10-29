import type { Analysis } from '../theory/analyze'
import { formatSpelling } from '../theory/noteSpelling'

interface Props {
  analysis: Analysis
}

export function TheoryExplanation({ analysis }: Props) {
  if (analysis.notes.length < 2) return null
  const [primary] = analysis.candidates
  const hasAmbiguousInterval = analysis.intervals.some((pair) => pair.interval.ambiguous)

  return (
    <section className="panel" aria-labelledby="theory-heading">
      <h2 id="theory-heading" className="panel__title">
        解説
      </h2>
      {primary && (
        <>
          <p className="structure">
            {primary.tones.map((tone, i) => (
              <span key={tone.pitchClass} className="structure__tone">
                {i > 0 && <span aria-hidden="true"> – </span>}
                <span className="structure__name">{formatSpelling(tone.spelling)}</span>
                <span className="structure__role">（{tone.degreeLabel}）</span>
              </span>
            ))}
          </p>
          <p>
            {primary.nameJa}: {primary.template.descriptionJa}
          </p>
          {primary.isInversion && (
            <p>
              最低音が根音 {formatSpelling(primary.root)} ではなく {formatSpelling(primary.bass)}{' '}
              のため、{primary.inversionLabel}として {primary.symbol} と表記します。
            </p>
          )}
          {analysis.candidates.length > 1 && (
            <p className="note">
              構成音だけでは和音名が一つに決まりません。最低音や前後の和音（文脈）によって読み方が変わります。
            </p>
          )}
        </>
      )}
      <h3 className="panel__subtitle">隣り合う音の音程</h3>
      <ul className="interval-list">
        {analysis.intervals.map((pair) => (
          <li key={`${pair.from.midi}-${pair.to.midi}`}>
            <span className="interval-list__notes">
              {pair.from.name} → {pair.to.name}
            </span>
            <span className="interval-list__name">{pair.interval.nameJa}</span>
            <span className="interval-list__semitones">{pair.interval.semitones}半音</span>
          </li>
        ))}
      </ul>
      {!primary && (
        <p className="note">
          和音の文脈がないため、音程は半音数から判定しています。
          {hasAmbiguousInterval && ' 6半音は、綴りによって増4度とも減5度とも呼ばれます。'}
        </p>
      )}
    </section>
  )
}
