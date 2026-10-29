import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioUnavailableError, WebAudioEngine } from '../src/audio/AudioEngine'
import { TIMBRES } from '../src/audio/timbres'

class FakeParam {
  value = 0
  setValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  linearRampToValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  setTargetAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
  cancelAndHoldAtTime = vi.fn()
}

class FakeNode {
  connections = 0
  connect = vi.fn(() => {
    this.connections += 1
  })
  disconnect = vi.fn(() => {
    this.connections = 0
  })
}

class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  startedAt: number | null = null
  stoppedAt: number | null = null
  onended: (() => void) | null = null
  start = vi.fn((when: number) => {
    this.startedAt = when
  })
  stop = vi.fn((when: number) => {
    this.stoppedAt = when
  })
}

class FakeAnalyser extends FakeNode {
  fftSize = 2048
  /** 出力中の信号として返す値 */
  signal = 0
  getFloatTimeDomainData = vi.fn((buffer: Float32Array) => {
    buffer.fill(this.signal)
  })
}

class FakeAudioContext {
  state: AudioContextState = 'suspended'
  currentTime = 0
  sampleRate = 48000
  analysers: FakeAnalyser[] = []
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  gains: (FakeNode & { gain: FakeParam })[] = []
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createGain() {
    const node = Object.assign(new FakeNode(), { gain: new FakeParam() })
    this.gains.push(node)
    return node
  }
  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), {
      type: 'lowpass',
      Q: new FakeParam(),
      frequency: new FakeParam(),
    })
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    })
  }
  createAnalyser() {
    const analyser = new FakeAnalyser()
    this.analysers.push(analyser)
    return analyser
  }
  /** 停止予定のオシレーターの onended を発火させる */
  finishStopped() {
    for (const osc of this.oscillators) {
      if (osc.stoppedAt !== null && osc.onended) {
        const handler = osc.onended
        osc.onended = null
        handler()
      }
    }
  }
  sounding() {
    return this.oscillators.filter((osc) => osc.stoppedAt === null)
  }
}

function setup(volume?: number) {
  const ctx = new FakeAudioContext()
  const engine = new WebAudioEngine({
    createContext: () => ctx as unknown as AudioContext,
    volume,
  })
  return { ctx, engine }
}

describe('WebAudioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('初回操作で AudioContext を生成・再開する', async () => {
    const createContext = vi.fn(() => new FakeAudioContext() as unknown as AudioContext)
    const engine = new WebAudioEngine({ createContext })
    expect(createContext).not.toHaveBeenCalled()
    await engine.unlock()
    await engine.unlock()
    expect(createContext).toHaveBeenCalledTimes(1)
  })

  it('noteOn で発音し、noteOff でリリースしてノードを解放する', async () => {
    const { ctx, engine } = setup()
    await engine.noteOn(60, 'pointer:1')
    expect(ctx.state).toBe('running')
    expect(ctx.oscillators).toHaveLength(1)
    expect(ctx.oscillators[0].frequency.value).toBeCloseTo(261.63, 2)
    expect(engine.activeVoiceCount).toBe(1)

    engine.noteOff(60, 'pointer:1')
    expect(ctx.oscillators[0].stoppedAt).not.toBeNull()
    ctx.finishStopped()
    expect(ctx.oscillators[0].disconnect).toHaveBeenCalled()
    expect(engine.activeVoiceCount).toBe(0)
  })

  it('複数音を同時に鳴らせる', async () => {
    const { ctx, engine } = setup()
    await engine.noteOn(60, 'pointer:1')
    await engine.noteOn(64, 'pointer:2')
    await engine.noteOn(67, 'key:KeyB')
    expect(ctx.sounding()).toHaveLength(3)
  })

  it('同じ音を複数の入力元が押しても、すべて離すまで止めない', async () => {
    const { ctx, engine } = setup()
    await engine.noteOn(60, 'pointer:1')
    await engine.noteOn(60, 'key:KeyZ')
    expect(ctx.oscillators).toHaveLength(1)
    engine.noteOff(60, 'pointer:1')
    expect(ctx.sounding()).toHaveLength(1)
    engine.noteOff(60, 'key:KeyZ')
    expect(ctx.sounding()).toHaveLength(0)
  })

  it('押していない入力元の noteOff は無視する', async () => {
    const { ctx, engine } = setup()
    await engine.noteOn(60, 'pointer:1')
    engine.noteOff(60, 'pointer:9')
    engine.noteOff(62, 'pointer:1')
    expect(ctx.sounding()).toHaveLength(1)
  })

  it('初期化待ちの間に離された音は鳴らさない', async () => {
    const { ctx, engine } = setup()
    const pending = engine.noteOn(60, 'pointer:1')
    engine.noteOff(60, 'pointer:1')
    await pending
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('playNotes は全ノートの開始時刻を揃え、約1秒後にリリースする', async () => {
    const { ctx, engine } = setup()
    await engine.unlock()
    ctx.currentTime = 5
    await engine.playNotes([67, 60, 64, 60])
    expect(ctx.oscillators).toHaveLength(3)
    const starts = new Set(ctx.oscillators.map((osc) => osc.startedAt))
    expect(starts.size).toBe(1)
    expect([...starts][0]).toBeGreaterThanOrEqual(5)

    expect(ctx.sounding()).toHaveLength(3)
    vi.advanceTimersByTime(1000)
    expect(ctx.sounding()).toHaveLength(0)
    ctx.finishStopped()
    expect(engine.activeVoiceCount).toBe(0)
  })

  it('stopAll で押下中の音と和音再生中の音をすべて止める', async () => {
    const { ctx, engine } = setup()
    await engine.noteOn(60, 'pointer:1')
    await engine.playNotes([64, 67])
    engine.stopAll()
    expect(ctx.sounding()).toHaveLength(0)
    ctx.finishStopped()
    expect(engine.activeVoiceCount).toBe(0)
    // stopAll 後の noteOff でエラーにならない
    expect(() => engine.noteOff(60, 'pointer:1')).not.toThrow()
  })

  it('連打してもノードが残らない', async () => {
    const { ctx, engine } = setup()
    for (let i = 0; i < 50; i++) {
      await engine.noteOn(60 + (i % 5), `pointer:${i}`)
      engine.noteOff(60 + (i % 5), `pointer:${i}`)
    }
    ctx.finishStopped()
    expect(engine.activeVoiceCount).toBe(0)
    expect(ctx.oscillators.every((osc) => osc.disconnect.mock.calls.length > 0)).toBe(true)
  })

  it.each(TIMBRES.map((t) => t.id))('音色 %s で発音・解放できる', async (timbre) => {
    const { ctx, engine } = setup()
    engine.setTimbre(timbre)
    await engine.noteOn(69, 'pointer:1')
    expect(ctx.oscillators.length).toBeGreaterThan(0)
    expect(ctx.oscillators[0].frequency.value).toBe(440)
    engine.noteOff(69, 'pointer:1')
    ctx.finishStopped()
    expect(engine.activeVoiceCount).toBe(0)
  })

  it('音量は0〜1に制限してマスターゲインに反映する', async () => {
    const { ctx, engine } = setup(0)
    await engine.unlock()
    const master = ctx.gains[0]
    expect(master.gain.value).toBe(0)
    engine.setVolume(2)
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, expect.any(Number))
    engine.setVolume(-1)
    expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, expect.any(Number))
  })

  it('AudioContext を生成できない環境ではエラーを返し、押下状態を残さない', async () => {
    const engine = new WebAudioEngine({
      createContext: () => {
        throw new AudioUnavailableError()
      },
    })
    await expect(engine.noteOn(60, 'pointer:1')).rejects.toBeInstanceOf(AudioUnavailableError)
    await expect(engine.playNotes([60])).rejects.toBeInstanceOf(AudioUnavailableError)
    expect(() => engine.noteOff(60, 'pointer:1')).not.toThrow()
  })

  it('初期化前の波形は null で、初期化後は出力の波形とサンプリング周波数を返す', async () => {
    const { ctx, engine } = setup()
    expect(engine.readWaveform()).toBeNull()
    await engine.unlock()
    const [analyser] = ctx.analysers
    // 波形表示用の分岐はどこにも接続せず、出力に影響しない
    expect(analyser.connections).toBe(0)
    analyser.signal = 0.25
    const waveform = engine.readWaveform()
    expect(waveform?.sampleRate).toBe(48000)
    expect(waveform?.samples.length).toBe(analyser.fftSize)
    expect(waveform?.samples.every((s) => s === 0.25)).toBe(true)
    await engine.dispose()
    expect(analyser.disconnect).toHaveBeenCalled()
    expect(engine.readWaveform()).toBeNull()
  })

  it('dispose で AudioContext を閉じ、再利用時は作り直す', async () => {
    const contexts: FakeAudioContext[] = []
    const engine = new WebAudioEngine({
      createContext: () => {
        const ctx = new FakeAudioContext()
        contexts.push(ctx)
        return ctx as unknown as AudioContext
      },
    })
    await engine.unlock()
    await engine.dispose()
    expect(contexts[0].close).toHaveBeenCalled()
    await engine.unlock()
    expect(contexts).toHaveLength(2)
  })
})
