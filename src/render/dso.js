  // ---------- 星雲・星団・銀河 ----------
  // メシエ天体を、面の明るさを持ったぼんやりした楕円として描く。恒星と同じく
  // J2000 のまま置き、歳差は観測地の側を戻して合わせる (CLAUDE.md 参照)。
  //
  // 明るさは「等級 → 光の量」を「見かけの面積」で割った面輝度で決める。板の
  // 大きさは天球上で固定なので、寄っても画面上の明るさは変わらない — 実際の
  // 面輝度と同じふるまいになり、M31 のように大きくて淡いものは寄るほど
  // 薄く広がって見える。
  //
  // 散開星団だけは弱める。明るい星は恒星カタログ (6.5等まで) が既に点で
  // 描いているので、そのうえに全光量ぶんの光を重ねると二重になる。残りは
  // カタログに入らない暗い星なので、そのぶんだけ淡く乗せる
  const DSO_R = 1900;             // 宇宙ビューの天球半径 (恒星と同じ)
  const DSO_AMP = 300;            // 面輝度の倍率 (見た目合わせ)
  const DSO_OCL = 0.28;           // 散開星団の割り引き
  const DSO_MIN_PX = 3;           // 画面上でこれより小さくしない [px]
  const DSO_MAX = 1.25;           // 加算なので上限を決める (中心の飛び防止)
  // 種別ごとの色。肉眼では色まで見えないが、種類が見分けられる方が
  // プラネタリウムとしては役に立つ。写真の色を淡くしたもの
  const DSO_COL = [
    [1.00, 0.94, 0.86],   // 0 銀河 (古い星が多く黄色い)
    [1.00, 0.92, 0.80],   // 1 球状星団
    [0.82, 0.89, 1.00],   // 2 散開星団 (若い星が多く青い)
    [0.62, 1.00, 0.90],   // 3 惑星状星雲 (酸素の輝線)
    [1.00, 0.62, 0.62],   // 4 散光星雲 (水素の輝線)
    [0.90, 0.74, 0.86],   // 5 超新星残骸
    [0.92, 0.94, 1.00],   // 6 その他
  ];
  let dsoOn = localStorage.getItem("ssDso") !== "0";   // 既定 ON
  let dsoW = null;                // ワールド単位方向 [wx,wy,wz] × 天体
  let dsoArr = null, dsoVB = null;
  const DSO_STRIDE = 8;           // aPos(3) + aQuad(2) + aCol(3)

  function dsoInit() {
    if (dsoW) return;
    dsoW = new Float32Array(DSO.length * 3);
    const ce = Math.cos(ECL), se = Math.sin(ECL);
    for (let i = 0; i < DSO.length; i++) {
      const ra = DSO[i][1] * DEG, dec = DSO[i][2] * DEG;
      const cd = Math.cos(dec);
      const xq = cd * Math.cos(ra), yq = cd * Math.sin(ra), zq = Math.sin(dec);
      const ye = yq * ce + zq * se, ze = -yq * se + zq * ce;   // 赤道 → 黄道
      dsoW[i*3] = xq; dsoW[i*3+1] = ze; dsoW[i*3+2] = -ye;     // → ワールド
    }
    dsoArr = new Float32Array(DSO.length * 6 * DSO_STRIDE);
  }

  // 板1枚を書き込む。cx,cy,cz = 中心 (ワールド)、rx/ry = 画面右・上の
  // ワールド方向、ax/bx = 長半径・短半径 [ワールド]、pa = 位置角 [rad]
  let dsoN = 0;
  const _p = [0, 0, 0, 1, 1, 1];
  function dsoQuad(cx, cy, cz, R, U, a, b, pa, r, g, bl) {
    const ca = Math.cos(pa), sa = Math.sin(pa);
    // 長軸は「画面上で pa だけ回した向き」。天球の北を厳密に取らなくても、
    // 淡いしみの傾きなので画面基準で十分
    const ux = R[0]*ca + U[0]*sa, uy = R[1]*ca + U[1]*sa, uz = R[2]*ca + U[2]*sa;
    const vx = -R[0]*sa + U[0]*ca, vy = -R[1]*sa + U[1]*ca, vz = -R[2]*sa + U[2]*ca;
    const o = dsoN * 6 * DSO_STRIDE;
    const Q = [-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1];
    for (let k = 0; k < 6; k++) {
      const qx = Q[k*2], qy = Q[k*2+1], p = o + k * DSO_STRIDE;
      dsoArr[p]   = cx + ux * a * qx + vx * b * qy;
      dsoArr[p+1] = cy + uy * a * qx + vy * b * qy;
      dsoArr[p+2] = cz + uz * a * qx + vz * b * qy;
      dsoArr[p+3] = qx; dsoArr[p+4] = qy;
      dsoArr[p+5] = r; dsoArr[p+6] = g; dsoArr[p+7] = bl;
    }
    dsoN++;
  }

  // vis = 空の暗さ (starVis)。ext を渡すと大気減光を掛ける (地上ビュー)。
  // toDome(i, out) は天体 i をこのビューの座標へ置く関数で、地平線より下など
  // 描かないものは false を返す。halfFovPx = 画角の半分に対する画面の半分の
  // 画素数 (最小の大きさを決めるのに使う)
  function drawDso(vp32, R, U, radius, vis, halfFov, halfH, toDome) {
    if (!dsoOn || vis <= 0.04) return;
    dsoInit();
    dsoN = 0;
    for (let i = 0; i < DSO.length; i++) {
      const d = DSO[i];
      // out[0..2] = このビューでの位置、out[3..5] = 大気減光の透過率。
      // 呼ぶ前に必ず 1 へ戻す (大気の無いビューは触らない)
      _p[3] = _p[4] = _p[5] = 1;
      if (!toDome(i, _p)) continue;
      const maj = d[4], mnr = d[5] || d[4];
      // 面輝度 → 中心の明るさ。等級は 6等を基準に取る
      let amp = DSO_AMP * Math.pow(10, -0.4 * (d[3] - 6)) / Math.max(maj * mnr, 0.25);
      if (d[7] === 2) amp *= DSO_OCL;
      // 半径 [rad] → 天球上の長さ。小さすぎるものは画面で見える大きさまで
      // 広げ、そのぶん暗くして光の量を保つ
      let ar = radius * Math.tan(maj / 120 * DEG), br = radius * Math.tan(mnr / 120 * DEG);
      const minR = radius * halfFov * (DSO_MIN_PX / halfH);
      if (ar < minR) { amp *= (ar * br) / (minR * minR); ar = minR; br = minR; }
      const c = DSO_COL[d[7]] || DSO_COL[6];
      const k = Math.min(DSO_MAX, amp) * vis;
      const pa = d[6] >= 0 ? d[6] * DEG : 0;
      dsoQuad(_p[0], _p[1], _p[2], R, U, ar, br, pa,
              c[0] * k * _p[3], c[1] * k * _p[4], c[2] * k * _p[5]);
    }
    if (!dsoN) return;
    if (!dsoVB) dsoVB = gl.createBuffer();
    gl.useProgram(dsoP.pr);
    gl.uniformMatrix4fv(dsoP.u.uVP, false, vp32);
    gl.bindBuffer(gl.ARRAY_BUFFER, dsoVB);
    gl.bufferData(gl.ARRAY_BUFFER, dsoArr, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(dsoP.a.aPos);
    gl.enableVertexAttribArray(dsoP.a.aQuad);
    gl.enableVertexAttribArray(dsoP.a.aCol);
    const S = DSO_STRIDE * 4;
    gl.vertexAttribPointer(dsoP.a.aPos, 3, gl.FLOAT, false, S, 0);
    gl.vertexAttribPointer(dsoP.a.aQuad, 2, gl.FLOAT, false, S, 12);
    gl.vertexAttribPointer(dsoP.a.aCol, 3, gl.FLOAT, false, S, 20);
    gl.drawArrays(gl.TRIANGLES, 0, dsoN * 6);
  }
  // 宇宙ビューでの位置 (drawDso のコールバック)。恒星と同じ天球へ置くだけで、
  // 真空なので大気差も減光も無い
  function spaceDsoAt(i, out) {
    out[0] = dsoW[i*3] * DSO_R; out[1] = dsoW[i*3+1] * DSO_R; out[2] = dsoW[i*3+2] * DSO_R;
    return true;
  }
  // 名前を出すかどうか。淡くて小さいものまで全部出すと画面が名前で埋まる
  function dsoLabelled(i, halfFov) {
    const d = DSO[i];
    return d[3] <= 8.5 && d[4] / 60 * DEG > halfFov * 0.02;
  }
  const dsoName = (i) => (lang === "ja" && DSO[i][8]) ? DSO[i][8]
    : DSO[i][0] ? "M" + DSO[i][0] : DSO[i][9];
