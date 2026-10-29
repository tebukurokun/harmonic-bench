import type { CSSProperties, PointerEvent } from 'react'
import type { Mode } from '../types/music'

interface Props {
  midi: number
  /** 読み上げ用の名前（例: C4、C♯4 / D♭4） */
  label: string
  /** 鍵盤上に表示する短い名前（白鍵のみ） */
  shortLabel?: string
  /** 対応するPCキー */
  hint?: string
  isBlack: boolean
  mode: Mode
  selected: boolean
  held: boolean
  /** 根音からの度数記号（和音として判定できたときのみ） */
  degree?: string
  style?: CSSProperties
  onPress: (midi: number, sourceId: string) => void
  onRelease: (midi: number, sourceId: string) => void
  /** クリック／タップ（和音作成モード）、またはキーボード操作によるボタン押下 */
  onActivate: (midi: number) => void
}

export function KeyboardKey({
  midi,
  label,
  shortLabel,
  hint,
  isBlack,
  mode,
  selected,
  held,
  degree,
  style,
  onPress,
  onRelease,
  onActivate,
}: Props) {
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== 'perform' || event.button !== 0) return
    try {
      // 指やマウスが鍵盤の外へずれても、離したときに確実に止める
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // setPointerCapture 非対応環境では無視
    }
    onPress(midi, `pointer:${event.pointerId}`)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== 'perform') return
    onRelease(midi, `pointer:${event.pointerId}`)
  }

  const classNames = ['key', isBlack ? 'key--black' : 'key--white']
  if (selected) classNames.push('is-selected')
  if (held) classNames.push('is-held')

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      style={style}
      aria-label={label}
      aria-pressed={mode === 'chord' ? selected : undefined}
      title={hint ? `${label}（キー: ${hint}）` : label}
      data-midi={midi}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onClick={(event) => {
        // 演奏モードではポインター操作で発音済みのため、キーボード操作（detail=0）のみ扱う
        if (mode === 'chord' || event.detail === 0) onActivate(midi)
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {selected && (
        <span className="key__marker" aria-hidden="true">
          ●
        </span>
      )}
      {degree && (
        <span
          className={`key__degree${degree === 'R' ? ' key__degree--root' : ''}`}
          aria-hidden="true"
        >
          {degree}
        </span>
      )}
      {hint && (
        <span className="key__hint" aria-hidden="true">
          {hint}
        </span>
      )}
      {shortLabel && (
        <span className="key__label" aria-hidden="true">
          {shortLabel}
        </span>
      )}
    </button>
  )
}
