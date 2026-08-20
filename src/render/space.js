  // 太陽のグレアの角度の下限 (視半径。太陽そのものは 1au で 0.27°)
  const GLARE_TAN = Math.tan(9.0 * Math.PI / 180);

  function hitTestGround(px, py) {
    let best = null, bd = 30 * 30;
    for (const v of groundVis) {
      const s = projGround([v.px, v.py, v.pz]);
      if (!s) continue;
      const dx = s.x - px, dy = s.y - py, d = dx*dx + dy*dy;
      if (d < bd) { bd = d; best = v.b; }
    }
    return best;
  }

  // 探査機を描くか。カメラが寄っている最中だけ出さない (探査機視点でも、カメラは
  // 機体の後方にあるので機体は描く)
  const probeVisible = (pr) =>
    pr.live && (!tourProbes || tourProbes.indexOf(pr.key) >= 0) && !tourProbeHold;

  function render(nowSec) {
    if (groundView) { renderGround(nowSec); return; }
    // --- カメラ (注視点 = focus + パンの平行移動分) ---
    const fx = cam.focus[0] + cam.panOff[0],
          fy = cam.focus[1] + cam.panOff[1],
          fz = cam.focus[2] + cam.panOff[2];
    const eye = [
      fx + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw),
      fy + cam.dist * Math.sin(cam.pitch),
      fz + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
    ];
    cam.pos = eye;
    EYE = eye;
    // 天体が極小のためニア面もカメラ距離に追従させる (フォボス等の微小衛星まで対応)
    const near = Math.min(Math.max(cam.dist * 0.02, 2e-7), 5);
    const P = mPersp(eFov(), W / H, near, 6000, SCR.P);
    // カメラ相対座標で描画 (大きな平行移動を f32 行列に載せない)
    SCR.tgt[0] = fx - eye[0];
    SCR.tgt[1] = fy - eye[1];
    SCR.tgt[2] = fz - eye[2];
    mLookAt(ZERO3, SCR.tgt, UP3, Vm);
    mMul(P, Vm, VP);
    // 軌道線アンカー: カメラが離れすぎると頂点の f32 誤差が画面に出るため焼き直す
    {
      const dx = eye[0] - ORB_ANCHOR[0], dy = eye[1] - ORB_ANCHOR[1], dz = eye[2] - ORB_ANCHOR[2];
      const lim = cam.dist * 1000;
      if (dx * dx + dy * dy + dz * dz > lim * lim) {
        rebuildOrbits(fx, fy, fz);
      }
    }

    skyDayF = 0;   // 宇宙ビューに明るい空は無い (Bloom のしきい値を戻す)
    gl.clearColor(0.016, 0.023, 0.055, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // --- 星空 (カメラ位置中心, 深度書き込みなし) ---
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pointP.pr);
    // 星空はカメラ中心の球 = カメラ相対座標そのもの
    gl.uniformMatrix4fv(pointP.u.uVP, false, VP);
    gl.uniform1f(pointP.u.uScale, DPR);
    gl.uniform1f(pointP.u.uAlpha, 0.9);
    gl.bindBuffer(gl.ARRAY_BUFFER, starVB);
    gl.enableVertexAttribArray(pointP.a.aPos);
    gl.enableVertexAttribArray(pointP.a.aSize);
    gl.enableVertexAttribArray(pointP.a.aCol);
    gl.vertexAttribPointer(pointP.a.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(pointP.a.aSize, 1, gl.FLOAT, false, 28, 12);
    gl.vertexAttribPointer(pointP.a.aCol, 3, gl.FLOAT, false, 28, 16);
    gl.drawArrays(gl.POINTS, 0, N_STAR);

    // --- 星座線 + 黄道 (背景の天球上。恒星と同じ固定ワールド座標) ---
    if (showConst && constN) {
      gl.useProgram(lineP.pr);
      gl.uniformMatrix4fv(lineP.u.uVP, false, VP);
      gl.enableVertexAttribArray(lineP.a.aPos);
      gl.uniform4f(lineP.u.uColor, 0.17, 0.23, 0.36, 0.5);
      gl.bindBuffer(gl.ARRAY_BUFFER, constVB);
      gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, constN);
      // 黄道 (金色の閉ループ)
      gl.uniform4f(lineP.u.uColor, 0.42, 0.33, 0.13, 0.6);
      gl.bindBuffer(gl.ARRAY_BUFFER, eclVB);
      gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINE_LOOP, 0, ECL_N);
    }

    // --- 天球の経緯線 (赤道座標。星座線とは別の切替) ---
    if (showGrid && gridN) {
      gl.useProgram(lineP.pr);
      gl.uniformMatrix4fv(lineP.u.uVP, false, VP);
      gl.enableVertexAttribArray(lineP.a.aPos);
      gl.uniform4f(lineP.u.uColor, 0.10, 0.19, 0.21, 0.42);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridVB);
      gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, gridN);
    }

    // --- 軌道線 (天体ごとの表示フラグ) ---
    {
      gl.useProgram(lineP.pr);
      // 中心天体は現在位置 ± 粗い8分割ぶんを高精細パッチで引き直すため、
      // 粗い折れ線側はその区間をスキップする (二重線防止)。解除後も lastCenter を
      // 対象にして、離心軌道 (ハレー彗星等) で天体が軌道からずれないようにする。
      const centerB = selected || lastCenter;
      const selP = centerB && !centerB.parent && centerB !== SUN && centerB.showOrbit ? centerB : null;
      let selI0 = 0, selI1 = 0;
      if (selP) {
        const idx = keplerE(selP, simDays) / (2 * Math.PI / selP.orbN);
        selI0 = Math.floor(idx) - 8;
        selI1 = Math.ceil(idx) + 8;
      }
      // アンカー相対の頂点 → カメラ相対へ (平行移動は f64 で計算してから f32 行列に)
      SCR.t[0] = ORB_ANCHOR[0] - eye[0];
      SCR.t[1] = ORB_ANCHOR[1] - eye[1];
      SCR.t[2] = ORB_ANCHOR[2] - eye[2];
      mTRS(SCR.t, null, 1, SCR.A);
      gl.uniformMatrix4fv(lineP.u.uVP, false, mMul(VP, SCR.A, SCR.mvp));
      PLANETS.forEach((p, pi) => {
        if (!p.showOrbit) return;
        const sel = selected === p;
        gl.uniform4f(lineP.u.uColor, sel ? 0.95 : 0.42, sel ? 0.70 : 0.50, sel ? 0.24 : 0.63, sel ? 0.55 : 0.16);
        gl.bindBuffer(gl.ARRAY_BUFFER, orbitVBs[pi]);
        gl.enableVertexAttribArray(lineP.a.aPos);
        gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
        if (p !== selP) {
          gl.drawArrays(gl.LINE_STRIP, 0, p.orbN + 1);
        } else if (selI0 >= 0 && selI1 <= p.orbN) {
          gl.drawArrays(gl.LINE_STRIP, 0, selI0 + 1);
          gl.drawArrays(gl.LINE_STRIP, selI1, p.orbN - selI1 + 1);
        } else if (selI0 < 0) {
          gl.drawArrays(gl.LINE_STRIP, selI1, selI0 + p.orbN - selI1 + 1);
        } else {
          gl.drawArrays(gl.LINE_STRIP, selI1 - p.orbN, selI0 - (selI1 - p.orbN) + 1);
        }
      });
      // 高精細パッチ (f64 でカメラ相対に計算するため接近しても正確)
      if (selP) {
        const dE = 2 * Math.PI / selP.orbN;
        const m = selP.m, be = selP.a * Math.sqrt(1 - selP.e * selP.e);
        const v = SCR.v, w = SCR.v2;
        for (let i = 0; i <= PATCH_N; i++) {
          const E = (selI0 + (selI1 - selI0) * i / PATCH_N) * dE;
          const xo = selP.a * (Math.cos(E) - selP.e);
          const yo = be * Math.sin(E);
          v[0] = m[0] * xo + m[1] * yo;
          v[1] = m[2] * xo + m[3] * yo;
          v[2] = m[4] * xo + m[5] * yo;
          toWorld(v, w);
          patchArr[i*3] = w[0] - eye[0]; patchArr[i*3+1] = w[1] - eye[1]; patchArr[i*3+2] = w[2] - eye[2];
        }
        gl.uniformMatrix4fv(lineP.u.uVP, false, VP);
        // パッチの色は粗い折れ線と合わせる (選択中は明るく、解除後は淡く)
        const pb = selected === selP;
        gl.uniform4f(lineP.u.uColor, pb ? 0.95 : 0.42, pb ? 0.70 : 0.50, pb ? 0.24 : 0.63, pb ? 0.55 : 0.16);
        gl.bindBuffer(gl.ARRAY_BUFFER, patchVB);
        gl.bufferData(gl.ARRAY_BUFFER, patchArr, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(lineP.a.aPos);
        gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINE_STRIP, 0, PATCH_N + 1);
      }
      // 衛星の軌道 (母天体に追従)
      gl.enableVertexAttribArray(lineP.a.aPos);
      for (const s of SATELLITES) {
        if (!s.showOrbit) continue;
        const par = posW.get(s.parent);
        const sel = selected === s;
        gl.uniform4f(lineP.u.uColor, sel ? 0.95 : 0.42, sel ? 0.70 : 0.50, sel ? 0.24 : 0.63, sel ? 0.55 : 0.16);
        if (s === MOON) {
          // ELP 理論で現在時刻±半周期をサンプリング (実位置と一致する軌道線)
          const tmp = SCR.v2, T = 27.321661;
          for (let i = 0; i <= MOON_ORB_N; i++) {
            moonGeoEclKm(simDays + (i / MOON_ORB_N - 0.5) * T, tmp);
            moonOrbBuf[i*3] = tmp[0] * KM2W; moonOrbBuf[i*3+1] = tmp[2] * KM2W; moonOrbBuf[i*3+2] = -tmp[1] * KM2W;
          }
          if (!moonOrbVB) moonOrbVB = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, moonOrbVB);
          gl.bufferData(gl.ARRAY_BUFFER, moonOrbBuf, gl.DYNAMIC_DRAW);
          SCR.t[0] = par[0] - eye[0]; SCR.t[1] = par[1] - eye[1]; SCR.t[2] = par[2] - eye[2];
          mTRS(SCR.t, null, 1, SCR.model);
          gl.uniformMatrix4fv(lineP.u.uVP, false, mMul(VP, SCR.model, SCR.mvp));
          gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.LINE_STRIP, 0, MOON_ORB_N + 1);
        } else {
          gl.bindBuffer(gl.ARRAY_BUFFER, satOrbVB);
          SCR.t[0] = par[0] - eye[0]; SCR.t[1] = par[1] - eye[1]; SCR.t[2] = par[2] - eye[2];
          mTRS(SCR.t, s.M, s.aKm * KM2W, SCR.model);
          gl.uniformMatrix4fv(lineP.u.uVP, false, mMul(VP, SCR.model, SCR.mvp));
          gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.LINE_STRIP, 0, SAT_ORB_N + 1);
        }
      }
    }

    // --- 小惑星帯 ---
    {
      for (let i = 0; i < N_AST; i++) {
        const A = asts[i];
        const th = A.th + 2 * Math.PI * simDays / A.T;
        const r = mapRadius(A.a);
        const x = r * Math.cos(th), z = -r * Math.sin(th);
        const y = r * Math.sin(A.inc) * Math.sin(th + A.node);
        const o = i * 7;
        // カメラ相対 (毎フレーム f64 で再計算しているので引き算はここで済ませる)
        astArr[o] = x - eye[0]; astArr[o+1] = y - eye[1]; astArr[o+2] = z - eye[2];
        astArr[o+3] = 1.4;
        astArr[o+4] = 0.62; astArr[o+5] = 0.65; astArr[o+6] = 0.72;
      }
      gl.useProgram(pointP.pr);
      gl.uniformMatrix4fv(pointP.u.uVP, false, VP);
      gl.uniform1f(pointP.u.uScale, DPR);
      gl.uniform1f(pointP.u.uAlpha, 0.5);
      gl.bindBuffer(gl.ARRAY_BUFFER, astVB);
      gl.bufferData(gl.ARRAY_BUFFER, astArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pointP.a.aPos);
      gl.enableVertexAttribArray(pointP.a.aSize);
      gl.enableVertexAttribArray(pointP.a.aCol);
      gl.vertexAttribPointer(pointP.a.aPos, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(pointP.a.aSize, 1, gl.FLOAT, false, 28, 12);
      gl.vertexAttribPointer(pointP.a.aCol, 3, gl.FLOAT, false, 28, 16);
      gl.drawArrays(gl.POINTS, 0, N_AST);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // --- 天体 ---
    // 座標はカメラ相対なので、カメラは原点・太陽の位置は -eye になる。
    // 光源はワールドの原点にある太陽1つなので全天体で同じ値を渡す
    bodyRenderer.beginPass({ time: nowSec, cameraPosition: ZERO3, depthTest: true, depthWrite: true });
    SCR.sun[0] = -eye[0]; SCR.sun[1] = -eye[1]; SCR.sun[2] = -eye[2];
    drawBody(SUN, SCR.sun);
    for (const p of PLANETS) drawBody(p, SCR.sun);
    for (const s of SATELLITES) drawBody(s, SCR.sun);
    // 大気は加算で重ねるので、本体をすべて描き終えてから最後に足す
    for (const p of PLANETS) if (p.air) drawBodyAtmos(p, SCR.sun);
    bodyRenderer.endPass();

    // --- 探査機の軌跡 ---
    // 頂点は絶対ワールド座標なので、カメラ相対にするため -eye だけ平行移動する
    if (tourPath) {
      gl.useProgram(lineP.pr);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.enableVertexAttribArray(lineP.a.aPos);
      SCR.t[0] = -eye[0]; SCR.t[1] = -eye[1]; SCR.t[2] = -eye[2];
      mTRS(SCR.t, null, 1, SCR.model);
      gl.uniformMatrix4fv(lineP.u.uVP, false, mMul(VP, SCR.model, SCR.mvp));
      for (const pr of PROBES) {
        if (tourProbes && tourProbes.indexOf(pr.key) < 0) continue;
        if (!pr.pathVB) {
          pr.pathVB = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, pr.pathVB);
          gl.bufferData(gl.ARRAY_BUFFER, pr.path, gl.STATIC_DRAW);
        } else {
          gl.bindBuffer(gl.ARRAY_BUFFER, pr.pathVB);
        }
        gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
        // 通過済みの区間だけを引く (これから通る先は「まだ無い道」なので描かない)
        const n = pr.pathT.length;
        let i = 0;
        while (i < n - 1 && pr.pathT[i + 1] <= simDays) i++;
        if (i > 0) {
          gl.uniform4f(lineP.u.uColor, 0.95, 0.70, 0.30, 0.90);
          gl.drawArrays(gl.LINE_STRIP, 0, i + 1);
        }
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // --- 探査機 (NASA のモデル) ---
    // 実寸比だと 3m の機体は常に不可視なので、画面上の見かけの大きさを固定した
    // 記号として描く。位置と日時は正確、大きさだけが実寸比から外れる
    // (探査機視点のステップでは、乗っている機体自体はカメラ位置なので描かない)
    // PROBE_NEAR より遠ざかったら、画面上の大きさを固定するのをやめてワールド
    // サイズ固定に切り替える。引きの画で機体が惑星より大きく描かれるのを防ぐ。
    // 3px を切ったらメッシュはやめ、下のマーカーの節で点として描く
    {
      const mfpx = (H / 2) / Math.tan(eFov() / 2);
      const near = PROBE_NEAR * KM2W;
      let any = false;
      for (const pr of PROBES) {
        pr.px = 0;
        if (!probeVisible(pr) || tourProbeDot) continue;   // dot の回は下の点で描く
        const t = posW.get(pr.key);
        const dx = t[0] - eye[0], dy = t[1] - eye[1], dz = t[2] - eye[2];
        // camZoom を掛けるので見かけの角度が一定になる = 拡大すれば大きく見える
        // 探査機視点で乗っている機体だけ、近づくほど大きく描く (tourRideMag)
        const rideMag = tourRide && pr.key === tourRideOn ? tourRideMag : 1;
        const px = PROBE_PX * camZoom * rideMag *
                   Math.min(1, near / (Math.hypot(dx, dy, dz) || 1));
        if (px < 3) continue;
        pr.px = px;
        any = true;
      }
      if (any) {
        gl.useProgram(meshP.pr);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enableVertexAttribArray(meshP.a.aPos);
        gl.uniform1f(meshP.u.uFlat, hasDeriv ? 1 : 0);
        for (const pr of PROBES) {
          if (!pr.px) continue;
          const me = meshByKey.get(pr.mesh);
          if (!me) continue;
          const t = posW.get(pr.key);
          SCR.t[0] = t[0] - eye[0]; SCR.t[1] = t[1] - eye[1]; SCR.t[2] = t[2] - eye[2];
          const d = Math.hypot(SCR.t[0], SCR.t[1], SCR.t[2]) || 1;
          const r = d * pr.px / mfpx;
          mRotY(probeSpin + pr.ph0, SCR.ry);      // ゆっくり回して立体だと分かるように
          mTRS(SCR.t, SCR.ry, r, SCR.model);
          gl.uniformMatrix4fv(meshP.u.uMVP, false, mMul(VP, SCR.model, SCR.mvp));
          gl.uniformMatrix4fv(meshP.u.uModel, false, SCR.model);
          gl.uniform3f(meshP.u.uSun, -eye[0], -eye[1], -eye[2]);
          // 塗り分け (無ければ全体を col 一色)
          const pt = pr.paint;
          gl.uniform3fv(meshP.u.uCol, pt ? pt.c0 : pr.col);
          gl.uniform3fv(meshP.u.uC1, pt ? pt.c1 : pr.col);
          gl.uniform3fv(meshP.u.uC2, pt ? pt.c2 : pr.col);
          gl.uniform3fv(meshP.u.uAxis, pt ? pt.axis : ZERO3);
          gl.uniform2f(meshP.u.uCut, pt ? pt.cut[0] : 9, pt ? pt.cut[1] : 9);
          gl.bindBuffer(gl.ARRAY_BUFFER, me.vb);
          gl.vertexAttribPointer(meshP.a.aPos, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, me.ib);
          gl.drawElements(gl.TRIANGLES, me.n, gl.UNSIGNED_SHORT, 0);
        }
      }
    }

    // --- 自転軸 (各天体の軌道表示に連動。深度テストで天体の裏側は隠れる) ---
    if (ALL_BODIES.some((b) => b.showOrbit)) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(lineP.pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, axisVB);
      gl.enableVertexAttribArray(lineP.a.aPos);
      gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      for (const b of [SUN, ...PLANETS, ...SATELLITES]) {
        if (!b.showOrbit) continue;
        const t = posW.get(b.key);
        SCR.t[0] = t[0] - eye[0]; SCR.t[1] = t[1] - eye[1]; SCR.t[2] = t[2] - eye[2];
        mRotX(-(b.tilt || 0) * DEG, SCR.rx);
        mTRS(SCR.t, SCR.rx, bodyR(b), SCR.model);
        gl.uniformMatrix4fv(lineP.u.uVP, false, mMul(VP, SCR.model, SCR.mvp));
        const sel = selected === b;
        gl.uniform4f(lineP.u.uColor, sel ? 0.95 : 0.55, sel ? 0.70 : 0.65, sel ? 0.24 : 0.85, sel ? 0.6 : 0.35);
        gl.drawArrays(gl.LINES, 0, 2);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }


    // --- スクリーン座標 & マーカー ---
    screenPos.clear();
    const fpx = (H / 2) / Math.tan(eFov() / 2);
    let nMark = 0;
    const marked = [SUN, ...PLANETS, ...SATELLITES, ...PROBES.filter(probeVisible)];
    const INSIDE_TEST = [SUN, ...PLANETS, ...SATELLITES];
    for (const b of marked) {
      const pr = project(posW.get(b.key));
      if (!pr) continue;
      // 扁平な天体は赤道がいちばん外側なので、印やリングはそちらに合わせる
      const rpx = bodyR(b) * (b.obl ? b.obl[0] : 1) * fpx / pr.w;
      screenPos.set(b.key, { x: pr.x, y: pr.y, r: rpx, w: pr.w });
    }
    // 天体の中に入った探査機 (最後の突入・着地) は、印も名前も出さない。
    // 球に隠れて機体は見えないのに名前だけが浮いて残るため
    for (const pr of PROBES) {
      const sp = screenPos.get(pr.key);
      if (!sp) continue;
      const w = posW.get(pr.key);
      for (const b of INSIDE_TEST) {
        const c = posW.get(b.key), r = bodyR(b);
        const dx = w[0] - c[0], dy = w[1] - c[1], dz = w[2] - c[2];
        if (dx * dx + dy * dy + dz * dz < r * r) { sp.hidden = true; break; }
      }
    }
    // 手前の大きな天体の円盤に隠れる位置にあるものは、印も名前も出さない
    // (接近して見せる場面で、遠くの惑星の名前が円盤の上に載ってしまうため)
    for (const b of marked) {
      const sp = screenPos.get(b.key);
      if (!sp) continue;
      for (const f of marked) {
        if (f === b) continue;
        const fp = screenPos.get(f.key);
        if (!fp || fp.r < 3 || fp.w >= sp.w) continue;
        if (Math.hypot(sp.x - fp.x, sp.y - fp.y) < fp.r) { sp.hidden = true; break; }
      }
    }
    for (const b of marked) {
      const pr = screenPos.get(b.key);
      if (!pr || pr.hidden) continue;
      const rpx = pr.r;
      if (b.mesh && b.px) continue;   // メッシュで描いた探査機にマーカーは要らない
      if (rpx < 2.2) {
        // 衛星は画面上で母天体と重なっている間はマーカーを出さない
        if (b.parent) {
          const pp = screenPos.get(b.parent);
          if (!pp || Math.hypot(pr.x - pp.x, pr.y - pp.y) < 14) continue;
        }
        const o = nMark * 7;
        const wp = posW.get(b.key);
        const c = b.colA || b.col;      // 探査機は colA を持たない (col が機体色)
        markArr[o] = wp[0] - eye[0]; markArr[o+1] = wp[1] - eye[1]; markArr[o+2] = wp[2] - eye[2];
        markArr[o+3] = b.mesh ? 5.0 : 4.0;
        markArr[o+4] = c[0]; markArr[o+5] = c[1]; markArr[o+6] = c[2];
        nMark++;
      }
    }
    if (nMark) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(pointP.pr);
      gl.uniformMatrix4fv(pointP.u.uVP, false, VP);
      gl.uniform1f(pointP.u.uScale, DPR);
      gl.uniform1f(pointP.u.uAlpha, 0.95);
      gl.bindBuffer(gl.ARRAY_BUFFER, markVB);
      gl.bufferData(gl.ARRAY_BUFFER, markArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pointP.a.aPos);
      gl.enableVertexAttribArray(pointP.a.aSize);
      gl.enableVertexAttribArray(pointP.a.aCol);
      gl.vertexAttribPointer(pointP.a.aPos, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(pointP.a.aSize, 1, gl.FLOAT, false, 28, 12);
      gl.vertexAttribPointer(pointP.a.aCol, 3, gl.FLOAT, false, 28, 16);
      gl.drawArrays(gl.POINTS, 0, nMark);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // --- 土星の環 ---
    {
      const sat = PLANETS[5];
      const r = bodyR(sat);
      const sp = posW.get(sat.key);
      SCR.t[0] = sp[0] - eye[0]; SCR.t[1] = sp[1] - eye[1]; SCR.t[2] = sp[2] - eye[2];
      const model = mTRS(SCR.t, SAT_ROT, r, SCR.model);   // 実際の極方向で環を配置
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(ringP.pr);
      gl.uniformMatrix4fv(ringP.u.uMVP, false, mMul(VP, model, SCR.mvp));
      gl.uniformMatrix4fv(ringP.u.uModel, false, model);
      gl.uniform3f(ringP.u.uAxis, SATURN_POLE_W[0], SATURN_POLE_W[1], SATURN_POLE_W[2]);
      gl.uniform3f(ringP.u.uSun, -eye[0], -eye[1], -eye[2]);
      gl.uniform3f(ringP.u.uCam, 0.0, 0.0, 0.0);            // カメラ相対座標なので原点
      gl.uniform3f(ringP.u.uCenter, SCR.t[0], SCR.t[1], SCR.t[2]);
      gl.uniform2f(ringP.u.uRadii, sat.rEq * KM2W, sat.rPol * KM2W);
      gl.uniform2f(ringP.u.uRingR, RING_IN, 1.0 / (RING_OUT - RING_IN));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ringTex);
      gl.uniform1i(ringP.u.uProfile, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, ringVB);
      gl.enableVertexAttribArray(ringP.a.aPos);
      gl.enableVertexAttribArray(ringP.a.aR);
      gl.vertexAttribPointer(ringP.a.aPos, 3, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(ringP.a.aR, 1, gl.FLOAT, false, 16, 12);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (RING_SEG + 1) * 2);
    }

    // --- 太陽コロナ (加算) ---
    {
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(billP.pr);
      gl.uniformMatrix4fv(billP.u.uVP, false, VP);
      gl.uniform3f(billP.u.uCenter, -eye[0], -eye[1], -eye[2]);   // 太陽 (カメラ相対)
      gl.uniform3f(billP.u.uRight, Vm[0], Vm[4], Vm[8]);
      gl.uniform3f(billP.u.uUp, Vm[1], Vm[5], Vm[9]);
      gl.bindBuffer(gl.ARRAY_BUFFER, billVB);
      gl.enableVertexAttribArray(billP.a.aCorner);
      gl.vertexAttribPointer(billP.a.aCorner, 2, gl.FLOAT, false, 0, 0);
      // 本物のコロナ。太陽半径基準なので、離れれば太陽と同じ割合で小さくなる
      gl.uniform1f(billP.u.uFall, 2.4);
      gl.uniform1f(billP.u.uSize, bodyR(SUN) * 5.5);
      gl.uniform3f(billP.u.uCol1, 1.0, 0.45, 0.1);
      gl.uniform3f(billP.u.uCol2, 1.0, 0.85, 0.5);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 眩しさ (グレア)。Bloom を入れているときだけ足す。
      //
      // Bloom はトーンマップ済みの画面を取り込むので、太陽の円盤は「日向の雲」と
      // 同じ 1.0 に潰れている。実際の太陽は雲より 5桁ほど明るいのに、その差は
      // 取り込む時点で失われていて、Bloom だけでは太陽を特別扱いできない。
      // グレアの広がりは光源の見かけの大きさでは決まらないので、円盤とは別に
      // 角度で足し戻す。ただし「距離によらない」ではない — 決めているのは
      // 受ける光の量で、これは距離の2乗で落ちる。裾が r^-4 で落ちるとすると
      // 見える半径は照度の 1/4 乗、つまり距離の -1/2 乗になる。
      // 距離で絞らないと、太陽系全体を引きで見たときに 9° の塊が内惑星を軌道
      // ごと飲み込んでしまう (海王星軌道の外から見ても木星軌道まで真っ白)。
      // (Bloom = カメラ・目のグレアの模擬なので、切っているときは素の絵に戻す)
      if (bloomOn) {
        const dSun = Math.hypot(eye[0], eye[1], eye[2]);
        // 基準は 1 au で 9°。近づく側は 2.5倍 (22°) で頭打ちにする —
        // 光球のすぐ上まで寄れるので、伸ばしきると画面が白一色になる。
        //
        // 最後に camZoom で割る。グレアはレンズや目の中の散乱なので、決まるのは
        // 画面上の広がりであって空の角度ではない。望遠にしても滲みは同じ大きさの
        // まま、覆う角度のほうが狭くなる。角度を固定にすると拡大するほど画面上で
        // 大きくなり、実寸 0.06° の太陽が画面の半分を覆う塊に見えていた
        const glareTan = GLARE_TAN / camZoom *
          Math.min(2.5, Math.sqrt(K_REAL / Math.max(dSun, K_REAL * 0.16)));
        // 板は太陽の中心に置かれるので、深度テストで太陽自身の円盤に芯を
        // 削られてしまう (コロナが輪にしか見えないのはこのため)。グレアは
        // 円盤の上にも乗ってほしいので、表面のすぐ手前へ出す。深度テストは
        // 効いたままなので、太陽が惑星の裏に回れば正しく消える
        const k = Math.max(0.02, (dSun - bodyR(SUN) * 1.02) / (dSun || 1));
        gl.uniform3f(billP.u.uCenter, -eye[0] * k, -eye[1] * k, -eye[2] * k);
        // 広く薄い裾。落ち方を緩くして画面の広い範囲まで届かせ、周りの星を
        // 飲み込ませる。「そちらを見ていられない」感じはこの裾が作る
        gl.uniform1f(billP.u.uFall, 1.6);
        gl.uniform1f(billP.u.uSize, Math.max(bodyR(SUN) * 5.5, dSun * glareTan) * k);
        gl.uniform3f(billP.u.uCol1, 0.55, 0.32, 0.12);
        gl.uniform3f(billP.u.uCol2, 1.00, 0.86, 0.66);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // 白熱した芯。Bloom のしきい値 (0.72) を大きく超えさせて滲ませる。
        // 太陽の色ではなく白に寄せる — 眩しさは色が飛ぶことで伝わる。
        //
        // 落ち方を平らにしない (以前 0.6 にしていた)。加算で 1.0 に張り付いた
        // 領域が広がると、その縁が輪郭として読めてしまい、眩しさではなく
        // 「太陽が大きくなった」に見える。飛ぶ範囲は狭く、外へは滑らかに
        gl.uniform1f(billP.u.uFall, 1.5);
        gl.uniform1f(billP.u.uSize, Math.max(bodyR(SUN) * 2.4, dSun * glareTan * 0.09) * k);
        gl.uniform3f(billP.u.uCol1, 1.0, 0.80, 0.45);
        gl.uniform3f(billP.u.uCol2, 1.0, 1.0, 1.0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    // --- 彗星の尾・コマ (太陽接近時のみ, 加算) ---
    // 直前の太陽コロナが blendFunc を ONE,ONE にしたままなので明示的に指定し直す。
    // コマ・尾のシェーダは alpha=0 を出すので現状は両者の結果が一致するが、
    // 状態を引き継いだままにすると地上ビュー (ONE,ONE_MINUS_SRC_ALPHA) と
    // 食い違ったまま気づけない
    {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (const c of COMETS) {
        const act = cometAct(c);
        if (act < 0.02) continue;
        const w = posW.get(c.key);
        // 反太陽方向 (イオンテイルの軸)
        const wl = Math.hypot(w[0], w[1], w[2]) || 1;
        const ax = w[0] / wl, ay = w[1] / wl, az = w[2] / wl;
        // 軌道速度方向 (ダストテイルの湾曲用)
        keplerAU(c, simDays + 2, SCR.v);
        toWorld(SCR.v, SCR.v2);
        let vx = SCR.v2[0] - w[0], vy = SCR.v2[1] - w[1], vz = SCR.v2[2] - w[2];
        const vl = Math.hypot(vx, vy, vz) || 1;
        vx /= vl; vy /= vl; vz /= vl;
        drawCometFX(c, act, VP, nowSec, w[0] - eye[0], w[1] - eye[1], w[2] - eye[2],
                    ax, ay, az, vx, vy, vz, fpx, Vm[0], Vm[4], Vm[8], 1);
      }

      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    drawOverlay();
  }

