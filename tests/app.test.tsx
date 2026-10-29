import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, type Mocked, vi } from 'vitest'
import App from '../src/App'
import { type AudioEngine, AudioUnavailableError } from '../src/audio/AudioEngine'

function createMockEngine(overrides: Partial<Mocked<AudioEngine>> = {}): Mocked<AudioEngine> {
  return {
    unlock: vi.fn(async () => {}),
    noteOn: vi.fn(async () => {}),
    noteOff: vi.fn(),
    playNotes: vi.fn(async () => {}),
    setTimbre: vi.fn(),
    setVolume: vi.fn(),
    stopAll: vi.fn(),
    dispose: vi.fn(async () => {}),
    ...overrides,
  }
}

function setup(engine = createMockEngine()) {
  const user = userEvent.setup()
  render(<App audioEngine={engine} />)
  return { user, engine }
}

const key = (name: string) => screen.getByRole('button', { name })

async function selectNotes(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const name of names) await user.click(key(name))
}

function result() {
  return screen.getByRole('region', { name: '分析結果' })
}

describe('App: 和音作成モード（初期モード）', () => {
  it('2オクターブ C4〜B5 の鍵盤を表示する', () => {
    setup()
    const keyboard = screen.getByRole('group', { name: /ピアノ鍵盤/ })
    expect(within(keyboard).getAllByRole('button')).toHaveLength(24)
    expect(key('C4')).toBeInTheDocument()
    expect(key('B5')).toBeInTheDocument()
    expect(key('C♯4 / D♭4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '和音作成' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('初期状態では、選択中の音を鳴らし続け、解除するとその音だけ止める', async () => {
    const { user, engine } = setup()
    const sustain = screen.getByRole('button', { name: '鳴らし続ける' })
    expect(sustain).toHaveAttribute('aria-pressed', 'true')

    await user.click(key('C4'))
    await user.click(key('E4'))
    expect(key('C4')).toHaveAttribute('aria-pressed', 'true')
    expect(engine.noteOn).toHaveBeenCalledWith(60, 'selection')
    expect(engine.noteOn).toHaveBeenCalledWith(64, 'selection')
    expect(engine.playNotes).not.toHaveBeenCalled()

    await user.click(key('C4'))
    expect(key('C4')).toHaveAttribute('aria-pressed', 'false')
    expect(engine.noteOff).toHaveBeenCalledWith(60, 'selection')
    expect(engine.noteOff).not.toHaveBeenCalledWith(64, 'selection')
  })

  it('「鳴らし続ける」をオフにすると選択音を止め、以降は追加時だけ短く鳴らす', async () => {
    const { user, engine } = setup()
    await selectNotes(user, ['C4', 'E4'])
    await user.click(screen.getByRole('button', { name: '鳴らし続ける' }))
    expect(screen.getByRole('button', { name: '鳴らし続ける' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(engine.noteOff).toHaveBeenCalledWith(60, 'selection')
    expect(engine.noteOff).toHaveBeenCalledWith(64, 'selection')

    engine.noteOn.mockClear()
    await user.click(key('G4'))
    expect(engine.playNotes).toHaveBeenLastCalledWith([67], expect.any(Number))
    await user.click(key('G4'))
    expect(engine.playNotes).toHaveBeenCalledTimes(1)
    expect(engine.noteOn).not.toHaveBeenCalled()

    // オンに戻すと選択中の音がまた鳴る
    await user.click(screen.getByRole('button', { name: '鳴らし続ける' }))
    expect(engine.noteOn).toHaveBeenCalledWith(60, 'selection')
    expect(engine.noteOn).toHaveBeenCalledWith(64, 'selection')
  })

  it('Cm7 を選ぶと和音名・周波数・構成音の役割を表示する', async () => {
    const { user } = setup()
    await selectNotes(user, ['C4', 'D♯4 / E♭4', 'G4', 'A♯4 / B♭4'])

    expect(within(result()).getByText('Cm7')).toBeInTheDocument()
    expect(within(result()).getByText('Cマイナーセブンス')).toBeInTheDocument()
    expect(within(result()).getByText('E♭6/C')).toBeInTheDocument()

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual([
      'C4261.63 Hz根音060',
      'E♭4311.13 Hz短3度363',
      'G4392.00 Hz完全5度767',
      'B♭4466.16 Hz短7度1070',
    ])
    expect(screen.getByText(/短三和音に短7度を加えた和音/)).toBeInTheDocument()
  })

  it('2音のときは音程を主表示する', async () => {
    const { user } = setup()
    await selectNotes(user, ['C4', 'G4'])
    expect(within(result()).getByText('完全5度')).toBeInTheDocument()
    expect(within(result()).getByText('C4 → G4（7半音）')).toBeInTheDocument()
  })

  it('判定できない集合には和音名を付けない', async () => {
    const { user } = setup()
    await selectNotes(user, ['C4', 'C♯4 / D♭4', 'D4'])
    expect(within(result()).getByText('判定できる標準的な和音なし')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('和音を再生ボタンで選択音を同時に再生し、全解除で空にする', async () => {
    const { user, engine } = setup()
    await user.click(screen.getByRole('button', { name: '鳴らし続ける' }))
    const play = screen.getByRole('button', { name: '和音を再生' })
    expect(play).toBeDisabled()

    await selectNotes(user, ['E4', 'G4', 'C5'])
    expect(within(result()).getByText('C/E')).toBeInTheDocument()
    await user.click(play)
    expect(engine.playNotes).toHaveBeenLastCalledWith([64, 67, 72], 1)

    await user.click(screen.getByRole('button', { name: '全解除' }))
    expect(key('E4')).toHaveAttribute('aria-pressed', 'false')
    expect(play).toBeDisabled()
  })

  it('鳴らし続けているときは、和音を再生で全音を鳴らし直し、全解除で止める', async () => {
    const { user, engine } = setup()
    await selectNotes(user, ['C4', 'E4', 'G4'])
    engine.noteOn.mockClear()
    await user.click(screen.getByRole('button', { name: '和音を再生' }))
    expect(engine.playNotes).not.toHaveBeenCalled()
    expect(engine.noteOff).toHaveBeenCalledTimes(3)
    expect(engine.noteOn).toHaveBeenCalledTimes(3)

    engine.noteOff.mockClear()
    await user.click(screen.getByRole('button', { name: '全解除' }))
    expect(engine.noteOff.mock.calls).toEqual([
      [60, 'selection'],
      [64, 'selection'],
      [67, 'selection'],
    ])
  })

  it('音色を変更しても選択と判定結果は変わらない', async () => {
    const { user, engine } = setup()
    await selectNotes(user, ['C4', 'E4', 'G4'])
    engine.noteOn.mockClear()
    await user.selectOptions(screen.getByLabelText('音色'), 'organ')
    expect(engine.setTimbre).toHaveBeenCalledWith('organ')
    // 鳴らし続けている音を新しい音色で鳴らし直す
    expect(engine.noteOn).toHaveBeenCalledTimes(3)
    expect(within(result()).getByText('C')).toBeInTheDocument()
    expect(key('E4')).toHaveAttribute('aria-pressed', 'true')
  })

  it('オクターブを切り替えても選択は保持され、範囲は C2〜B6 に制限される', async () => {
    const { user } = setup()
    await user.click(key('C4'))
    const up = screen.getByRole('button', { name: '1オクターブ上げる' })
    const down = screen.getByRole('button', { name: '1オクターブ下げる' })

    await user.click(up)
    expect(screen.getByText('C5–B6')).toBeInTheDocument()
    expect(up).toBeDisabled()
    expect(screen.getByText(/うち1音は表示範囲外/)).toBeInTheDocument()

    await user.click(down)
    await user.click(down)
    await user.click(down)
    expect(screen.getByText('C2–B3')).toBeInTheDocument()
    expect(down).toBeDisabled()
    expect(within(result()).getByText('C4')).toBeInTheDocument()
  })

  it('選択は最大12音までで、超えると通知する', async () => {
    const { user } = setup()
    const keyboard = screen.getByRole('group', { name: /ピアノ鍵盤/ })
    const keys = within(keyboard).getAllByRole('button')
    for (const k of keys.slice(0, 13)) await user.click(k)
    expect(screen.getByRole('status')).toHaveTextContent('最大12個')
    expect(screen.getByText('選択中: 12音')).toBeInTheDocument()
  })

  it('PCキーで音を選択でき、キーリピートでは重複しない', async () => {
    const { user, engine } = setup()
    await user.keyboard('{z>5/}') // Z を押しっぱなし（リピート）にしてから離す
    expect(key('C4')).toHaveAttribute('aria-pressed', 'true')
    expect(engine.noteOn).toHaveBeenCalledTimes(1)
    await user.keyboard('q')
    expect(key('C5')).toHaveAttribute('aria-pressed', 'true')
  })

  it('入力欄にフォーカスがあるときは楽器のショートカットを捕捉しない', async () => {
    const { user } = setup()
    screen.getByLabelText('音色').focus()
    await user.keyboard('z')
    expect(key('C4')).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('App: 演奏モード', () => {
  async function performMode() {
    const ctx = setup()
    await ctx.user.click(screen.getByRole('button', { name: '演奏' }))
    return ctx
  }

  it('押下中だけ発音し、押下中の音を分析する', async () => {
    const { engine } = await performMode()
    fireEvent.pointerDown(key('C4'), { pointerId: 1, button: 0 })
    fireEvent.pointerDown(key('E4'), { pointerId: 2, button: 0 })
    fireEvent.pointerDown(key('G4'), { pointerId: 3, button: 0 })
    expect(engine.noteOn).toHaveBeenCalledWith(60, 'pointer:1')
    expect(engine.noteOn).toHaveBeenCalledTimes(3)
    expect(within(result()).getByText('C')).toBeInTheDocument()
    expect(key('C4')).toHaveClass('is-held')
    expect(key('C4')).not.toHaveAttribute('aria-pressed')

    fireEvent.pointerUp(key('E4'), { pointerId: 2 })
    expect(engine.noteOff).toHaveBeenCalledWith(64, 'pointer:2')
    expect(key('E4')).not.toHaveClass('is-held')
    expect(within(result()).getByText('完全5度')).toBeInTheDocument()

    fireEvent.pointerCancel(key('C4'), { pointerId: 1 })
    expect(engine.noteOff).toHaveBeenCalledWith(60, 'pointer:1')
  })

  it('PCキーの押下と離しで発音・停止し、キーリピートで重複しない', async () => {
    const { user, engine } = await performMode()
    await user.keyboard('{x>3}')
    expect(engine.noteOn).toHaveBeenCalledTimes(1)
    expect(engine.noteOn).toHaveBeenCalledWith(62, 'key:KeyX')
    expect(key('D4')).toHaveClass('is-held')
    await user.keyboard('{/x}')
    expect(engine.noteOff).toHaveBeenCalledWith(62, 'key:KeyX')
    expect(key('D4')).not.toHaveClass('is-held')
  })

  it('ウィンドウのフォーカスを失うと押下中の音を止める', async () => {
    const { engine } = await performMode()
    fireEvent.pointerDown(key('C4'), { pointerId: 1, button: 0 })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(engine.stopAll).toHaveBeenCalled()
    expect(key('C4')).not.toHaveClass('is-held')
  })

  it('モードを切り替えると発音中の音を止め、和音作成の選択は保持する', async () => {
    const { user, engine } = setup()
    await user.click(key('A4'))
    await user.click(screen.getByRole('button', { name: '演奏' }))
    expect(engine.stopAll).toHaveBeenCalled()
    expect(within(result()).queryByText('A4')).not.toBeInTheDocument()
    engine.noteOn.mockClear()
    await user.click(screen.getByRole('button', { name: '和音作成' }))
    expect(key('A4')).toHaveAttribute('aria-pressed', 'true')
    // 和音作成モードに戻ると、選択中の音をまた鳴らし続ける
    expect(engine.noteOn).toHaveBeenCalledWith(69, 'selection')
  })
})

describe('App: フォーカス喪失・タブ非表示', () => {
  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  it('和音作成モードの持続音は、ウィンドウのフォーカスを失っても止めない', async () => {
    const { user, engine } = setup()
    await user.click(key('C4'))
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(engine.stopAll).not.toHaveBeenCalled()
  })

  it('タブが非表示になると持続音を止め、「鳴らし続ける」をオフにする', async () => {
    const { user, engine } = setup()
    await user.click(key('C4'))
    setVisibility('hidden')
    expect(engine.stopAll).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '鳴らし続ける' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    setVisibility('visible')
  })
})

describe('App: 音声エラー・音量', () => {
  it('AudioContext を使えなくても画面は動作し、エラーを表示する', async () => {
    const fail = vi.fn(async () => {
      throw new AudioUnavailableError()
    })
    const engine = createMockEngine({ noteOn: fail, playNotes: fail })
    const { user } = setup(engine)
    await selectNotes(user, ['C4', 'E4', 'G4'])
    expect(await screen.findByRole('alert')).toHaveTextContent('Web Audio API を利用できません')
    expect(within(result()).getByText('C')).toBeInTheDocument()
  })

  it('音量スライダーで音量を変更する', () => {
    const { engine } = setup()
    fireEvent.change(screen.getByLabelText('音量'), { target: { value: '0' } })
    expect(engine.setVolume).toHaveBeenLastCalledWith(0)
  })
})
