import { useCallback, useEffect, useState } from 'react'
import { type AudioEngine, AudioUnavailableError, WebAudioEngine } from '../audio/AudioEngine'

function errorMessage(error: unknown): string {
  if (error instanceof AudioUnavailableError) return error.message
  return '音声を再生できませんでした。ブラウザの設定や端末の消音状態を確認してください。'
}

/**
 * Audio Engine を1つだけ生成して保持する。
 * 発音はイベントハンドラから engine を直接呼び、run() で失敗を画面に伝える。
 */
export function useAudioEngine(provided?: AudioEngine) {
  const [engine] = useState<AudioEngine>(() => provided ?? new WebAudioEngine())
  const [audioError, setAudioError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      void engine.dispose()
    }
  }, [engine])

  const run = useCallback((task: Promise<void>) => {
    task.then(
      () => setAudioError(null),
      (error: unknown) => setAudioError(errorMessage(error)),
    )
  }, [])

  return { engine, audioError, run }
}
