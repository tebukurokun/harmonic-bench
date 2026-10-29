import { useEffect, useEffectEvent, useRef } from 'react'

/** 表示中の2オクターブに対応するキー（event.code）。下段が低いオクターブ */
export const KEY_CODES = [
  'KeyZ',
  'KeyS',
  'KeyX',
  'KeyD',
  'KeyC',
  'KeyV',
  'KeyG',
  'KeyB',
  'KeyH',
  'KeyN',
  'KeyJ',
  'KeyM',
  'KeyQ',
  'Digit2',
  'KeyW',
  'Digit3',
  'KeyE',
  'KeyR',
  'Digit5',
  'KeyT',
  'Digit6',
  'KeyY',
  'Digit7',
  'KeyU',
] as const

/** 画面に表示するキー名（例: KeyZ → Z） */
export function keyHint(offset: number): string | undefined {
  return KEY_CODES[offset]?.replace(/^(Key|Digit)/, '')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

interface Options {
  /** 表示中の最低音（C）のMIDI番号 */
  octaveStart: number
  onNoteDown: (midi: number, sourceId: string) => void
  onNoteUp: (midi: number, sourceId: string) => void
}

/**
 * PCキーボードを鍵盤として扱う。
 * キーリピート・IME変換中・修飾キー付き・入力欄フォーカス中は反応しない。
 */
export function useKeyboardInput({ octaveStart, onNoteDown, onNoteUp }: Options) {
  // 押下時のMIDI番号を覚えておき、押している間にオクターブを変えても正しく離せるようにする
  const pressed = useRef(new Map<string, number>())

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.isComposing || event.key === 'Process') return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (isEditableTarget(event.target)) return
    const offset = (KEY_CODES as readonly string[]).indexOf(event.code)
    if (offset < 0 || pressed.current.has(event.code)) return
    event.preventDefault()
    const midi = octaveStart + offset
    pressed.current.set(event.code, midi)
    onNoteDown(midi, `key:${event.code}`)
  })

  const handleKeyUp = useEffectEvent((event: KeyboardEvent) => {
    const midi = pressed.current.get(event.code)
    if (midi === undefined) return
    pressed.current.delete(event.code)
    onNoteUp(midi, `key:${event.code}`)
  })

  const releaseAll = useEffectEvent(() => {
    for (const [code, midi] of pressed.current) onNoteUp(midi, `key:${code}`)
    pressed.current.clear()
  })

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') releaseAll()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
