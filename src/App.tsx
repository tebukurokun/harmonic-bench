import { useEffect, useMemo, useState } from 'react'
import { type AudioEngine, DEFAULT_VOLUME } from './audio/AudioEngine'
import { ChordAnalysis } from './components/ChordAnalysis'
import { ModeVolumeControls, SoundControls } from './components/Controls'
import { NoteDetails } from './components/NoteDetails'
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
  const [notice, setNotice] = useState<string | null>(null)

  const heldMidiNotes = useMemo(() => sortUniqueMidi(Object.values(held)), [held])
  const analysisTarget = mode === 'chord' ? selectedMidiNotes : heldMidiNotes
  const analysis = useMemo(() => analyzeNotes(analysisTarget), [analysisTarget])
  const selectedSet = useMemo(() => new Set(selectedMidiNotes), [selectedMidiNotes])
  const heldSet = useMemo(() => new Set(heldMidiNotes), [heldMidiNotes])

  const octaveEnd = octaveStart + VISIBLE_KEY_COUNT - 1
  const rangeLabel = `${defaultPitchName(octaveStart)}–${defaultPitchName(octaveEnd)}`
  const hiddenSelectionCount = selectedMidiNotes.filter(
    (midi) => midi < octaveStart || midi > octaveEnd,
  ).length

  const releaseAllHeld = () => {
    engine.stopAll()
    setHeld({})
  }

  // タブ非表示・フォーカス喪失時に押しっぱなしの音を止める
  useEffect(() => {
    const stop = () => {
      engine.stopAll()
      setHeld({})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [engine])

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
      return
    }
    if (selectedMidiNotes.length >= MAX_SELECTED_NOTES) {
      setNotice(`選択できる音は最大${MAX_SELECTED_NOTES}個です。`)
      return
    }
    setSelectedMidiNotes(sortUniqueMidi([...selectedMidiNotes, midi]))
    setNotice(null)
    run(engine.playNotes([midi], PREVIEW_SEC))
  }

  const activateKey = (midi: number) => {
    if (mode === 'chord') toggleNote(midi)
    else run(engine.playNotes([midi], PREVIEW_SEC))
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
  }

  const changeVolume = (next: number) => {
    setVolume(next)
    engine.setVolume(next)
  }

  const playChord = () => {
    if (selectedMidiNotes.length === 0) return
    run(engine.playNotes(selectedMidiNotes, CHORD_SEC))
  }

  const clearSelection = () => {
    setSelectedMidiNotes([])
    setNotice(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>Harmonic Bench</h1>
          <p className="brand__tagline">音を鳴らして、和音のしくみを確かめる</p>
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
              ? '和音作成モード: 鍵盤をタップするたびに音を選択／解除します。'
              : '演奏モード: 鍵盤を押している間だけ音が鳴ります。複数の鍵盤を同時に押せます。'}
          </p>

          <PianoKeyboard
            octaveStart={octaveStart}
            mode={mode}
            selected={mode === 'chord' ? selectedSet : NO_NOTES}
            held={heldSet}
            rangeLabel={rangeLabel}
            onPress={pressNote}
            onRelease={releaseNote}
            onActivate={activateKey}
          />

          <p className="key-guide">
            PCキー: 下段 {keyHint(0)}〜{keyHint(11)} が {defaultPitchName(octaveStart)}〜、上段{' '}
            {keyHint(12)}〜{keyHint(23)} が {defaultPitchName(octaveStart + 12)}〜
          </p>

          {mode === 'chord' && (
            <div className="chord-actions">
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
