  // ---------- 表示スケール (実距離・実サイズ) ----------
  const WORLD = 340;              // 海王星軌道 (30.11 au) = WORLD
  const K_REAL = WORLD / 30.11;
  const AU_KM = 149597870.7;
  const KM2W = K_REAL / AU_KM;    // km → world 単位

  function mapRadius(rAU) {
    return rAU * K_REAL;
  }

  // 天体の表示半径 (world 単位, 実寸比)
  function bodyR(b) {
    return b.rkm * KM2W;
  }

  // ---------- ケプラー軌道 (3D) ----------
  for (const p of PLANETS) {
    const w = (p.peri - p.node) * DEG, O = p.node * DEG, inc = p.i * DEG;
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
    // 軌道面 → 黄道座標の回転係数 (定数)
    p.m = [
      cO * cw - sO * sw * ci, -cO * sw - sO * cw * ci,
      sO * cw + cO * sw * ci, -sO * sw + cO * cw * ci,
      sw * si, cw * si,
    ];
  }

  // 実際の近日点通過日 (TT)。ハレー彗星は木星・土星の摂動で回帰間隔が毎回
  // 0.5年ほど変わるため、単一の公転周期では全ての回帰に時期を合わせられない
  // (1986年に合わせると1910年が約半年ずれ、近日点付近では位置が大きく外れる)。
  // 区間ごとの実周期で平均近点角を求めることで、どの回帰でも時期を合わせる
  const PERI_EPOCHS = {
    halley: [
      Date.UTC(1835, 10, 16), Date.UTC(1910, 3, 20), Date.UTC(1986, 1, 9),
      Date.UTC(2061, 6, 28), Date.UTC(2134, 2, 27),
    ].map((ms) => (ms - J2000) / DAY_MS),
  };
  for (const p of PLANETS) {
    if (PERI_EPOCHS[p.key]) p.periT = PERI_EPOCHS[p.key];
  }
  // 平均近点角。近日点通過日の表を持つ天体は、その区間の実周期から求める
  // (表の範囲外は両端の区間の周期で外挿)
  function meanAnom(p, days) {
    const tp = p.periT;
    if (!tp) return (p.L0 - p.peri) * DEG + 2 * Math.PI * days / p.T;
    let i = 0;
    while (i < tp.length - 2 && days >= tp[i + 1]) i++;
    return 2 * Math.PI * (days - tp[i]) / (tp[i + 1] - tp[i]);
  }

  function keplerAU(p, days, out) {
    const M = meanAnom(p, days) % (2 * Math.PI);
    let E = M;
    // 反復回数はハレー彗星 (e≈0.97) でも収束する回数に設定
    for (let k = 0; k < 12; k++) E -= (E - p.e * Math.sin(E) - M) / (1 - p.e * Math.cos(E));
    const xo = p.a * (Math.cos(E) - p.e);
    const yo = p.a * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
    out[0] = p.m[0] * xo + p.m[1] * yo;   // 黄道 X
    out[1] = p.m[2] * xo + p.m[3] * yo;   // 黄道 Y
    out[2] = p.m[4] * xo + p.m[5] * yo;   // 黄道 Z (北)
    return out;
  }

  // 現在の離心近点角 E ∈ [0, 2π) を返す (軌道の高精細パッチ用)
  function keplerE(p, days) {
    const M = meanAnom(p, days) % (2 * Math.PI);
    let E = M;
    for (let k = 0; k < 12; k++) E -= (E - p.e * Math.sin(E) - M) / (1 - p.e * Math.cos(E));
    return ((E % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }

  // 黄道座標 [AU] → ワールド座標 (Y-up)
  function toWorld(au, out) {
    const r = Math.hypot(au[0], au[1], au[2]);
    const s = r < 1e-9 ? 0 : mapRadius(r) / r;
    out[0] = au[0] * s;
    out[1] = au[2] * s;
    out[2] = -au[1] * s;
    return out;
  }

  // ---------- 最小 mat4 (列優先) ----------
  //   out を渡すとその配列に書き込んで返す (毎フレームのアロケーション回避)。
  //   mMul の out は a・b と別の配列であること。
  function mIdent(out) {
    const o = out || new Float32Array(16);
    o.fill(0); o[0] = o[5] = o[10] = o[15] = 1;
    return o;
  }
  function mMul(a, b, out) {
    const o = out || new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
    }
    return o;
  }
  function mPersp(fovy, aspect, near, far, out) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    const o = out || new Float32Array(16);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  }
  function mLookAt(eye, tgt, up, out) {
    const o = out || new Float32Array(16);
    let zx = eye[0]-tgt[0], zy = eye[1]-tgt[1], zz = eye[2]-tgt[2];
    let l = Math.hypot(zx,zy,zz); zx/=l; zy/=l; zz/=l;
    let xx = up[1]*zz - up[2]*zy, xy = up[2]*zx - up[0]*zz, xz = up[0]*zy - up[1]*zx;
    l = Math.hypot(xx,xy,xz) || 1; xx/=l; xy/=l; xz/=l;
    const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
    o[0]=xx; o[1]=yx; o[2]=zx; o[3]=0;
    o[4]=xy; o[5]=yy; o[6]=zy; o[7]=0;
    o[8]=xz; o[9]=yz; o[10]=zz; o[11]=0;
    o[12] = -(xx*eye[0]+xy*eye[1]+xz*eye[2]);
    o[13] = -(yx*eye[0]+yy*eye[1]+yz*eye[2]);
    o[14] = -(zx*eye[0]+zy*eye[1]+zz*eye[2]);
    o[15] = 1;
    return o;
  }
  function mRotX(a, out) {
    const c=Math.cos(a), s=Math.sin(a);
    const o = out || new Float32Array(16);
    o.fill(0); o[0]=1; o[5]=c; o[6]=s; o[9]=-s; o[10]=c; o[15]=1;
    return o;
  }
  function mRotY(a, out) {
    const c=Math.cos(a), s=Math.sin(a);
    const o = out || new Float32Array(16);
    o.fill(0); o[0]=c; o[2]=-s; o[5]=1; o[8]=s; o[10]=c; o[15]=1;
    return o;
  }
  function mTRS(t, rot, s, out) {
    const o = out || new Float32Array(16);
    if (rot) {
      for (let i = 0; i < 12; i++) o[i] = rot[i] * s;
    } else {
      o.fill(0); o[0] = o[5] = o[10] = s;
    }
    o[3] = o[7] = o[11] = 0;
    o[12] = t[0]; o[13] = t[1]; o[14] = t[2]; o[15] = 1;
    return o;
  }

