// 預先算好「球一開始堆在滾筒底部」的位置，存成 src/data/settled.json（每顆球 x、y、z，小數 3 位）。
// 網頁打開時直接用，不用在手機上跑 600 步物理（那一下會卡 1～3 秒）。
// 改了滾筒大小、球數、物理參數之後重跑：node scripts/build_settled.mjs
import { writeFileSync, readFileSync } from 'node:fs'
import { createDrumSim } from '../src/lib/drumPhysics.js'

const n = JSON.parse(readFileSync(new URL('../src/data/balls.json', import.meta.url))).total
const sim = createDrumSim(n)
sim.initBalls()
const r = (v) => Math.round(v * 1000) / 1000
const xyz = []
for (let b = 0; b < n; b++) xyz.push(r(sim.px[b]), r(sim.py[b]), r(sim.pz[b]))
writeFileSync(new URL('../src/data/settled.json', import.meta.url), JSON.stringify({ n, xyz }))
console.log(`settled.json：${n} 顆球`)
