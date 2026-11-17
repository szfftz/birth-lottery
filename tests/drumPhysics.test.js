// 搖獎機物理：一開始球都在滾筒裡、堆在下面；轉一陣子再打開出球口，會有一顆球掉出來
import { describe, it, expect } from 'vitest'
import { createDrumSim, DRUM, SPIN, HOLE, wrapA } from '../src/lib/drumPhysics.js'
import { BALL_R as R } from '../src/lib/ball3d.js'

describe('createDrumSim', () => {
  const N = 300
  const sim = createDrumSim(N)
  sim.initBalls()

  it('一開始每顆球都在滾筒裡', () => {
    for (let b = 0; b < N; b++) {
      expect(sim.where[b]).toBe(0)
      expect(Math.hypot(sim.px[b], sim.py[b])).toBeLessThanOrEqual(DRUM.r - R + 1e-3)
      expect(Math.abs(sim.pz[b])).toBeLessThanOrEqual(DRUM.d / 2 - R + 1e-3)
    }
  })
  it('靠重力堆在下半部', () => {
    let below = 0
    for (let b = 0; b < N; b++) if (sim.py[b] < 0) below++
    expect(below / N).toBeGreaterThan(0.9)
  })
  it('轉一轉、出球口轉到下面打開，會掉出一顆球', () => {
    const h = 1 / 240
    sim.omega = SPIN.w
    for (let k = 0; k < 240 * 2; k++) { sim.angle += sim.omega * h; sim.step(h) }
    sim.omega = 0
    sim.angle += wrapA(-Math.PI / 2 - (HOLE.a + sim.angle)) // 出球口朝正下方
    sim.gateOpen = true
    sim.escaped = -1
    for (let k = 0; k < 240 * 5 && sim.escaped < 0; k++) sim.step(h)
    expect(sim.escaped).toBeGreaterThanOrEqual(0)
    expect(sim.where[sim.escaped]).toBe(1)
    expect(sim.gateOpen).toBe(false) // 掉出一顆就關起來
  })
})
