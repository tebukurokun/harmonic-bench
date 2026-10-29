import { useEffect, useEffectEvent, useRef } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { findRisingEdge, scopeWindowSec } from '../audio/scope'

interface Props {
  engine: AudioEngine
  /** 分析対象の音。表示する時間幅を最低音から決める */
  midiNotes: readonly number[]
}

/** これより小さい振幅は無音とみなす */
const SILENCE = 1e-4
/** 縦軸の自動調整で、これより小さい振幅は拡大しない（減衰していく様子を残すため） */
const MIN_SCALE_PEAK = 0.02
/** 振幅が小さくなったときに縦軸を追従させる割合（1フレームあたり） */
const SCALE_FOLLOW = 0.05
/** 波形が上下の端に届かないよう余白を残す */
const HEADROOM = 0.85
/** トリガーには振幅の半分を下回ってからのゼロクロスを使う */
const TRIGGER_RATIO = 0.5

/**
 * 実際に出力している音の波形を、オシロスコープ風に描く。
 * 描画は requestAnimationFrame で canvas に直接行い、React の state は使わない。
 */
export function Oscilloscope({ engine, midiNotes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const windowSec = scopeWindowSec(midiNotes)
  const currentWindowSec = useEffectEvent(() => windowSec)

  useEffect(() => {
    const canvas = canvasRef.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const style = getComputedStyle(canvas)
    const lineColor = style.getPropertyValue('--lcd-text').trim() || '#c6f1df'
    const gridColor = style.getPropertyValue('--lcd-edge').trim() || '#26313a'

    let scalePeak = MIN_SCALE_PEAK
    let drewSilence = false
    let frame = 0

    const draw = () => {
      frame = requestAnimationFrame(draw)
      const dpr = window.devicePixelRatio || 1
      const width = Math.round(canvas.clientWidth * dpr)
      const height = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        drewSilence = false
      }
      if (width === 0 || height === 0) return

      const waveform = engine.readWaveform()
      let peak = 0
      if (waveform) for (const s of waveform.samples) peak = Math.max(peak, Math.abs(s))
      const silent = !waveform || peak < SILENCE
      // 無音が続く間は描き直さない
      if (silent && drewSilence) return
      drewSilence = silent

      const mid = height / 2
      g.clearRect(0, 0, width, height)
      g.strokeStyle = gridColor
      g.lineWidth = dpr
      g.beginPath()
      g.moveTo(0, mid)
      g.lineTo(width, mid)
      g.stroke()
      if (silent) {
        scalePeak = MIN_SCALE_PEAK
        return
      }

      const { samples, sampleRate } = waveform
      const count = Math.min(Math.round(currentWindowSec() * sampleRate), samples.length / 2)
      // 最新のサンプルに近い範囲でトリガー位置を探す
      const searchTo = samples.length - count
      const start = findRisingEdge(samples, searchTo - count, searchTo, peak * TRIGGER_RATIO)

      // 縦軸の自動調整: 大きくなったらすぐ合わせ、小さくなったらゆっくり追従する
      if (peak > scalePeak) scalePeak = peak
      else scalePeak += (Math.max(peak, MIN_SCALE_PEAK) - scalePeak) * SCALE_FOLLOW
      const yScale = (mid * HEADROOM) / scalePeak

      g.strokeStyle = lineColor
      g.lineWidth = 1.5 * dpr
      g.lineJoin = 'round'
      g.shadowColor = lineColor
      g.shadowBlur = 6 * dpr
      g.beginPath()
      // サンプル数が横幅より多いときは、1ピクセルあたり1点に間引く
      const points = Math.min(count, width)
      for (let p = 0; p <= points; p++) {
        const value = samples[start + Math.round((p / points) * (count - 1))]
        const x = (p / points) * width
        const y = mid - value * yScale
        if (p === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
      g.shadowBlur = 0
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [engine])

  return (
    <figure className="scope">
      <canvas
        ref={canvasRef}
        className="scope__screen"
        role="img"
        aria-label="出力中の音の波形（オシロスコープ）"
      />
      <figcaption className="scope__caption">
        <span>波形</span>
        <span>表示幅 {(windowSec * 1000).toFixed(1)} ms・縦軸は自動調整</span>
      </figcaption>
    </figure>
  )
}
