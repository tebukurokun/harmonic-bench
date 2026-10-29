import { describe, expect, it } from 'vitest'
import { findRisingEdge, scopeWindowSec } from '../src/audio/scope'

describe('scopeWindowSec', () => {
  it('最低音の3周期分を表示する', () => {
    expect(scopeWindowSec([69])).toBeCloseTo(3 / 440, 6)
    expect(scopeWindowSec([76, 69, 72])).toBeCloseTo(3 / 440, 6)
  })

  it('音がないときは既定の幅、低い音でも50msまでにする', () => {
    expect(scopeWindowSec([])).toBe(0.02)
    expect(scopeWindowSec([36])).toBeLessThanOrEqual(0.05)
    expect(scopeWindowSec([24])).toBe(0.05)
  })
})

describe('findRisingEdge', () => {
  const sine = Array.from({ length: 400 }, (_, i) => Math.sin((2 * Math.PI * i) / 100 + 1))

  it('上向きにゼロをまたぐ位置を返す', () => {
    const edge = findRisingEdge(sine, 0, 400, 0.5)
    expect(sine[edge - 1]).toBeLessThan(0)
    expect(sine[edge]).toBeGreaterThanOrEqual(0)
  })

  it('しきい値を下回る前の小さなゼロクロスは使わない', () => {
    const samples = [0.1, -0.05, 0.05, -0.6, -0.2, 0.3, 0.8]
    expect(findRisingEdge(samples, 0, samples.length, 0.5)).toBe(5)
  })

  it('範囲内に見つからなければ開始位置を返す', () => {
    expect(findRisingEdge(new Array(10).fill(0), 3, 10, 0.1)).toBe(3)
  })
})
