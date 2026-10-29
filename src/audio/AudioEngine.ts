import { midiToFrequency, sortUniqueMidi } from '../theory/pitch'
import type { Timbre } from '../types/music'
import { createVoice, RELEASE_SEC, type Voice } from './timbres'

export interface AudioEngine {
  /** ユーザー操作を起点に AudioContext を生成・再開する */
  unlock(): Promise<void>
  /** sourceId（ポインターIDやキーコード）ごとに押下を追跡して発音する */
  noteOn(midi: number, sourceId: string): Promise<void>
  noteOff(midi: number, sourceId: string): void
  /** 複数音を同じ開始時刻で鳴らし、durationSec 後に自然に減衰させる */
  playNotes(midiNotes: number[], durationSec?: number): Promise<void>
  setTimbre(timbre: Timbre): void
  /** 0.0〜1.0 */
  setVolume(volume: number): void
  /** 押下中の音・和音再生中の音をすべて止める */
  stopAll(): void
  /** 出力中の波形（直近のサンプル）。音声を初期化する前は null */
  readWaveform(): Waveform | null
  dispose(): Promise<void>
}

export interface Waveform {
  /** -1〜1 の時間領域のサンプル。呼び出しごとに同じ配列を上書きする */
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
}

export class AudioUnavailableError extends Error {
  constructor(message = 'このブラウザでは Web Audio API を利用できません。') {
    super(message)
    this.name = 'AudioUnavailableError'
  }
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

function createBrowserAudioContext(): AudioContext {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as WebkitWindow).webkitAudioContext)
  if (!Ctor) throw new AudioUnavailableError()
  return new Ctor({ latencyHint: 'interactive' })
}

export interface WebAudioEngineOptions {
  createContext?: () => AudioContext
  timbre?: Timbre
  volume?: number
}

export const DEFAULT_VOLUME = 0.4
/** 和音再生の開始時刻を揃えるための先読み */
const SCHEDULE_AHEAD_SEC = 0.01
/** 波形表示用に取り出すサンプル数（96kHz でも約85ms分） */
const WAVEFORM_SIZE = 8192

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0))
}

export class WebAudioEngine implements AudioEngine {
  private readonly createContext: () => AudioContext
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private analyser: AnalyserNode | null = null
  private waveform: Waveform | null = null
  private starting: Promise<AudioContext> | null = null
  private timbre: Timbre
  private volume: number

  /** MIDI番号 → 押下している入力元 */
  private readonly holders = new Map<number, Set<string>>()
  /** 押下中に鳴っている音（MIDI番号ごとに1つ） */
  private readonly heldVoices = new Map<number, Voice>()
  /** リリース中を含め、まだノードが残っている音 */
  private readonly activeVoices = new Set<Voice>()
  private readonly releaseTimers = new Set<ReturnType<typeof setTimeout>>()
  /** stopAll のたびに進める。初期化待ちの playNotes が、待つ間に止められたかを判定する */
  private stopGeneration = 0

  constructor(options: WebAudioEngineOptions = {}) {
    this.createContext = options.createContext ?? createBrowserAudioContext
    this.timbre = options.timbre ?? 'sine'
    this.volume = clampVolume(options.volume ?? DEFAULT_VOLUME)
  }

  /** テスト・デバッグ用: ノードが残っている音の数 */
  get activeVoiceCount(): number {
    return this.activeVoices.size
  }

  async unlock(): Promise<void> {
    await this.ensureContext()
  }

  async noteOn(midi: number, sourceId: string): Promise<void> {
    const holders = this.holders.get(midi) ?? new Set<string>()
    holders.add(sourceId)
    this.holders.set(midi, holders)

    let ctx: AudioContext
    try {
      ctx = await this.ensureContext()
    } catch (error) {
      this.removeHolder(midi, sourceId)
      throw error
    }
    // 初期化を待つ間に離された、または別の入力元ですでに鳴っている
    if (!this.holders.get(midi)?.has(sourceId) || this.heldVoices.has(midi)) return
    this.heldVoices.set(midi, this.startVoice(ctx, midi, ctx.currentTime))
  }

  noteOff(midi: number, sourceId: string): void {
    if (!this.removeHolder(midi, sourceId)) return
    const voice = this.heldVoices.get(midi)
    if (!voice) return
    this.heldVoices.delete(midi)
    voice.release()
  }

  async playNotes(midiNotes: number[], durationSec = 1): Promise<void> {
    const notes = sortUniqueMidi(midiNotes)
    if (notes.length === 0) return
    const generation = this.stopGeneration
    const ctx = await this.ensureContext()
    // 初期化を待つ間に stopAll された
    if (generation !== this.stopGeneration) return
    const startAt = ctx.currentTime + SCHEDULE_AHEAD_SEC
    const voices = notes.map((midi) => this.startVoice(ctx, midi, startAt))
    const holdMs = (Math.max(durationSec - RELEASE_SEC, 0.05) + SCHEDULE_AHEAD_SEC) * 1000
    const timer = setTimeout(() => {
      this.releaseTimers.delete(timer)
      for (const voice of voices) voice.release()
    }, holdMs)
    this.releaseTimers.add(timer)
  }

  setTimbre(timbre: Timbre): void {
    // 鳴っている音はそのまま、次の発音から反映する
    this.timbre = timbre
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume)
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.015)
    }
  }

  stopAll(): void {
    this.stopGeneration += 1
    for (const timer of this.releaseTimers) clearTimeout(timer)
    this.releaseTimers.clear()
    this.holders.clear()
    this.heldVoices.clear()
    for (const voice of this.activeVoices) voice.release()
  }

  readWaveform(): Waveform | null {
    if (!this.analyser || !this.waveform) return null
    this.analyser.getFloatTimeDomainData(this.waveform.samples)
    return this.waveform
  }

  async dispose(): Promise<void> {
    this.stopAll()
    const ctx = this.ctx
    this.master?.disconnect()
    this.limiter?.disconnect()
    this.analyser?.disconnect()
    this.ctx = null
    this.master = null
    this.limiter = null
    this.analyser = null
    this.waveform = null
    this.activeVoices.clear()
    if (ctx && ctx.state !== 'closed') await ctx.close()
  }

  private removeHolder(midi: number, sourceId: string): boolean {
    const holders = this.holders.get(midi)
    if (!holders?.delete(sourceId)) return false
    if (holders.size > 0) return false
    this.holders.delete(midi)
    return true
  }

  private startVoice(ctx: AudioContext, midi: number, startTime: number): Voice {
    if (!this.master) throw new Error('AudioContext が初期化されていません')
    const voice = createVoice(ctx, this.master, midiToFrequency(midi), this.timbre, startTime)
    this.activeVoices.add(voice)
    voice.onEnded = () => {
      this.activeVoices.delete(voice)
    }
    return voice
  }

  private ensureContext(): Promise<AudioContext> {
    if (this.ctx?.state === 'running') return Promise.resolve(this.ctx)
    this.starting ??= this.startContext().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async startContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const ctx = this.createContext()
      const master = ctx.createGain()
      master.gain.setValueAtTime(this.volume, ctx.currentTime)
      // 同時発音数が増えたときのクリッピングを抑えるリミッター
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.setValueAtTime(-10, ctx.currentTime)
      limiter.knee.setValueAtTime(6, ctx.currentTime)
      limiter.ratio.setValueAtTime(12, ctx.currentTime)
      limiter.attack.setValueAtTime(0.003, ctx.currentTime)
      limiter.release.setValueAtTime(0.2, ctx.currentTime)
      master.connect(limiter)
      limiter.connect(ctx.destination)
      // 実際に出力している音（リミッター通過後）を波形表示用に分岐する
      const analyser = ctx.createAnalyser()
      analyser.fftSize = WAVEFORM_SIZE
      limiter.connect(analyser)
      this.ctx = ctx
      this.master = master
      this.limiter = limiter
      this.analyser = analyser
      this.waveform = { samples: new Float32Array(WAVEFORM_SIZE), sampleRate: ctx.sampleRate }
    }
    const ctx = this.ctx
    if (ctx.state !== 'running') await ctx.resume()
    return ctx
  }
}
