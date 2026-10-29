/** 音色 */
export type Timbre = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'organ' | 'pluck'

/** 操作モード: 演奏 / 和音作成 */
export type Mode = 'perform' | 'chord'

/** 音名の文字（C=0, D=1, ... B=6） */
export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** オクターブを持たない音名の綴り。accidental は ♯ を +1、♭ を -1 とする */
export interface NoteSpelling {
  letter: Letter
  accidental: number
}

/** オクターブ付きの綴り（例: B♯3 は MIDI 60 と同じ高さ） */
export interface SpelledPitch extends NoteSpelling {
  octave: number
}
