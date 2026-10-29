import { keyHint } from '../hooks/useKeyboardInput'
import { defaultPitchName, keyLabel } from '../theory/noteSpelling'
import { isBlackKey } from '../theory/pitch'
import type { Mode } from '../types/music'
import { KeyboardKey } from './KeyboardKey'

export const VISIBLE_KEY_COUNT = 24

interface Props {
  octaveStart: number
  mode: Mode
  selected: ReadonlySet<number>
  held: ReadonlySet<number>
  /** 和音として判定できたときの、MIDI番号ごとの度数記号（例: R, ♭3） */
  degrees: ReadonlyMap<number, string>
  rangeLabel: string
  onPress: (midi: number, sourceId: string) => void
  onRelease: (midi: number, sourceId: string) => void
  onActivate: (midi: number) => void
}

export function PianoKeyboard({
  octaveStart,
  mode,
  selected,
  held,
  degrees,
  rangeLabel,
  onPress,
  onRelease,
  onActivate,
}: Props) {
  const keys = Array.from({ length: VISIBLE_KEY_COUNT }, (_, offset) => octaveStart + offset)
  const whiteCount = keys.filter((midi) => !isBlackKey(midi)).length

  let whiteIndex = 0
  const keyElements = keys.map((midi, offset) => {
    const isBlack = isBlackKey(midi)
    // 黒鍵は直前の白鍵の右端にまたがるよう配置する
    const style = isBlack
      ? { left: `calc(var(--white-w) * ${whiteIndex} - var(--black-w) / 2)` }
      : undefined
    if (!isBlack) whiteIndex += 1
    return (
      <KeyboardKey
        key={midi}
        midi={midi}
        label={keyLabel(midi)}
        shortLabel={isBlack ? undefined : defaultPitchName(midi)}
        hint={keyHint(offset)}
        isBlack={isBlack}
        mode={mode}
        selected={selected.has(midi)}
        held={held.has(midi)}
        degree={degrees.get(midi)}
        style={style}
        onPress={onPress}
        onRelease={onRelease}
        onActivate={onActivate}
      />
    )
  })

  return (
    <div className="keyboard-case">
      <div className="keyboard-scroll">
        <fieldset
          className="keyboard"
          aria-label={`ピアノ鍵盤 ${rangeLabel}`}
          style={{ ['--white-count' as string]: whiteCount }}
        >
          {keyElements}
        </fieldset>
      </div>
    </div>
  )
}
