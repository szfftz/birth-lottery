// 盒子、遊戲模式共用的 3D 彩球（three.js）：891 顆球一個 InstancedMesh，球面是獎項顏色或國旗
// 國旗：flags.png 拼圖，每顆球的貼圖座標換成那一國的那一格；雙面：上半球、下半球各包一面國旗，包滿整個半球、不留白（球極投影：半球攤成圓盤，再放大一點蓋滿國旗的大部分）
import * as THREE from 'three'

export const BALL_R = 0.5

/**
 * @param {{ n: number, isos: string[], start: Int32Array }} balls  loadBalls() 的結果
 * @param {Record<string, string>} colors  每一國球的顏色（獎項色）
 * @param {ImageBitmap | null} atlas  國旗拼圖
 * @param {[number, number]} grid  拼圖幾欄幾列
 * @param {'prize' | 'flag'} face
 */
export function makeBallMesh({ balls, colors, atlas, grid, face }) {
  const { n, isos, start } = balls
  const geo = new THREE.SphereGeometry(BALL_R, 24, 16)
  const cellOf = new Float32Array(n * 2)
  isos.forEach((iso, k) => {
    for (let b = start[k]; b < start[k + 1]; b++) { cellOf[b * 2] = k % grid[0]; cellOf[b * 2 + 1] = Math.floor(k / grid[0]) }
  })
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellOf, 2))
  let tex = null
  if (atlas) {
    tex = new THREE.Texture(atlas)
    tex.flipY = false
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.needsUpdate = true
  }
  // 亮面樂透球：表面一層清漆（clearcoat），打光有亮點
  const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, map: tex })
  mat.userData.flag = face === 'flag' ? 1 : 0
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrid = { value: new THREE.Vector2(...grid) }
    sh.uniforms.uFlag = { value: mat.userData.flag }
    mat.userData.shader = sh
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCell;\nvarying vec2 vCell;\nvarying vec3 vObj;')
      // 國旗：在每個像素算（上下半球交界才不會糊掉）；球極投影（方向 ÷ (1＋|y|)），北邊＝z 小＝拼圖格子的上面；下半球 x 反過來，從下面看才是正的；×0.62：國旗四個角切掉一點、赤道附近延伸國旗的邊
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vCell = aCell;\n  vObj = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlag;\nuniform vec2 uGrid;\nvarying vec2 vCell;\nvarying vec3 vObj;')
      // 貼圖不跟顏色相乘：國旗模式直接用國旗的顏色，獎項色模式只用每顆球的顏色
      .replace('#include <map_fragment>', '')
      .replace('#include <color_fragment>', '#include <color_fragment>\n#ifdef USE_MAP\n  if (uFlag > 0.5) {\n    vec3 pn = normalize(vObj);\n    vec2 fuv = clamp(vec2(pn.y < 0.0 ? -pn.x : pn.x, pn.z) / (1.0 + abs(pn.y)) * 0.62 + 0.5, 0.01, 0.99);\n    diffuseColor.rgb = texture2D(map, (vCell + fuv) / uGrid).rgb;\n  }\n#endif')
  }
  const m = new THREE.InstancedMesh(geo, mat, n)
  const c = new THREE.Color()
  isos.forEach((iso, k) => {
    c.set(colors[iso])
    for (let b = start[k]; b < start[k + 1]; b++) m.setColorAt(b, c)
  })
  return m
}

// 換球面：獎項色 ↔ 國旗
export function setBallFace(mesh, face) {
  mesh.material.userData.flag = face === 'flag' ? 1 : 0
  const sh = mesh.material.userData.shader
  if (sh) sh.uniforms.uFlag.value = mesh.material.userData.flag
}

// 3D 畫面原本照 4:5 調：畫面比 4:5 長（手機全螢幕）時把垂直視角放大，讓水平視角跟 4:5 一樣，東西不會被左右切掉
export function fitFov(fov, aspect, ref = 0.8) {
  if (aspect >= ref) return fov
  const t = Math.tan((fov * Math.PI) / 360) * (ref / aspect)
  return (Math.atan(t) * 360) / Math.PI
}
