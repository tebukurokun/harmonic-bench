import type { Timbre } from '../types/music'

export const TIMBRES: readonly { id: Timbre; labelJa: string }[] = [
  { id: 'sine', labelJa: 'サイン波' },
  { id: 'triangle', labelJa: '三角波' },
  { id: 'square', labelJa: '矩形波' },
  { id: 'sawtooth', labelJa: 'ノコギリ波' },
  { id: 'organ', labelJa: 'オルガン風' },
  { id: 'pluck', labelJa: 'プラック／ピアノ風' },
]

/** 1音あたりの最大音量。複数音を重ねても大きくなりすぎないよう控えめにする */
const VOICE_PEAK = 0.22

/** 倍音を多く含む波形は聴感上大きいので抑える */
const TIMBRE_LEVEL: Record<Timbre, number> = {
  sine: 1,
  triangle: 0.9,
  square: 0.45,
  sawtooth: 0.5,
  organ: 0.7,
  pluck: 1,
}

/** オルガン風: 整数倍音（ドローバー風）の倍数と相対音量 */
const ORGAN_PARTIALS = [
  { ratio: 1, gain: 1 },
  { ratio: 2, gain: 0.5 },
  { ratio: 3, gain: 0.3 },
  { ratio: 4, gain: 0.2 },
]

export const ATTACK_SEC = 0.01
export const RELEASE_SEC = 0.08
const PLUCK_RELEASE_SEC = 0.15

export interface Voice {
  /** 現在時刻からリリースを始め、終了後にノードを解放する */
  release(): void
  /** リリース完了後に呼ばれる */
  onEnded: (() => void) | null
}

/**
 * 1音分のノード（オシレーター→フィルター→エンベロープ）を作り、startTime に発音する。
 * 生成したノードは発音終了時にすべて disconnect する。
 */
export function createVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  frequency: number,
  timbre: Timbre,
  startTime: number,
): Voice {
  const peak = VOICE_PEAK * TIMBRE_LEVEL[timbre]
  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(0, startTime)
  envelope.connect(destination)

  const oscillators: OscillatorNode[] = []
  const extraNodes: AudioNode[] = []
  const addOscillator = (type: OscillatorType, freq: number, target: AudioNode) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, startTime)
    osc.connect(target)
    oscillators.push(osc)
    return osc
  }

  let releaseSec = RELEASE_SEC
  if (timbre === 'organ') {
    const partialSum = ORGAN_PARTIALS.reduce((sum, p) => sum + p.gain, 0)
    for (const partial of ORGAN_PARTIALS) {
      const partialGain = ctx.createGain()
      partialGain.gain.setValueAtTime(partial.gain / partialSum, startTime)
      partialGain.connect(envelope)
      extraNodes.push(partialGain)
      addOscillator('sine', frequency * partial.ratio, partialGain)
    }
    envelope.gain.linearRampToValueAtTime(peak, startTime + ATTACK_SEC)
  } else if (timbre === 'pluck') {
    // 明るい立ち上がりから、フィルターと音量がともに減衰していく合成音
    releaseSec = PLUCK_RELEASE_SEC
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.setValueAtTime(0.7, startTime)
    filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), startTime)
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 1.5, 200), startTime + 0.8)
    filter.connect(envelope)
    extraNodes.push(filter)

    const bodyGain = ctx.createGain()
    bodyGain.gain.setValueAtTime(0.35, startTime)
    bodyGain.connect(filter)
    extraNodes.push(bodyGain)
    addOscillator('triangle', frequency, filter)
    addOscillator('sawtooth', frequency, bodyGain)

    envelope.gain.linearRampToValueAtTime(peak, startTime + 0.005)
    envelope.gain.exponentialRampToValueAtTime(peak * 0.25, startTime + 0.5)
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + 3)
  } else {
    addOscillator(timbre, frequency, envelope)
    envelope.gain.linearRampToValueAtTime(peak, startTime + ATTACK_SEC)
  }

  for (const osc of oscillators) osc.start(startTime)

  let released = false
  let ended = 0
  const voice: Voice = {
    onEnded: null,
    release() {
      if (released) return
      released = true
      const at = Math.max(ctx.currentTime, startTime)
      // 現在値を保持してから滑らかに0へ近づけ、クリックノイズを防ぐ
      const gain = envelope.gain
      if (typeof gain.cancelAndHoldAtTime === 'function') {
        gain.cancelAndHoldAtTime(at)
      } else {
        // Firefox など cancelAndHoldAtTime がない環境
        gain.cancelScheduledValues(at)
        gain.setValueAtTime(gain.value, at)
      }
      gain.setTargetAtTime(0, at, releaseSec / 4)
      const stopAt = at + releaseSec + 0.05
      for (const osc of oscillators) osc.stop(stopAt)
    },
  }

  const handleEnded = () => {
    ended += 1
    if (ended < oscillators.length) return
    for (const osc of oscillators) osc.disconnect()
    for (const node of extraNodes) node.disconnect()
    envelope.disconnect()
    voice.onEnded?.()
  }
  for (const osc of oscillators) osc.onended = handleEnded

  return voice
}
