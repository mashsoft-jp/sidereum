  // ---------- 天の川 ----------
  // 拡散光だけの全天マップ (NASA SVS Deep Star Maps 2020 の milkyway 版) を
  // 天球へ貼る。明るい恒星 (ヒッパルコス・ティコ) は元データから抜いてあるので、
  // こちらが点で描いている輝星カタログと二重像にならない。
  //
  // 地図は赤道座標の正距円筒。恒星カタログと同じく J2000 のまま扱い、描画
  // フレーム (宇宙 = ワールド / 地上 = [東, 天頂, −北]) の方向を赤道へ回して uv を引く。
  const MW_R = 1938;                       // 宇宙ビューの天球半径 (恒星の 1900 の外側)
  const MW_ECL = 23.4393 * DEG;            // 黄道傾斜 (sky.js の恒星と同じ値)
  const MW_CE = Math.cos(MW_ECL), MW_SE = Math.sin(MW_ECL);
  const _mwEq = new Float32Array(9);       // 列 = 描画フレームの基底を赤道で見たもの
  // 明るさ。元データは実測の輝度なので、そのまま出すと長時間露光の写真になる。
  // 肉眼で見た天の川は「星座線が透けて見える淡い光の帯」なので、そこまで落とす。
  // 宇宙ビューは大気の減光が無いぶん少しだけ強め
  const MW_SPACE_BRIGHT = 0.42, MW_GROUND_BRIGHT = 0.33;

  // ワールドの方向 → 赤道座標。sky.js が恒星に掛けている変換
  // (赤道 → 黄道 → ワールド[x, z, −y]) をそのまま逆に辿る
  function mwEqOfWorld(x, y, z, o) {
    _mwEq[o]     = x;
    _mwEq[o + 1] = -z * MW_CE - y * MW_SE;
    _mwEq[o + 2] = -z * MW_SE + y * MW_CE;
  }
  function mwEqSpace() {                   // 宇宙ビュー: 描画フレーム = ワールド
    mwEqOfWorld(1, 0, 0, 0);
    mwEqOfWorld(0, 1, 0, 3);
    mwEqOfWorld(0, 0, 1, 6);
    return _mwEq;
  }
  function mwEqGround() {                  // 地上・月面ビュー: [東, 天頂, −北]
    mwEqOfWorld(obsE[0], obsE[1], obsE[2], 0);
    mwEqOfWorld(obsU[0], obsU[1], obsU[2], 3);
    mwEqOfWorld(-obsN[0], -obsN[1], -obsN[2], 6);
    return _mwEq;
  }

  // 深度もブレンドも呼び出し側の状態をそのまま使う (背景として最初に描く前提)。
  // 視点は必ず球の中心にあるので、視線は球面と1度しか交わらない = カリング不要
  function drawMilkyWay(vp32, eq9, radius, bright) {
    if (bright <= 0.003) return;
    gl.useProgram(skyP.pr);
    gl.uniformMatrix4fv(skyP.u.uVP, false, vp32);
    gl.uniformMatrix3fv(skyP.u.uEq, false, eq9);
    gl.uniform1f(skyP.u.uRadius, radius);
    gl.uniform1f(skyP.u.uBright, bright);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mwTex);
    gl.uniform1i(skyP.u.uTex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVB);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIB);
    gl.enableVertexAttribArray(skyP.a.aPos);
    gl.vertexAttribPointer(skyP.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
  }
