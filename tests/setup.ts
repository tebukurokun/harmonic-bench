import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom は canvas を描画できない。波形表示は描画せずに終わる
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null })

afterEach(() => {
  cleanup()
})
