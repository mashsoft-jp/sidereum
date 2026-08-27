  const texByKey = new Map();
  const noTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  // 縮小時のちらつき対策。ミップマップは WebGL1 では2の累乗サイズが必須なので、
  // 満たさない画像は従来どおり LINEAR のまま扱う (REPEAT も使えないので本来 NG)。
  // また経度の継ぎ目でミップ段が落ちないよう、天体シェーダは微分を自前で渡す。
  // それができない端末 (EXT_shader_texture_lod 非対応) では継ぎ目に縦縞が出て
  // しまうので、ミップマップ自体を使わない
  const useMipmap = hasTexLod;
  const isPOT = (n) => n > 0 && (n & (n - 1)) === 0;
  // 異方性フィルタ。斜めから見た地表・月面・環の解像感が上がる。
  // 拡張が無い端末では単に効かない (エラーにはならない)
  const anisoExt = gl.getExtension("EXT_texture_filter_anisotropic") ||
                   gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
                   gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
  const anisoMax = anisoExt
    ? Math.min(8, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 0;
  // 失敗の理由は端末によって違う (ファイルが無い / file:// のオリジン制限) ので、
  // 天体ごとに1回だけ理由を添えて出す
  const texWarn = (key, why) =>
    console.warn(`テクスチャ ${texURL(key)} を使えませんでした: ${why}` +
      (location.protocol === "file:" ? " — file:// では画像を読み込めません。HTTP で配信してください" : ""));
  // 既存のテクスチャオブジェクトへ読み直す。解像度を切り替えても GL の
  // ハンドルは変えないので、これを持っている描画側に手を入れる必要がない
  // 読み込み中の枚数。0 に戻ったところで Service Worker へ控えを頼む
  // (読み込み中に頼むと、同じものをもう一度取りに行かせることになる)
  let texPending = 0;
  function texSettled() {
    if (--texPending === 0) swKeepTextures();
  }
  function loadTexInto(tex, key) {
    texPending++;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // ミップ付きのまま differing サイズを入れると、生成し直すまでの間だけ
    // 不完全なテクスチャ (真っ黒) になる。生成後に付け直すので一旦 LINEAR へ
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const img = new Image();
    img.onload = () => {
      texSettled();
      // file:// で開くと画像自体は読めても不透明オリジン扱いになり、ここが
      // SecurityError で落ちる。取り込めなかったぶんは仮色のまま描く
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      } catch (e) {
        texWarn(key, e.message);
        return;
      }
      // MIN_FILTER をミップマップ付きにするのは生成した後 (先に変えると不完全な
      // テクスチャ扱いになり、真っ黒で描かれる)
      if (useMipmap && isPOT(img.width) && isPOT(img.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        if (anisoMax > 1) gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, anisoMax);
      }
    };
    // tex/ を index.html と一緒に置き忘れた場合にここへ来る
    img.onerror = () => { texSettled(); texWarn(key, "取得できませんでした"); };
    img.src = texURL(key);
    return tex;
  }
  function loadTex(key) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // 読み込み完了までの仮色
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([70, 70, 74]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return loadTexInto(tex, key);
  }
  for (const key in TEXTURES) texByKey.set(key, loadTex(key));
  // 地球の雲と夜景。天体テクスチャとは別のユニットに常駐させる
  const cloudTex = loadTex("cloud");
  const nightTex = loadTex("night");
  // 天の川。読み込み前・失敗時は真っ黒にしておく — 加算合成なので何も足されない。
  // loadTex の仮色 (灰色) のままだと、空全体がうっすら明るくなってしまう
  const mwTex = loadTex("milkyway");
  gl.bindTexture(gl.TEXTURE_2D, mwTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  // 法線図。天体ごとに差し替わるので、地表テクスチャと同じくキーで引く
  const nrmByKey = new Map();
  for (const key in NORMALS) nrmByKey.set(key, loadTex("nrm:" + key));
  // サンプラーとテクスチャユニットの指定は bodyRenderer.beginPass が毎回行う

  // 解像度を切り替えたときの読み直し。差し替わるまでは前の解像度で描き続ける
  // (仮色へ戻すと、切り替えのたびに全天体が一瞬グレーになる)
  function reloadTextures() {
    for (const [key, tex] of texByKey) loadTexInto(tex, key);
    loadTexInto(cloudTex, "cloud");
    loadTexInto(nightTex, "night");
    loadTexInto(mwTex, "milkyway");
    for (const [key, tex] of nrmByKey) loadTexInto(tex, "nrm:" + key);
  }

  // ---------- 土星の環の半径プロファイル ----------
  // RING_KNOTS (実測の半径・光学的厚さ・色) を線形に繋いで 1次元テクスチャへ。
  // アルファには τ ではなく透過率 exp(-τ) を入れる。τ をそのまま 8bit に
  // 入れると、エンケの間隙 (τ=0.02) のような薄いところが 1段階で潰れるため
  const RING_TEX_W = 2048;
  const ringTex = gl.createTexture();
  {
    const px = new Uint8Array(RING_TEX_W * 4);
    let k = 0;
    for (let i = 0; i < RING_TEX_W; i++) {
      const r = RING_R0 + (RING_R1 - RING_R0) * (i + 0.5) / RING_TEX_W;
      while (k < RING_KNOTS.length - 2 && r > RING_KNOTS[k + 1][0]) k++;
      const a0 = RING_KNOTS[k], a1 = RING_KNOTS[k + 1];
      const t = Math.max(0, Math.min(1, (r - a0[0]) / ((a1[0] - a0[0]) || 1)));
      const o = i * 4;
      for (let c = 0; c < 3; c++) {
        px[o + c] = Math.round(255 * (a0[c + 2] + (a1[c + 2] - a0[c + 2]) * t));
      }
      px[o + 3] = Math.round(255 * Math.exp(-(a0[1] + (a1[1] - a0[1]) * t)));
    }
    gl.bindTexture(gl.TEXTURE_2D, ringTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, RING_TEX_W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

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



  // ---------- 探査機のメッシュ ----------
  // base64 → 型付き配列。位置は Int16 (最大寸法 32000) なので、シェーダへ渡す前に
  // 単位長へ戻しておく (モデル行列側で実サイズを掛ける)
  function b64ToBytes(s) {
    const bin = atob(s), n = bin.length, out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const meshByKey = new Map();
  for (const key in PROBE_MESHES) {
    const m = PROBE_MESHES[key];
    const qb = b64ToBytes(m.v), ib = b64ToBytes(m.i);
    const q = new Int16Array(qb.buffer, qb.byteOffset, qb.byteLength / 2);
    const pos = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) pos[i] = q[i] / 32000;
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    const ib2 = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib2);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(ib.buffer, ib.byteOffset, ib.byteLength / 2), gl.STATIC_DRAW);
    meshByKey.set(key, { vb: vb, ib: ib2, n: m.t * 3 });
  }
