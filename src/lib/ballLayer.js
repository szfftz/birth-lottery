// 彩球、排列、格子模式：每個國家照人口換成整數顆彩球（MapLibre 自訂圖層，一顆球一個 GL 點）
// 球數由 build_balls.py 先算好（總共 891 顆，每國至少 1 顆）；位置由網頁排（setPos），國旗模式球面貼國旗（setFlags）
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))

/**
 * 給 GL 圖層用的球：照 balls（lottery.js）的國家順序，第 k 國的球是第 start[k]～start[k+1]-1 顆
 * 位置一開始都是 0（每個模式都會自己排，setPos）；flag＝國旗在 flags.png 的第幾格（＝k）
 */
export function glBalls(balls, colors) {
  const { n, isos, start } = balls
  const col = new Uint8Array(n * 3), flag = new Float32Array(n)
  isos.forEach((iso, k) => {
    const c = hex(colors[iso])
    for (let b = start[k]; b < start[k + 1]; b++) { col.set(c, b * 3); flag[b] = k }
  })
  return { ...balls, pos: new Float32Array(n * 2), lngLat: new Float32Array(n * 2), col, flag }
}

const FRAG = `#version 300 es
precision mediump float;
in vec3 v_color;
in float v_flag;
uniform float u_alpha;
uniform bool u_flags;
uniform sampler2D u_atlas;
uniform vec2 u_grid;
out vec4 frag;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  // 畫成立體的球：球面法向量（螢幕 y 往下）、光從左上前方來 → 明暗（漫射）＋一點亮點（鏡面）＋邊緣暗一圈
  vec3 n = vec3(p.x, p.y, sqrt(1.0 - d));
  vec3 L = normalize(vec3(-0.55, -0.65, 0.75));
  float diff = 0.5 + 0.55 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float rim = smoothstep(0.55, 1.0, d);
  vec3 c;
  if (u_flags) {
    // 國旗貼在球面上：中間放大、邊緣擠扁（asin），看起來是包在球上
    vec2 uv = 0.5 + asin(clamp(p, -0.999, 0.999)) / 3.14159265;
    vec2 cell = vec2(mod(v_flag, u_grid.x), floor(v_flag / u_grid.x));
    vec3 f = texture(u_atlas, (cell + uv) / u_grid).rgb;
    c = f * diff;
  } else {
    c = v_color * diff;
  }
  c = c * (1.0 - 0.3 * rim) + vec3(spec * 0.75);
  float a = u_alpha * (1.0 - smoothstep(0.8, 1.0, d));
  frag = vec4(c * a, a);
}`

/**
 * @param {Awaited<ReturnType<typeof loadBalls>>} balls
 * @param {{ size: (zoom: number) => number, alpha?: number, selSize?: number, dim?: number }} opt
 *   size：球的直徑（css px）；selSize：抽到的那顆放大成幾 px；dim：有抽到球時，其他球淡到多少
 *   atlas：國旗拼圖（ImageBitmap，build_flags.mjs 的 flags.png）；grid：拼圖幾欄幾列 [cols, rows]
 */
export function createBallLayer(balls, { id = 'balls', size, alpha = 1, selSize = 28, dim = 0.35, atlas = null, grid = [1, 1] } = {}) {
  let program, vao, loc = {}, variant = '', gl, posBuf, tex
  let flags = false // 國旗模式
  let pos = balls.pos, posDirty = false // 現在用的位置（墨卡托）；排列模式換成排好的位置
  function build(shaderData) {
    const vs = `#version 300 es
${shaderData.vertexShaderPrelude}
${shaderData.define}
in vec2 a_pos; in vec3 a_color; in float a_flag;
uniform float u_size;
out vec3 v_color;
out float v_flag;
void main() {
  gl_Position = projectTile(a_pos);
  gl_PointSize = u_size;
  v_color = a_color;
  v_flag = a_flag;
}`
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
      return s
    }
    if (program) gl.deleteProgram(program)
    program = gl.createProgram()
    gl.attachShader(program, sh(gl.VERTEX_SHADER, vs))
    gl.attachShader(program, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    for (const u of ['u_projection_matrix', 'u_projection_fallback_matrix', 'u_projection_tile_mercator_coords', 'u_projection_clipping_plane', 'u_projection_transition', 'u_size', 'u_alpha', 'u_flags', 'u_atlas', 'u_grid']) loc[u] = gl.getUniformLocation(program, u)
    vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const buf = (data, name, size, type, norm) => {
      const l = gl.getAttribLocation(program, name)
      const b = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, b)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(l)
      gl.vertexAttribPointer(l, size, type, norm, 0, 0)
      return b
    }
    posBuf = buf(pos, 'a_pos', 2, gl.FLOAT, false)
    buf(balls.col, 'a_color', 3, gl.UNSIGNED_BYTE, true)
    buf(balls.flag, 'a_flag', 1, gl.FLOAT, false)
    gl.bindVertexArray(null)
    if (atlas && !tex) {
      tex = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
  }
  return {
    id, type: 'custom', renderingMode: '2d',
    sel: null, // 抽到的是第幾顆（沒有＝null）
    setSel(b) { this.sel = b; this.map?.triggerRepaint() },
    // 球畫成國旗（要有 atlas）
    setFlags(on) { flags = on && !!atlas; this.map?.triggerRepaint() },
    // 換位置（墨卡托 x, y 交錯；沒給＝回到撒在國土裡的位置）
    setPos(p) {
      // 等 render 再上傳：MapLibre 只在自訂圖層 render 後重設 GL 狀態，在外面綁 buffer 會讓它寫錯 buffer
      pos = p ?? balls.pos
      posDirty = true
      this.map?.triggerRepaint()
    },
    onAdd(map, g) { gl = g; this.map = map },
    render(g, args) {
      if (variant !== args.shaderData.variantName) {
        build(args.shaderData)
        variant = args.shaderData.variantName
        posDirty = false
      }
      const pd = args.defaultProjectionData
      gl.useProgram(program)
      gl.uniformMatrix4fv(loc.u_projection_matrix, false, pd.mainMatrix)
      gl.uniformMatrix4fv(loc.u_projection_fallback_matrix, false, pd.fallbackMatrix)
      gl.uniform4f(loc.u_projection_tile_mercator_coords, ...pd.tileMercatorCoords)
      gl.uniform4f(loc.u_projection_clipping_plane, ...pd.clippingPlane)
      gl.uniform1f(loc.u_projection_transition, pd.projectionTransition)
      // 下載 IG 時 MapLibre 會調高 pixel ratio，球的大小跟著乘上，看起來才跟畫面一樣
      const pr = this.map.getPixelRatio()
      gl.uniform1f(loc.u_size, size(this.map.getZoom()) * pr)
      gl.uniform1f(loc.u_alpha, this.sel == null ? alpha : alpha * dim)
      gl.uniform1i(loc.u_flags, flags ? 1 : 0)
      if (flags) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.uniform1i(loc.u_atlas, 0)
        gl.uniform2f(loc.u_grid, grid[0], grid[1])
      }
      // 其他圖層（例如滑鼠描亮的線、面）可能留著模板測試、背面剔除，關掉才不會把球裁掉
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.STENCIL_TEST)
      gl.disable(gl.CULL_FACE)
      gl.colorMask(true, true, true, true)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      if (posDirty) { gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW); posDirty = false }
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.POINTS, 0, balls.n)
      // 抽到的那顆最後再畫一次，放大、不淡化，蓋在其他球上面
      if (this.sel != null) {
        gl.uniform1f(loc.u_size, Math.max(selSize, size(this.map.getZoom())) * pr)
        gl.uniform1f(loc.u_alpha, alpha)
        gl.drawArrays(gl.POINTS, this.sel, 1)
      }
      gl.bindVertexArray(null)
    },
  }
}
