import type { Analysis } from '../theory/analyze'
import { formatFrequency } from '../theory/pitch'

interface Props {
  analysis: Analysis
}

export function NoteDetails({ analysis }: Props) {
  if (analysis.notes.length === 0) return null
  const showRoles = analysis.kind === 'chord'
  return (
    <section className="panel" aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="panel__title">
        構成音
      </h2>
      <div className="table-scroll">
        <table className="notes-table">
          <thead>
            <tr>
              <th scope="col">音名</th>
              <th scope="col">周波数</th>
              {showRoles && <th scope="col">根音からの役割</th>}
              {showRoles && <th scope="col">半音差</th>}
              <th scope="col">MIDI</th>
            </tr>
          </thead>
          <tbody>
            {analysis.notes.map((note) => (
              <tr key={note.midi}>
                <th scope="row" className="notes-table__name">
                  {note.name}
                </th>
                <td className="num">{formatFrequency(note.frequency)} Hz</td>
                {showRoles && <td>{note.role?.label}</td>}
                {showRoles && <td className="num">{note.role?.semitonesFromRoot}</td>}
                <td className="num">{note.midi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        周波数は12平均律・A4=440 Hz における基音の値です。
        {analysis.provisionalSpelling &&
          ' 和音が定まらないため、音名（C♯/D♭ など）は暫定表記です。'}
      </p>
    </section>
  )
}
