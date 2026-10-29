export const A4_MIDI = 69
export const A4_FREQUENCY = 440

/** C=0, C♯/D♭=1 ... B=11 */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

/** MIDIノート番号の科学的音高表記でのオクターブ（MIDI 60 = C4） */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

/** 12平均律での基音周波数（丸めない） */
export function midiToFrequency(midi: number, a4 = A4_FREQUENCY): number {
  return a4 * 2 ** ((midi - A4_MIDI) / 12)
}

/** 表示用: 小数第2位まで */
export function formatFrequency(frequency: number): string {
  return frequency.toFixed(2)
}

/** 黒鍵かどうか */
export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitchClass(midi))
}

/** 重複を除き昇順に並べる */
export function sortUniqueMidi(notes: readonly number[]): number[] {
  return [...new Set(notes)].sort((a, b) => a - b)
}
