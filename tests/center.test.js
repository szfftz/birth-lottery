// 國家的中心：面積最大的那一塊的重心；重心落在形狀外面就用備用點
import { describe, it, expect } from 'vitest'
import { mainCenter, geoRings, svgRings } from '../src/lib/center.js'

const square = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]

describe('mainCenter', () => {
  it('取面積最大那一塊的重心', () => {
    expect(mainCenter([square(0, 0, 1), square(10, 10, 4)], [0, 0])).toEqual([12, 12])
  })
  it('凹形（重心在外面）退回備用點', () => {
    const c = [[0, 0], [10, 0], [10, 1], [1, 1], [1, 9], [10, 9], [10, 10], [0, 10], [0, 0]] // ㄈ字形
    expect(mainCenter([c], [0.5, 5])).toEqual([0.5, 5])
  })
  it('沒有形狀就用備用點', () => expect(mainCenter([], [1, 2])).toEqual([1, 2]))
})

describe('geoRings、svgRings', () => {
  it('GeoJSON 只取每一塊的外圈', () => {
    expect(geoRings({ type: 'MultiPolygon', coordinates: [[square(0, 0, 1), square(0.2, 0.2, 0.1)], [square(5, 5, 1)]] })).toHaveLength(2)
    expect(geoRings({ type: 'Point', coordinates: [0, 0] })).toEqual([])
  })
  it('SVG 路徑拆成每一塊的點', () => {
    expect(svgRings('M0 0L1 0L1 1ZM5 5L6 5L6 6Z').filter((r) => r.length)).toHaveLength(2)
  })
})
