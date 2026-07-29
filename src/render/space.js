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
    gl.useProgram(bodyP.pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVB);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIB);
    gl.enableVertexAttribArray(bodyP.a.aPos);
    gl.vertexAttribPointer(bodyP.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.uniform1f(bodyP.u.uTime, nowSec);
    gl.uniform3f(bodyP.u.uCam, 0, 0, 0);                          // カメラ = 原点 (相対座標)
    gl.uniform3f(bodyP.u.uSun, -eye[0], -eye[1], -eye[2]);        // 太陽のカメラ相対位置
    drawBody(SUN);
    for (const p of PLANETS) drawBody(p);
    for (const s of SATELLITES) drawBody(s);

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
    for (const b of [SUN, ...PLANETS, ...SATELLITES]) {
      const pr = project(posW.get(b.key));
      if (!pr) continue;
      const rpx = bodyR(b) * fpx / pr.w;
      screenPos.set(b.key, { x: pr.x, y: pr.y, r: rpx });
      if (rpx < 2.2) {
        // 衛星は画面上で母天体と重なっている間はマーカーを出さない
        if (b.parent) {
          const pp = screenPos.get(b.parent);
          if (!pp || Math.hypot(pr.x - pp.x, pr.y - pp.y) < 14) continue;
        }
        const o = nMark * 7;
        const wp = posW.get(b.key);
        markArr[o] = wp[0] - eye[0]; markArr[o+1] = wp[1] - eye[1]; markArr[o+2] = wp[2] - eye[2];
        markArr[o+3] = 4.0;
        markArr[o+4] = b.colA[0]; markArr[o+5] = b.colA[1]; markArr[o+6] = b.colA[2];
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
      gl.uniform1f(billP.u.uSize, bodyR(SUN) * 5.5);
      gl.uniform3f(billP.u.uCol1, 1.0, 0.45, 0.1);
      gl.uniform3f(billP.u.uCol2, 1.0, 0.85, 0.5);
      gl.bindBuffer(gl.ARRAY_BUFFER, billVB);
      gl.enableVertexAttribArray(billP.a.aCorner);
      gl.vertexAttribPointer(billP.a.aCorner, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- 彗星の尾・コマ (太陽接近時のみ, 加算) ---
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

