  const texByKey = new Map();
  const noTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  for (const key in TEXTURES) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // 読み込み完了までの仮色
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([70, 70, 74]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    };
    img.src = TEXTURES[key];
    texByKey.set(key, tex);
  }
  gl.useProgram(bodyP.pr);
  gl.uniform1i(bodyP.u.uTex, 0);

  // ---------- 星空 ----------
  // 宇宙ビューの背景恒星。以前は乱数配置の装飾だったが、現在はヨール輝星
  // 星表の実位置を使う (バッファ生成は恒星カタログ定義の直後で行う)
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let N_STAR = 0;
  let starVB = null;
  let STAR_W = null;   // 恒星のワールド単位方向 (観測者フレーム投影用, N_STAR×3)

  // ---------- 小惑星帯 ----------
  const N_AST = 1600;
  const asts = [];
  for (let i = 0; i < N_AST; i++) {
    asts.push({
      a: 2.15 + rnd() * 1.15,
      th: rnd() * 2 * Math.PI,
      inc: (rnd() - 0.5) * 0.30,
      node: rnd() * 2 * Math.PI,
      T: 0,
    });
    asts[i].T = 365.256 * Math.pow(asts[i].a, 1.5);
  }
  const astArr = new Float32Array(N_AST * 7);
  const astVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, astVB);
  gl.bufferData(gl.ARRAY_BUFFER, astArr.byteLength, gl.DYNAMIC_DRAW);

  // 惑星マーカー (遠距離でも見える点)
  const markArr = new Float32Array((PLANETS.length + 1 + SATELLITES.length) * 7);
  const markVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, markVB);
  gl.bufferData(gl.ARRAY_BUFFER, markArr.byteLength, gl.DYNAMIC_DRAW);

  // ---------- 軌道線 ----------
  //   折れ線近似の矢高 (弦と真の楕円の距離 ≈ R(2π/N)²/8) が天体半径の3割以下に
  //   なるよう軌道ごとに分割数を決める。サンプルは離心近点角の等分 (幾何的に均等)。
  //   頂点はアンカー (基準点) 相対で焼き込む。太陽中心の生座標のままだと f32 の
  //   量子化誤差が「太陽からの距離 × 1e-7」(外縁部で数百km) になり、外縁天体に
  //   接近した際に線がぶれるため。カメラがアンカーから離れすぎたら焼き直す。
  const orbitVBs = PLANETS.map(() => gl.createBuffer());
  const ORB_ANCHOR = [0, 0, 0];
  function rebuildOrbits(ax, ay, az) {
    ORB_ANCHOR[0] = ax; ORB_ANCHOR[1] = ay; ORB_ANCHOR[2] = az;
    const v = [0, 0, 0];
    const w = [0, 0, 0];
    PLANETS.forEach((p, pi) => {
      const R = mapRadius(p.a * (1 + p.e));
      const n = Math.min(12288, Math.max(512,
        Math.ceil(2 * Math.PI * Math.sqrt(R / (8 * 0.3 * bodyR(p))))));
      p.orbN = n;
      const arr = p.orbArr || (p.orbArr = new Float32Array((n + 1) * 3));
      const be = p.a * Math.sqrt(1 - p.e * p.e);
      for (let i = 0; i <= n; i++) {
        const E = 2 * Math.PI * i / n;
        const xo = p.a * (Math.cos(E) - p.e);
        const yo = be * Math.sin(E);
        v[0] = p.m[0] * xo + p.m[1] * yo;
        v[1] = p.m[2] * xo + p.m[3] * yo;
        v[2] = p.m[4] * xo + p.m[5] * yo;
        toWorld(v, w);
        arr[i*3] = w[0] - ax; arr[i*3+1] = w[1] - ay; arr[i*3+2] = w[2] - az;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, orbitVBs[pi]);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    });
  }
  rebuildOrbits(0, 0, 0);

  // 選択天体の軌道の高精細パッチ (接近時、粗い折れ線の矢高で軌道から
  // 天体がずれて見えるのを、現在位置の近傍だけ毎フレーム引き直して補正)
  const PATCH_N = 1024;
  const patchArr = new Float32Array((PATCH_N + 1) * 3);
  const patchVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, patchVB);
  gl.bufferData(gl.ARRAY_BUFFER, patchArr.byteLength, gl.DYNAMIC_DRAW);

  // 衛星軌道の単位円 (XZ 平面。基底・スケール・平行移動は描画時のモデル行列で適用)
  const SAT_ORB_N = 512;
  const satOrbVB = gl.createBuffer();
  {
    const arr = new Float32Array((SAT_ORB_N + 1) * 3);
    for (let i = 0; i <= SAT_ORB_N; i++) {
      const t = i / SAT_ORB_N * 2 * Math.PI;
      arr[i*3] = Math.cos(t);
      arr[i*3+1] = 0;
      arr[i*3+2] = Math.sin(t);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, satOrbVB);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  }
  // 月の軌道線は ELP 理論から現在時刻の前後1周期ぶんをサンプリングして描く
  // (単純な円だと ELP による実位置と食い違うため。地心ワールドオフセットで格納)
  const MOON_ORB_N = 160;
  const moonOrbBuf = new Float32Array((MOON_ORB_N + 1) * 3);
  let moonOrbVB = null;

  // 自転軸線 (単位球基準, モデル行列で天体半径にスケール)
  const AXIS_LEN = 1.55;
  const axisVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, axisVB);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -AXIS_LEN, 0, 0, AXIS_LEN, 0]), gl.STATIC_DRAW);


