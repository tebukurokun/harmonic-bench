import { midiToFrequency } from '../theory/pitch'

/** 最低音の何周期分を表示するか */
const PERIODS = 3
/** 音を選んでいないときの表示幅 */
const DEFAULT_WINDOW_SEC = 0.02
const MAX_WINDOW_SEC = 0.05

/** 表示する時間幅。最低音の約3周期分にして、音の高さによらず波の形が読めるようにする */
export function scopeWindowSec(midiNotes: readonly number[]): number {
  if (midiNotes.length === 0) return DEFAULT_WINDOW_SEC
  const lowest = Math.min(...midiNotes)
  return Math.min(PERIODS / midiToFrequency(lowest), MAX_WINDOW_SEC)
}

/**
 * 表示の開始位置をフレームごとにそろえるため、上向きにゼロをまたぐ位置（オシロスコープのトリガー）を
 * from〜to の範囲で探す。倍音や和音による小さな揺れで位置が飛ばないよう、いったん -threshold を
 * 下回ってからまたいだ位置だけを使う。見つからなければ from を返す。
 */
export function findRisingEdge(
  samples: ArrayLike<number>,
  from: number,
  to: number,
  threshold: number,
): number {
  let armed = false
  for (let i = Math.max(from, 0); i < Math.min(to, samples.length); i++) {
    const value = samples[i]
    if (value < -threshold) armed = true
    else if (armed && value >= 0) return i
  }
  return from
}
