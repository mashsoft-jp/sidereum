  // ---------- WebGL 初期化 ----------
  const glc = document.getElementById("gl");
  const gl = glc.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) {
    document.getElementById("noGL").style.display = "grid";
    return;
  }
  const ovl = document.getElementById("overlay");
  const octx = ovl.getContext("2d");

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error("shader: " + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  function program(vs, fs) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      throw new Error("link: " + gl.getProgramInfoLog(pr));
    }
    const u = {}, a = {};
    const nu = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(pr, i); u[info.name] = gl.getUniformLocation(pr, info.name); }
    const na = gl.getProgramParameter(pr, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(pr, i); a[info.name] = gl.getAttribLocation(pr, info.name); }
    return { pr, u, a };
  }

  const PRE = "precision highp float;\n";
  // 画素ごとの微分と、微分を指定したテクスチャ取得。どちらも天体テクスチャの
  // 継ぎ目対策に要る (下の bodyFS)
  const hasDeriv = !!gl.getExtension("OES_standard_derivatives");
  const hasTexLod = hasDeriv && !!gl.getExtension("EXT_shader_texture_lod");
  const EXT_DERIV = hasDeriv ? "#extension GL_OES_standard_derivatives : enable\n" : "";

  // ---- 天体シェーダ (全種別を uType で分岐) ----
  const bodyVS = `@@glsl:body.vert@@`;

  // 空の色は空ドームと天体のエアライトで共有する (GLSL は入れ子 include できないので
  // ここで前置きして両方に持たせる)
  const SKY_FN = `@@glsl:sky-color@@`;
  const bodyFS = EXT_DERIV
    + (hasTexLod ? "#extension GL_EXT_shader_texture_lod : enable\n#define TEXLOD 1\n" : "")
    + PRE + SKY_FN + `@@glsl:body.frag@@`;

  // ---- 線 (軌道) ----
  const lineVS = `@@glsl:line.vert@@`;
  const lineFS = PRE + `@@glsl:line.frag@@`;

  // ---- 風景 (地面の質感 / 空の色。地上・月面ビュー用。すべてプロシージャル生成) ----
  const terrainVS = `@@glsl:terrain.vert@@`;

  const terrainFS = PRE + SKY_FN + `@@glsl:terrain.frag@@`;

  // ---- 点 (星・小惑星・惑星マーカー) ----
  const pointVS = `@@glsl:point.vert@@`;
  const pointFS = PRE + `@@glsl:point.frag@@`;

  // ---- ビルボード (太陽コロナ) ----
  const billVS = `@@glsl:bill.vert@@`;
  const billFS = PRE + `@@glsl:bill.frag@@`;

  // ---- 彗星の尾 (曲率を持つカメラ正対リボン, 加算) ----
  const tailVS = `@@glsl:tail.vert@@`;
  const tailFS = PRE + `@@glsl:tail.frag@@`;

  // ---- 彗星のコマ (太陽側が圧縮された涙滴型の光。ガウシアン減衰で継ぎ目なし) ----
  const comaVS = `@@glsl:coma.vert@@`;
  const comaFS = PRE + `@@glsl:coma.frag@@`;

  // ---- 土星の環 ----
  const ringVS = `@@glsl:ring.vert@@`;
  const ringFS = PRE + `@@glsl:ring.frag@@`;

  // ---- 探査機のメッシュ (法線は持たず面の微分から求めるので拡張が要る) ----
  const meshVS = `@@glsl:mesh.vert@@`;
  const meshFS = EXT_DERIV
    + PRE + `@@glsl:mesh.frag@@`;

  // 天体用プログラムは変数に持たず、レンダラのクロージャへ閉じ込める。
  // これにより uniform をここ以外から直接触れなくなり、設定漏れが起きない
  let bodyRenderer;
  let lineP, pointP, billP, ringP, tailP, comaP, terrainP, meshP;
  try {
    bodyRenderer = createBodyRenderer(program(bodyVS, bodyFS));
    lineP = program(lineVS, lineFS);
    pointP = program(pointVS, pointFS);
    billP = program(billVS, billFS);
    ringP = program(ringVS, ringFS);
    tailP = program(tailVS, tailFS);
    comaP = program(comaVS, comaFS);
    terrainP = program(terrainVS, terrainFS);
    meshP = program(meshVS, meshFS);
  } catch (err) {
    console.error(err);
    document.getElementById("noGL").style.display = "grid";
    return;
  }

  // ---------- ジオメトリ ----------
  function makeSphere(segs, rings) {
    const pos = [], idx = [];
    for (let y = 0; y <= rings; y++) {
      const th = y / rings * Math.PI;
      for (let x = 0; x <= segs; x++) {
        const ph = x / segs * 2 * Math.PI;
        pos.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      }
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < segs; x++) {
      const a = y * (segs + 1) + x, b = a + segs + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
  }
  // 弦と弧のずれは (半角)² で効くので、56分割でも半径の 0.16%。惑星が
  // 画面いっぱいでも 1080p なら 0.6px で見えない。4K で画面いっぱいにすると
  // 1.7px になるので、そこだけ余裕を持たせて 96分割にしてある
  const sphere = makeSphere(96, 60);
  const sphereVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVB);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.pos, gl.STATIC_DRAW);
  const sphereIB = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIB);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.idx, gl.STATIC_DRAW);

  // 環 (単位半径の平円環, aR = 半径)。内外径は実測 (C環の内側 〜 F環の外側) を
  // 土星の平均半径で割ったもの。半径ごとの濃さと色は RING_KNOTS から焼いた
  // 1次元テクスチャで引く
  const RING_SEG = 160;
  const RING_RM = PLANETS.find((p) => p.key === "saturn").rkm;
  const RING_IN = RING_R0 / RING_RM, RING_OUT = RING_R1 / RING_RM;
  {
    var ringData = new Float32Array((RING_SEG + 1) * 2 * 4);
    let o = 0;
    for (let s = 0; s <= RING_SEG; s++) {
      const a = s / RING_SEG * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a);
      ringData[o++] = c * RING_IN; ringData[o++] = 0; ringData[o++] = sn * RING_IN; ringData[o++] = RING_IN;
      ringData[o++] = c * RING_OUT; ringData[o++] = 0; ringData[o++] = sn * RING_OUT; ringData[o++] = RING_OUT;
    }
  }
  const ringVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ringVB);
  gl.bufferData(gl.ARRAY_BUFFER, ringData, gl.STATIC_DRAW);

  // ビルボード四隅
  const billVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, billVB);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  // 彗星の尾は根元の開きと湾曲を滑らかにするため、長さ方向を細分化する
  const TAIL_SEG = 96, TAIL_VERTS = (TAIL_SEG + 1) * 2;
  const tailData = new Float32Array(TAIL_VERTS * 2);
  for (let i = 0, o = 0; i <= TAIL_SEG; i++) {
    const x = i / TAIL_SEG * 2 - 1;
    tailData[o++] = x; tailData[o++] = -1;
    tailData[o++] = x; tailData[o++] = 1;
  }
  const tailVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tailVB);
  gl.bufferData(gl.ARRAY_BUFFER, tailData, gl.STATIC_DRAW);

