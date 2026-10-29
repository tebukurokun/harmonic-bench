import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { type AudioEngine, DEFAULT_VOLUME } from './audio/AudioEngine'
import { ChordAnalysis } from './components/ChordAnalysis'
import { ModeVolumeControls, SoundControls } from './components/Controls'
import { NoteDetails } from './components/NoteDetails'
import { Oscilloscope } from './components/Oscilloscope'
import { PianoKeyboard, VISIBLE_KEY_COUNT } from './components/PianoKeyboard'
import { TheoryExplanation } from './components/TheoryExplanation'
import { useAudioEngine } from './hooks/useAudioEngine'
import { keyHint, useKeyboardInput } from './hooks/useKeyboardInput'
import { analyzeNotes } from './theory/analyze'
import { defaultPitchName } from './theory/noteSpelling'
import { sortUniqueMidi } from './theory/pitch'
import type { Mode, Timbre } from './types/music'

/** 表示範囲: C2（36）〜 B6（95） */
export const MIN_OCTAVE_START = 36
export const MAX_OCTAVE_START = 96 - VISIBLE_KEY_COUNT
export const INITIAL_OCTAVE_START = 60
export const MAX_SELECTED_NOTES = 12
const PREVIEW_SEC = 0.5
const CHORD_SEC = 1
const NO_NOTES: ReadonlySet<number> = new Set()
/** 和音作成モードで選択音を鳴らし続けるときの入力元 */
const SELECTION_SOURCE = 'selection'

interface Props {
  /** テストで差し替えるための Audio Engine */
  audioEngine?: AudioEngine
}

export default function App({ audioEngine }: Props) {
  const { engine, audioError, run } = useAudioEngine(audioEngine)
  const [mode, setMode] = useState<Mode>('chord')
  const [selectedMidiNotes, setSelectedMidiNotes] = useState<number[]>([])
  const [octaveStart, setOctaveStart] = useState(INITIAL_OCTAVE_START)
  const [timbre, setTimbre] = useState<Timbre>('sine')
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  /** 演奏モードで押下中の音（入力元 → MIDI番号） */
  const [held, setHeld] = useState<Record<string, number>>({})
  /** 和音作成モードで選択中の音を鳴らし続けるか */
  const [sustain, setSustain] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  /** 演奏モードでキーボード操作（Enter／Space）により短く押した音を離すタイマー（入力元ごと） */
  const activateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const heldMidiNotes = useMemo(() => sortUniqueMidi(Object.values(held)), [held])
  const analysisTarget = mode === 'chord' ? selectedMidiNotes : heldMidiNotes
  const analysis = useMemo(() => analyzeNotes(analysisTarget), [analysisTarget])
  const selectedSet = useMemo(() => new Set(selectedMidiNotes), [selectedMidiNotes])
  const heldSet = useMemo(() => new Set(heldMidiNotes), [heldMidiNotes])
  const degrees = useMemo(
    () =>
      new Map(analysis.notes.flatMap((note) => (note.role ? [[note.midi, note.role.symbol]] : []))),
    [analysis],
  )

  const octaveEnd = octaveStart + VISIBLE_KEY_COUNT - 1
  const rangeLabel = `${defaultPitchName(octaveStart)}–${defaultPitchName(octaveEnd)}`
  const hiddenSelectionCount = selectedMidiNotes.filter(
    (midi) => midi < octaveStart || midi > octaveEnd,
  ).length

  const clearActivateTimers = () => {
    for (const timer of activateTimers.current.values()) clearTimeout(timer)
    activateTimers.current.clear()
  }

  const releaseAllHeld = () => {
    clearActivateTimers()
    engine.stopAll()
    setHeld({})
  }

  const soundSelection = (notes: readonly number[]) => {
    for (const midi of notes) run(engine.noteOn(midi, SELECTION_SOURCE))
  }

  const silenceSelection = (notes: readonly number[]) => {
    for (const midi of notes) engine.noteOff(midi, SELECTION_SOURCE)
  }

  // フォーカス喪失時は押しっぱなしの演奏音だけを止める（選択音の持続は意図した発音なので続ける）
  const handleWindowBlur = useEffectEvent(() => {
    if (mode === 'perform') releaseAllHeld()
  })

  // タブが非表示になったら、持続音も含めてすべて止める。
  // 戻ったときに自動で鳴り出さないよう、鳴らしていた場合は「鳴らし続ける」をオフにする
  const handleHidden = useEffectEvent(() => {
    releaseAllHeld()
    if (mode === 'chord' && sustain && selectedMidiNotes.length > 0) setSustain(false)
  })

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') handleHidden()
    }
    const timers = activateTimers.current
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const pressNote = (midi: number, sourceId: string) => {
    setHeld((prev) => ({ ...prev, [sourceId]: midi }))
    run(engine.noteOn(midi, sourceId))
  }

  const releaseNote = (midi: number, sourceId: string) => {
    setHeld((prev) => {
      if (!(sourceId in prev)) return prev
      const next = { ...prev }
      delete next[sourceId]
      return next
    })
    engine.noteOff(midi, sourceId)
  }

  const toggleNote = (midi: number) => {
    if (selectedSet.has(midi)) {
      setSelectedMidiNotes(selectedMidiNotes.filter((note) => note !== midi))
      setNotice(null)
      if (sustain) silenceSelection([midi])
      return
    }
    if (selectedMidiNotes.length >= MAX_SELECTED_NOTES) {
      setNotice(`選択できる音は最大${MAX_SELECTED_NOTES}個です。`)
      return
    }
    setSelectedMidiNotes(sortUniqueMidi([...selectedMidiNotes, midi]))
    setNotice(null)
    if (sustain) soundSelection([midi])
    else run(engine.playNotes([midi], PREVIEW_SEC))
  }

  // 演奏モードのキーボード操作は離す操作がないため、短く押したものとして発音・分析する。
  // 押している間に繰り返し押されたら、離すまでの時間を延ばす
  const tapNote = (midi: number) => {
    const sourceId = `activate:${midi}`
    const timers = activateTimers.current
    clearTimeout(timers.get(sourceId))
    pressNote(midi, sourceId)
    timers.set(
      sourceId,
      setTimeout(() => {
        timers.delete(sourceId)
        releaseNote(midi, sourceId)
      }, PREVIEW_SEC * 1000),
    )
  }

  const activateKey = (midi: number) => {
    if (mode === 'chord') toggleNote(midi)
    else tapNote(midi)
  }

  useKeyboardInput({
    octaveStart,
    onNoteDown: (midi, sourceId) => {
      if (mode === 'perform') pressNote(midi, sourceId)
      else toggleNote(midi)
    },
    onNoteUp: releaseNote,
  })

  const changeMode = (next: Mode) => {
    if (next === mode) return
    releaseAllHeld()
    setNotice(null)
    setMode(next)
    if (next === 'chord' && sustain) soundSelection(selectedMidiNotes)
  }

  const shiftOctave = (direction: -1 | 1) => {
    const next = octaveStart + direction * 12
    if (next < MIN_OCTAVE_START || next > MAX_OCTAVE_START) return
    // 押下中の鍵盤が画面から消えると離した操作を受け取れないため、先に止める
    if (mode === 'perform') releaseAllHeld()
    setOctaveStart(next)
  }

  const changeTimbre = (next: Timbre) => {
    setTimbre(next)
    engine.setTimbre(next)
    // 鳴らし続けている音は、新しい音色で鳴らし直す
    if (mode === 'chord' && sustain) {
      silenceSelection(selectedMidiNotes)
      soundSelection(selectedMidiNotes)
    }
  }

  const changeVolume = (next: number) => {
    setVolume(next)
    engine.setVolume(next)
  }

  const playChord = () => {
    if (selectedMidiNotes.length === 0) return
    if (sustain) {
      // 持続中は全音をそろえて鳴らし直す（プラック音色などの減衰した音を再度立ち上げる）
      silenceSelection(selectedMidiNotes)
      soundSelection(selectedMidiNotes)
    } else {
      run(engine.playNotes(selectedMidiNotes, CHORD_SEC))
    }
  }

  const toggleSustain = () => {
    const next = !sustain
    setSustain(next)
    if (next) soundSelection(selectedMidiNotes)
    else silenceSelection(selectedMidiNotes)
  }

  const clearSelection = () => {
    // 持続音に加えて、プレビューや「和音を再生」で鳴っている音も止める
    engine.stopAll()
    setSelectedMidiNotes([])
    setNotice(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Harmonic Bench</h1>
          <p className="brand__tagline">和音を読み解く鍵盤</p>
        </div>
        <ModeVolumeControls
          mode={mode}
          volume={volume}
          onModeChange={changeMode}
          onVolumeChange={changeVolume}
        />
      </header>

      <main className="app-main">
        <section className="instrument" aria-label="楽器">
          <SoundControls
            timbre={timbre}
            rangeLabel={rangeLabel}
            canShiftDown={octaveStart > MIN_OCTAVE_START}
            canShiftUp={octaveStart < MAX_OCTAVE_START}
            onTimbreChange={changeTimbre}
            onShiftOctave={shiftOctave}
          />

          <p className="mode-hint">
            {mode === 'chord'
              ? `和音作成モード: 鍵盤をタップするたびに音を選択／解除します。${
                  sustain ? '選択中の音は鳴り続けます。' : '追加した音は短く鳴ります。'
                }`
              : '演奏モード: 鍵盤を押している間だけ音が鳴ります。複数の鍵盤を同時に押せます。'}
          </p>

          <PianoKeyboard
            octaveStart={octaveStart}
            mode={mode}
            selected={mode === 'chord' ? selectedSet : NO_NOTES}
            held={heldSet}
            degrees={degrees}
            rangeLabel={rangeLabel}
            onPress={pressNote}
            onRelease={releaseNote}
            onActivate={activateKey}
            display={<Oscilloscope engine={engine} midiNotes={analysisTarget} />}
          />

          <p className="key-guide">
            PCキー: 下段 {keyHint(0)}〜{keyHint(11)} が {defaultPitchName(octaveStart)}〜、上段{' '}
            {keyHint(12)}〜{keyHint(23)} が {defaultPitchName(octaveStart + 12)}〜
          </p>

          {mode === 'chord' && (
            <div className="chord-actions">
              <button
                type="button"
                className="button button--toggle"
                aria-pressed={sustain}
                onClick={toggleSustain}
              >
                <span className="led" aria-hidden="true" />
                鳴らし続ける
                <span className="button__state" aria-hidden="true">
                  {sustain ? 'オン' : 'オフ'}
                </span>
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={selectedMidiNotes.length === 0}
                onClick={playChord}
              >
                和音を再生
              </button>
              <button
                type="button"
                className="button"
                disabled={selectedMidiNotes.length === 0}
                onClick={clearSelection}
              >
                全解除
              </button>
              <span className="chord-actions__count">
                選択中: {selectedMidiNotes.length}音
                {hiddenSelectionCount > 0 && `（うち${hiddenSelectionCount}音は表示範囲外）`}
              </span>
            </div>
          )}

          {(notice || audioError) && (
            <div className="messages">
              {notice && (
                <p className="message" role="status">
                  {notice}
                </p>
              )}
              {audioError && (
                <p className="message message--error" role="alert">
                  {audioError} 音は鳴りませんが、分析は引き続き利用できます。
                </p>
              )}
            </div>
          )}
        </section>

        <div className="analysis">
          <ChordAnalysis analysis={analysis} mode={mode} />
          <NoteDetails analysis={analysis} />
          <TheoryExplanation analysis={analysis} />
        </div>
      </main>

      <footer className="app-footer">
        音はブラウザ内で合成しています（Web Audio API）。サーバーへの送信や録音は行いません。
      </footer>
    </div>
  )
}
