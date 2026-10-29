import { TIMBRES } from '../audio/timbres'
import type { Mode, Timbre } from '../types/music'

const MODES: readonly { id: Mode; labelJa: string }[] = [
  { id: 'perform', labelJa: '演奏' },
  { id: 'chord', labelJa: '和音作成' },
]

interface ModeVolumeProps {
  mode: Mode
  volume: number
  onModeChange: (mode: Mode) => void
  onVolumeChange: (volume: number) => void
}

export function ModeVolumeControls({
  mode,
  volume,
  onModeChange,
  onVolumeChange,
}: ModeVolumeProps) {
  return (
    <div className="controls controls--header">
      <fieldset className="segmented" aria-label="操作モード">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className="segmented__button"
            aria-pressed={mode === m.id}
            onClick={() => onModeChange(m.id)}
          >
            <span className="led" aria-hidden="true" />
            {m.labelJa}
          </button>
        ))}
      </fieldset>
      <label className="volume">
        <span>音量</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
        />
        <output className="volume__value" aria-hidden="true">
          {Math.round(volume * 100)}
        </output>
      </label>
    </div>
  )
}

interface SoundProps {
  timbre: Timbre
  rangeLabel: string
  canShiftDown: boolean
  canShiftUp: boolean
  onTimbreChange: (timbre: Timbre) => void
  onShiftOctave: (direction: -1 | 1) => void
}

export function SoundControls({
  timbre,
  rangeLabel,
  canShiftDown,
  canShiftUp,
  onTimbreChange,
  onShiftOctave,
}: SoundProps) {
  return (
    <div className="controls controls--sound">
      <label className="field">
        <span>音色</span>
        <select value={timbre} onChange={(event) => onTimbreChange(event.target.value as Timbre)}>
          {TIMBRES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.labelJa}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="octave" aria-label="表示する音域">
        <span className="octave__title">オクターブ</span>
        <button
          type="button"
          className="icon-button"
          aria-label="1オクターブ下げる"
          disabled={!canShiftDown}
          onClick={() => onShiftOctave(-1)}
        >
          −
        </button>
        <span className="octave__range" aria-live="polite">
          {rangeLabel}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="1オクターブ上げる"
          disabled={!canShiftUp}
          onClick={() => onShiftOctave(1)}
        >
          ＋
        </button>
      </fieldset>
    </div>
  )
}
