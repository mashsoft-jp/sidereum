  // ---------- 地上ビュー (地球から空を見上げる) ----------
  let groundView = false;
  let gAz = 0, gAlt = 0.45, gFov = 60 * DEG;            // 視線方位・高度 (rad)・画角
  let gAzTgt = 0, gAltTgt = 0.45, gFovTgt = 60 * DEG;   // 目標値 (宇宙ビュー同様に緩和で追従)
  // 高度の上限。真上 (天頂) では視線が天頂ベクトルと平行になり lookAt が破綻するため、
  // 表示上 90° に丸まる僅か手前で止める (宇宙ビューの PITCH_MAX と同趣旨)
  const GALT_MAX = 89.9 * DEG;
  let gTrack = false;   // 選択天体を自動追尾 (高倍率では日周運動で流れるため必須。手動操作で解除)
  let gTrkKey = "", gTrkAz = 0, gTrkAlt = 0;   // 追尾用: 前フレームの天体の方位/高度
  const MAX_FOV = 90 * DEG;
  const GMIN_DEFAULT = 0.003 * DEG;   // 既定の画角下限 ≈11秒角 (×約38,000)
  // 天体別の動的な画角下限: 注目中の天体が画面の約9割を占めるまで拡大できる。
  // 遠く視直径の小さい天体ほど下限が小さくなる (=より高倍率)
  function gMinFov() {
    const b = selected || lastCenter;
    if (!b || b.key === "earth") return GMIN_DEFAULT;
    const c = computeObs(b);
    let angDiam = 2 * Math.asin(Math.min(0.9, b.rkm / (c.distAU * AU_KM)));
    if (b.key === "saturn") angDiam *= 2.5;   // 環の外径まで視野に収める
    return Math.max(2e-9, Math.min(GMIN_DEFAULT, angDiam * 1.1));
  }
  const _fwd = [0, 0, 0], _gp = [0, 0, 0], _sunG = [0, 0, 0];
  const _eclW = [0, 0, 0], _eclG = [0, 0, 0];   // 食: 天体 → 遮蔽体 (ワールド / 地平フレーム)
  // 極小画角 (超高倍率) では f32 行列の量子化で照準・描画が破綻するため、
  // 地上ビューの行列は f64 で合成し、GPU へ渡す直前に f32 化する
  const gVP = mIdent(new Float64Array(16)), gVP32 = new Float32Array(16);
  const gP64 = new Float64Array(16), gV64 = new Float64Array(16), gM64 = new Float64Array(16);
  let groundVB = null, groundPtVB = null, horizonVB = null, horizonN = 0, groundDomeN = 0;
  // 風景表現 (稜線つきドーム + 空ドーム)。showTerrain が OFF なら従来の平坦ドームを使う
  let ridgeVB = { earth: null, moon: null }, ridgeN = 0, skyVB = null, skyN = 0;
  let showTerrain = localStorage.getItem("ssTerrain") === "1";   // 既定 OFF
  let starVis = 1;   // 昼の空での星・星座の可視度 (0=昼で見えない)。オーバーレイ文字にも使う
  // 昼の空の明るさ (0=夜/宇宙, 1=真昼)。Bloom のしきい値を持ち上げるのに使う。
  // 明るい空では目も露出を絞るので、空そのものが滲むのはおかしい
  let skyDayF = 0;
  // 地上ビューに出す天体: 太陽・月・全惑星 (準惑星・小惑星・彗星含む) と全衛星。
  // 地球以外の衛星は、画面上で母惑星から分離できる倍率になったら現れる
  const SKY_BODIES = [SUN, MOON]
    .concat(PLANETS.filter((p) => p.key !== "earth"))
    .concat(SATELLITES.filter((s) => s.key !== "moon"));
  // 月面ビューで見える天体: 太陽 + 惑星 (地球を含む) + 衛星 (観測地である月自身は除く)
  const MOON_SKY_BODIES = [SUN]
    .concat(PLANETS)
    .concat(SATELLITES.filter((s) => s.key !== "moon"));
  const groundPtArr = new Float32Array(Math.max(SKY_BODIES.length, MOON_SKY_BODIES.length) * 7);
  function azAltDir(azDeg, altDeg, out) {
    const a = azDeg * DEG, e = altDeg * DEG, ca = Math.cos(e);
    out[0] = ca * Math.sin(a); out[1] = Math.sin(e); out[2] = -ca * Math.cos(a);
    return out;
  }

  // ---------- 観測者フレーム (地球/月の地表。ワールド空間の東・天頂・北 単位ベクトル) ----------
  // これを介して「宇宙(ワールド)方向 → 地平座標」を統一的に扱う。地球でも月でも同じ描画経路を使える
  let surfaceBody = "earth";              // "earth" | "moon"
  let moonLat = 0, moonLon = 0;           // 月面 (selenographic) 観測地点
  const obsE = [0, 0, 0], obsU = [0, 0, 0], obsN = [0, 0, 0], obsPosW = [0, 0, 0];
  function eqToWorld(xq, yq, zq, out) {   // 赤道単位ベクトル → 黄道 → ワールド
    const ce = Math.cos(ECL), se = Math.sin(ECL);
    const ey = yq * ce + zq * se, ez = -yq * se + zq * ce;
    out[0] = xq; out[1] = ez; out[2] = -ey;
    return out;
  }
  function buildObsFrame() {
    if (surfaceBody === "moon") {
      const mC = posW.get("moon"), eC = posW.get("earth");
      const px = 0, py = 1, pz = 0;       // 月の極 ≈ 黄道北 (潮汐ロック近似, 傾き1.5°は無視)
      let ex = eC[0]-mC[0], ey = eC[1]-mC[1], ez = eC[2]-mC[2];
      const el = Math.hypot(ex, ey, ez) || 1; ex/=el; ey/=el; ez/=el;   // 地球方向 (sub-Earth)
      const dp = ex*px + ey*py + ez*pz;
      let x0x = ex-dp*px, x0y = ey-dp*py, x0z = ez-dp*pz;               // 赤道面へ射影 = 経度0
      const x0l = Math.hypot(x0x, x0y, x0z) || 1; x0x/=x0l; x0y/=x0l; x0z/=x0l;
      const y0x = py*x0z-pz*x0y, y0y = pz*x0x-px*x0z, y0z = px*x0y-py*x0x;  // p × x0 = 経度+90
      const la = moonLat*DEG, lo = moonLon*DEG, cla = Math.cos(la), sla = Math.sin(la), clo = Math.cos(lo), slo = Math.sin(lo);
      const bx = clo*x0x+slo*y0x, by = clo*x0y+slo*y0y, bz = clo*x0z+slo*y0z;
      obsU[0]=cla*bx+sla*px; obsU[1]=cla*by+sla*py; obsU[2]=cla*bz+sla*pz;
      obsN[0]=-sla*bx+cla*px; obsN[1]=-sla*by+cla*py; obsN[2]=-sla*bz+cla*pz;
      obsE[0]=-slo*x0x+clo*y0x; obsE[1]=-slo*x0y+clo*y0y; obsE[2]=-slo*x0z+clo*y0z;
      const rW = 1737.4 * KM2W;
      obsPosW[0]=mC[0]+rW*obsU[0]; obsPosW[1]=mC[1]+rW*obsU[1]; obsPosW[2]=mC[2]+rW*obsU[2];
    } else {
      const eC = posW.get("earth");
      const lst = (gmstDeg(simDays)+obsLon)*DEG, la = obsLat*DEG;
      const cla = Math.cos(la), sla = Math.sin(la), cst = Math.cos(lst), sst = Math.sin(lst);
      eqToWorld(cla*cst, cla*sst, sla, obsU);      // 天頂
      eqToWorld(-sla*cst, -sla*sst, cla, obsN);    // 北
      eqToWorld(-sst, cst, 0, obsE);               // 東
      const rW = 6378.14 * KM2W;
      obsPosW[0]=eC[0]+rW*obsU[0]; obsPosW[1]=eC[1]+rW*obsU[1]; obsPosW[2]=eC[2]+rW*obsU[2];
    }
  }
  // ワールドの「方向ベクトル」を地平フレーム [東, 天頂, -北] (azAltDir と同じ規約) へ
  function worldDirToGround(d, out) {
    const e = d[0]*obsE[0]+d[1]*obsE[1]+d[2]*obsE[2];
    const u = d[0]*obsU[0]+d[1]*obsU[1]+d[2]*obsU[2];
    const nn = d[0]*obsN[0]+d[1]*obsN[1]+d[2]*obsN[2];
    out[0]=e; out[1]=u; out[2]=-nn; return out;
  }
  // 観測地からの天体方向 (視差込み) → 地平フレーム単位ベクトル + 距離[AU]。az/alt はこれから求める
  function bodySky(body, out) {
    const b = posW.get(body.key);
    let dx = b[0]-obsPosW[0], dy = b[1]-obsPosW[1], dz = b[2]-obsPosW[2];
    const dist = Math.hypot(dx, dy, dz) || 1; dx/=dist; dy/=dist; dz/=dist;
    out[0] = dx*obsE[0]+dy*obsE[1]+dz*obsE[2];
    out[1] = dx*obsU[0]+dy*obsU[1]+dz*obsU[2];
    out[2] = -(dx*obsN[0]+dy*obsN[1]+dz*obsN[2]);
    return dist / K_REAL;                          // AU
  }
  function projGround(p) {
    const w = gVP[3]*p[0] + gVP[7]*p[1] + gVP[11]*p[2] + gVP[15];
    if (w <= 0.01) return null;
    const x = gVP[0]*p[0] + gVP[4]*p[1] + gVP[8]*p[2] + gVP[12];
    const y = gVP[1]*p[0] + gVP[5]*p[1] + gVP[9]*p[2] + gVP[13];
    return { x: (x/w*0.5+0.5)*W, y: (1-(y/w*0.5+0.5))*H };
  }
  const magSize = (m) => Math.max(1.6, Math.min(9, 6 - m * 1.2));
  const SKYR = 100;
  const groundVis = [];
  function renderGround(nowSec) {
    buildObsFrame();   // 観測者フレーム (地球/月) を確定
    if (!groundVB) {
      // 地面 = 下半球ドーム。視点は原点なので y=0 の平面では下半分を塗れない
      // (平面が視点を通ると地平線の線にしかならない)。天頂下の全方向を覆う
      // 半球メッシュにして地平線より下を確実に隠す
      const RA = 200, NAZ = 48, NALT = 6, dome = [];
      const V = (alt, az) => { const ca = Math.cos(alt); return [ca * Math.sin(az) * RA, Math.sin(alt) * RA, -ca * Math.cos(az) * RA]; };
      for (let j = 0; j < NALT; j++) {
        const a0 = -(j / NALT) * Math.PI / 2, a1 = -((j + 1) / NALT) * Math.PI / 2;
        for (let i = 0; i < NAZ; i++) {
          const z0 = i / NAZ * 2 * Math.PI, z1 = (i + 1) / NAZ * 2 * Math.PI;
          const p00 = V(a0, z0), p01 = V(a0, z1), p10 = V(a1, z0), p11 = V(a1, z1);
          dome.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
        }
      }
      groundDomeN = dome.length / 3;
      groundVB = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, groundVB);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(dome), gl.STATIC_DRAW);
      groundPtVB = gl.createBuffer();
      // 水平線リング (alt=0 の大円)
      const HN = 128, hr = [];
      for (let i = 0; i <= HN; i++) { azAltDir(i / HN * 360, 0, _gp); hr.push(_gp[0]*SKYR, _gp[1]*SKYR, _gp[2]*SKYR); }
      horizonVB = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, horizonVB);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hr), gl.STATIC_DRAW);
      horizonN = HN + 1;

      // 稜線つきドーム: 上端の高度を方位ごとに変えて山並み/クレーター縁のシルエットを作る。
      // 稜線は必ず地平線以上に出す (下げると地平線下の天体が覗いてしまうため)
      const RN = 192;
      const ridgeProfile = (amp) => {
        const p = new Float32Array(RN + 1);
        for (let i = 0; i <= RN; i++) {
          const a = i / RN * 2 * Math.PI;   // 整数倍音のみ = 継ぎ目が滑らかに閉じる
          const v = 0.55 * Math.sin(a * 3 + 0.7) + 0.32 * Math.sin(a * 7 + 2.1)
                  + 0.20 * Math.sin(a * 13 + 4.3) + 0.12 * Math.sin(a * 23 + 1.2)
                  + 0.07 * Math.sin(a * 37 + 5.6);
          p[i] = amp * Math.max(0, Math.min(1, (v + 1.26) / 2.52));
        }
        return p;
      };
      const buildRidgeDome = (prof) => {
        const RA2 = 200, NALT2 = 8, v = [];
        const P = (alt, az) => { const c = Math.cos(alt); return [c*Math.sin(az)*RA2, Math.sin(alt)*RA2, -c*Math.cos(az)*RA2]; };
        for (let i = 0; i < RN; i++) {
          const z0 = i / RN * 2 * Math.PI, z1 = (i + 1) / RN * 2 * Math.PI;
          const t0 = prof[i], t1 = prof[i + 1], bot = -Math.PI / 2;
          for (let j = 0; j < NALT2; j++) {
            const f0 = j / NALT2, f1 = (j + 1) / NALT2;
            const p00 = P(t0 + (bot - t0) * f0, z0), p01 = P(t1 + (bot - t1) * f0, z1);
            const p10 = P(t0 + (bot - t0) * f1, z0), p11 = P(t1 + (bot - t1) * f1, z1);
            v.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
          }
        }
        ridgeN = v.length / 3;
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
        return b;
      };
      ridgeVB.earth = buildRidgeDome(ridgeProfile(0.045));   // 山並み (約2.6°)
      ridgeVB.moon = buildRidgeDome(ridgeProfile(0.016));    // なだらかなクレーター縁 (約0.9°)

      // 空ドーム (上半球。地上の大気表現用。地平線の少し下から天頂まで覆う)
      const SR = 150, SAZ = 48, SALT = 10, sky = [];
      const S = (alt, az) => { const c = Math.cos(alt); return [c*Math.sin(az)*SR, Math.sin(alt)*SR, -c*Math.cos(az)*SR]; };
      for (let j = 0; j < SALT; j++) {
        const a0 = -0.12 + (Math.PI / 2 + 0.12) * (j / SALT), a1 = -0.12 + (Math.PI / 2 + 0.12) * ((j + 1) / SALT);
        for (let i = 0; i < SAZ; i++) {
          const z0 = i / SAZ * 2 * Math.PI, z1 = (i + 1) / SAZ * 2 * Math.PI;
          sky.push(...S(a0, z0), ...S(a1, z0), ...S(a1, z1), ...S(a0, z0), ...S(a1, z1), ...S(a0, z1));
        }
      }
      skyN = sky.length / 3;
      skyVB = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, skyVB);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sky), gl.STATIC_DRAW);
    }
    const ca = Math.cos(gAlt);
    _fwd[0] = ca*Math.sin(gAz); _fwd[1] = Math.sin(gAlt); _fwd[2] = -ca*Math.cos(gAz);
    mLookAt(ZERO3, _fwd, UP3, gV64);
    // ズーム時は near を引き上げて深度分解能を確保する (天体球と環の相互隠蔽に必要。
    // near 0.05 のままだと距離100での深度精度 ~0.012 が球の奥行きを超えてしまう)
    const gNear = Math.min(50, Math.max(0.05, 0.05 * (60 * DEG) / gFov));
    mPersp(gFov, W / H, gNear, 2000, gP64);
    mMul(gP64, gV64, gVP);
    gVP32.set(gVP);

    // 太陽の方向 (地平フレーム) と昼夜係数。地形の陰影・大気・星の減光に使う
    const sunAU = bodySky(SUN, _sunG);
    const isMoonSurf = surfaceBody === "moon";
    // ---- 日食: 観測地から見て太陽面が何割隠れているか ----
    // 地上では月が、月面では地球が太陽を隠す。皆既に近づくほど空が暗くなり、
    // 昼のうちに星が現れる — 昼夜係数へ畳んでおけば、空・地面・星・天体の
    // エアライト・Bloom のしきい値まで一度に効く
    const eclOcc = isMoonSurf ? BODY_BY_KEY.get("earth") : MOON;
    let sunCov = 0;
    {
      const occAU = bodySky(eclOcc, _gp);
      const rs = Math.asin(Math.min(1, SUN.rkm / (sunAU * AU_KM)));
      const ro = Math.asin(Math.min(1, eclOcc.rkm / (occAU * AU_KM)));
      const cos = _gp[0]*_sunG[0] + _gp[1]*_sunG[1] + _gp[2]*_sunG[2];
      sunCov = diskCoverage(Math.acos(Math.max(-1, Math.min(1, cos))), rs, ro);
    }
    // 隠れた面積をそのまま明るさに使うと、半分欠けただけで夕方になってしまう。
    // 目は明るさの対数に反応するので、実際に暗さを感じるのは残りが1割を切って
    // から — 残光を対数で写して、桁が落ちるほど急に暗くなる形にする。
    // 皆既でも 0 にはしない: 実際の皆既中の空は深い薄明で、地平はぐるりと
    // 夕焼け色に残る
    const sunLeft = Math.max(0.02, Math.min(1, 1 + Math.log10(Math.max(1e-4, 1 - sunCov)) / 3.5));
    // 月面は大気が無いので昼でも空は暗いまま (星も見える)
    const dayF = (showTerrain && !isMoonSurf)
      ? Math.max(0, Math.min(1, (_sunG[1] + 0.12) / 0.22)) * sunLeft : 0;
    starVis = 1 - dayF * 0.98;   // 昼は星をほぼ消す
    skyDayF = dayF;

    gl.clearColor(0.015, 0.02, 0.045, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);

    // 大気 (地上ビューのみ)。星より先に、背景として不透明で描く
    if (showTerrain && !isMoonSurf && dayF > 0.001 && skyVB) {
      gl.disable(gl.BLEND);
      gl.useProgram(terrainP.pr);
      gl.uniformMatrix4fv(terrainP.u.uVP, false, gVP32);
      gl.uniform3f(terrainP.u.uSun, _sunG[0], _sunG[1], _sunG[2]);
      gl.uniform1f(terrainP.u.uMoon, 0);
      gl.uniform1f(terrainP.u.uDay, dayF);
      gl.uniform1f(terrainP.u.uOcc, sunLeft);
      gl.uniform1f(terrainP.u.uSky, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyVB);
      gl.enableVertexAttribArray(terrainP.a.aPos);
      gl.vertexAttribPointer(terrainP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, skyN);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 天の川。空ドームの上に加算で重ね、恒星より先に描く (地面ドームは後から
    // 不透明で描かれるので、地平線より下は隠れる)。昼は星と同じだけ薄れる
    drawMilkyWay(gVP32, mwEqGround(), SKYR * 1.4,
                 (isMoonSurf ? MW_SPACE_BRIGHT : MW_GROUND_BRIGHT) * starVis);

    // 星座線 (観測者フレームへ投影。地平線より上のセグメントのみ)。恒星より先に描く
    if (showConst && CONST_SEG.length) {
      let cn = 0;
      for (let i = 0; i + 5 < CONST_SEG.length; i += 6) {
        const e0 = CONST_SEG[i]*obsE[0]+CONST_SEG[i+1]*obsE[1]+CONST_SEG[i+2]*obsE[2];
        const u0 = CONST_SEG[i]*obsU[0]+CONST_SEG[i+1]*obsU[1]+CONST_SEG[i+2]*obsU[2];
        const n0 = CONST_SEG[i]*obsN[0]+CONST_SEG[i+1]*obsN[1]+CONST_SEG[i+2]*obsN[2];
        const e1 = CONST_SEG[i+3]*obsE[0]+CONST_SEG[i+4]*obsE[1]+CONST_SEG[i+5]*obsE[2];
        const u1 = CONST_SEG[i+3]*obsU[0]+CONST_SEG[i+4]*obsU[1]+CONST_SEG[i+5]*obsU[2];
        const n1 = CONST_SEG[i+3]*obsN[0]+CONST_SEG[i+4]*obsN[1]+CONST_SEG[i+5]*obsN[2];
        if (u0 < -0.03 && u1 < -0.03) continue;      // 両端とも地平線下ならスキップ
        constGroundBuf[cn++] = e0 * SKYR; constGroundBuf[cn++] = u0 * SKYR; constGroundBuf[cn++] = -n0 * SKYR;
        constGroundBuf[cn++] = e1 * SKYR; constGroundBuf[cn++] = u1 * SKYR; constGroundBuf[cn++] = -n1 * SKYR;
      }
      if (cn) {
        gl.useProgram(lineP.pr);
        gl.uniformMatrix4fv(lineP.u.uVP, false, gVP32);
        gl.uniform4f(lineP.u.uColor, 0.19 * starVis, 0.25 * starVis, 0.4 * starVis, 0.55 * starVis);
        if (!constGVB) constGVB = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, constGVB);
        gl.bufferData(gl.ARRAY_BUFFER, constGroundBuf.subarray(0, cn), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(lineP.a.aPos);
        gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, cn / 3);
      }
      // 黄道 (金色。ワールド単位 = ECL_WORLD/1895 を投影)
      {
        const ER = 1895;
        let en = 0;
        for (let k = 0; k < ECL_N; k++) {
          const a = k * 3, b = ((k + 1) % ECL_N) * 3;
          const ax = ECL_WORLD[a]/ER, ay = ECL_WORLD[a+1]/ER, az = ECL_WORLD[a+2]/ER;
          const bx = ECL_WORLD[b]/ER, by = ECL_WORLD[b+1]/ER, bz = ECL_WORLD[b+2]/ER;
          const e0 = ax*obsE[0]+ay*obsE[1]+az*obsE[2], u0 = ax*obsU[0]+ay*obsU[1]+az*obsU[2], n0 = ax*obsN[0]+ay*obsN[1]+az*obsN[2];
          const e1 = bx*obsE[0]+by*obsE[1]+bz*obsE[2], u1 = bx*obsU[0]+by*obsU[1]+bz*obsU[2], n1 = bx*obsN[0]+by*obsN[1]+bz*obsN[2];
          if (u0 < -0.03 && u1 < -0.03) continue;
          eclGroundBuf[en++] = e0 * SKYR; eclGroundBuf[en++] = u0 * SKYR; eclGroundBuf[en++] = -n0 * SKYR;
          eclGroundBuf[en++] = e1 * SKYR; eclGroundBuf[en++] = u1 * SKYR; eclGroundBuf[en++] = -n1 * SKYR;
        }
        if (en) {
          gl.useProgram(lineP.pr);
          gl.uniformMatrix4fv(lineP.u.uVP, false, gVP32);
          gl.uniform4f(lineP.u.uColor, 0.45 * starVis, 0.35 * starVis, 0.14 * starVis, 0.65 * starVis);
          if (!eclGVB) eclGVB = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, eclGVB);
          gl.bufferData(gl.ARRAY_BUFFER, eclGroundBuf.subarray(0, en), gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(lineP.a.aPos);
          gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
          gl.drawArrays(gl.LINES, 0, en / 3);
        }
      }
    }

    // 天球の経緯線 (赤道座標。星座線と同じ投影・地平線カリング)。
    // 星座線と違い昼でも消さない — 出しているのは目盛りなので、見えないと
    // 切替が効いていないように見える。昼は下限まで落として控えめにする
    if (showGrid && GRID_SEG.length) {
      let gn = 0;
      for (let i = 0; i + 5 < GRID_SEG.length; i += 6) {
        const e0 = GRID_SEG[i]*obsE[0]+GRID_SEG[i+1]*obsE[1]+GRID_SEG[i+2]*obsE[2];
        const u0 = GRID_SEG[i]*obsU[0]+GRID_SEG[i+1]*obsU[1]+GRID_SEG[i+2]*obsU[2];
        const n0 = GRID_SEG[i]*obsN[0]+GRID_SEG[i+1]*obsN[1]+GRID_SEG[i+2]*obsN[2];
        const e1 = GRID_SEG[i+3]*obsE[0]+GRID_SEG[i+4]*obsE[1]+GRID_SEG[i+5]*obsE[2];
        const u1 = GRID_SEG[i+3]*obsU[0]+GRID_SEG[i+4]*obsU[1]+GRID_SEG[i+5]*obsU[2];
        const n1 = GRID_SEG[i+3]*obsN[0]+GRID_SEG[i+4]*obsN[1]+GRID_SEG[i+5]*obsN[2];
        if (u0 < -0.03 && u1 < -0.03) continue;      // 両端とも地平線下ならスキップ
        gridGroundBuf[gn++] = e0 * SKYR; gridGroundBuf[gn++] = u0 * SKYR; gridGroundBuf[gn++] = -n0 * SKYR;
        gridGroundBuf[gn++] = e1 * SKYR; gridGroundBuf[gn++] = u1 * SKYR; gridGroundBuf[gn++] = -n1 * SKYR;
      }
      if (gn) {
        const gv = 0.4 + 0.6 * starVis;
        gl.useProgram(lineP.pr);
        gl.uniformMatrix4fv(lineP.u.uVP, false, gVP32);
        gl.uniform4f(lineP.u.uColor, 0.11 * gv, 0.21 * gv, 0.23 * gv, 0.45 * gv);
        if (!gridGVB) gridGVB = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, gridGVB);
        gl.bufferData(gl.ARRAY_BUFFER, gridGroundBuf.subarray(0, gn), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(lineP.a.aPos);
        gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, gn / 3);
      }
    }

    // 恒星 (実カタログ, 地平線より上のみ)。ワールド単位方向を観測者フレームへ投影
    if (N_CAT) {
      if (!starGVB) starGVB = gl.createBuffer();
      // 大気の無い月面では減光が効かないので、地上より一段大きく・明るく描く
      const szK = isMoonSurf ? 4.9 : 4.0, szMin = isMoonSurf ? 1.6 : 0.9;
      const brK = isMoonSurf ? 1.35 : 1.15, brA = isMoonSurf ? 0.115 : 0.13;
      const brMin = isMoonSurf ? 0.62 : 0.3;
      let ns = 0;
      for (let i = 0; i < N_CAT; i++) {
        const wx = STAR_W[i*3], wy = STAR_W[i*3+1], wz = STAR_W[i*3+2];
        const up = wx*obsU[0]+wy*obsU[1]+wz*obsU[2];      // sinAlt
        if (up < 0.02) continue;
        const east = wx*obsE[0]+wy*obsE[1]+wz*obsE[2];
        const north = wx*obsN[0]+wy*obsN[1]+wz*obsN[2];
        const o = ns * 7;
        starGArr[o] = east * SKYR; starGArr[o+1] = up * SKYR; starGArr[o+2] = -north * SKYR;
        const m = STAR_MAG[i];
        starGArr[o+3] = Math.max(szMin, szK - 0.55 * m);
        const c = Math.max(brMin, Math.min(1, brK - brA * m));
        const col = STAR_COL[i];                  // B-V 色指数による実際の色味
        starGArr[o+4] = col[0] * c; starGArr[o+5] = col[1] * c; starGArr[o+6] = col[2] * c;
        ns++;
      }
      if (ns) {
        gl.useProgram(pointP.pr);
        gl.uniformMatrix4fv(pointP.u.uVP, false, gVP32);
        gl.uniform1f(pointP.u.uScale, DPR);
        gl.uniform1f(pointP.u.uAlpha, (isMoonSurf ? 1 : 0.95) * starVis);
        gl.bindBuffer(gl.ARRAY_BUFFER, starGVB);
        gl.bufferData(gl.ARRAY_BUFFER, starGArr, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(pointP.a.aPos);
        gl.enableVertexAttribArray(pointP.a.aSize);
        gl.enableVertexAttribArray(pointP.a.aCol);
        gl.vertexAttribPointer(pointP.a.aPos, 3, gl.FLOAT, false, 28, 0);
        gl.vertexAttribPointer(pointP.a.aSize, 1, gl.FLOAT, false, 28, 12);
        gl.vertexAttribPointer(pointP.a.aCol, 3, gl.FLOAT, false, 28, 16);
        gl.drawArrays(gl.POINTS, 0, ns);
      }
    }

    // 太陽系天体: 小さいうちは点、拡大されたらテクスチャ球で描画
    groundVis.length = 0;
    let n = 0;
    const bigBodies = [];
    const halfFov = gFov * 0.5, halfH = H * 0.5;
    const bodies = surfaceBody === "moon" ? MOON_SKY_BODIES : SKY_BODIES;
    for (const b of bodies) {
      let altDeg, azDeg, distAU, magV;
      if (surfaceBody === "moon") {
        distAU = bodySky(b, _gp);                      // _gp = [east, up, -north]
        altDeg = Math.asin(Math.max(-1, Math.min(1, _gp[1]))) / DEG;
        azDeg = (Math.atan2(_gp[0], -_gp[2]) / DEG + 360) % 360;
        magV = null;
      } else {
        const c = computeObs(b);
        altDeg = c.alt; azDeg = c.az; distAU = c.distAU; magV = c.mag;
      }
      if (altDeg < -1 && b !== selected) continue;   // 選択天体は地平線下でも描画
      const angR = Math.asin(Math.min(0.9, b.rkm / (distAU * AU_KM)));
      const spherePx = angR / halfFov * halfH;
      // 地球以外の衛星は、画面上で母惑星の点に埋もれている間は省略 (地上ビューのみ)
      if (surfaceBody !== "moon" && b.parent && b.parent !== "earth" && b !== selected && spherePx < 5) {
        const pc = computeObs(BODY_BY_KEY.get(b.parent));
        const dAz = ((azDeg - pc.az + 540) % 360) - 180;
        const sepPx = Math.hypot(dAz * Math.cos(altDeg * DEG), altDeg - pc.alt) * DEG / gFov * H;
        if (sepPx < 12) continue;
      }
      azAltDir(azDeg, altDeg, _gp);
      const px = _gp[0]*SKYR, py = _gp[1]*SKYR, pz = _gp[2]*SKYR;
      groundVis.push({ b, px, py, pz, rpx: spherePx });
      if (spherePx >= 5) {                          // 画面上で十分大きい → 球
        bigBodies.push({ b, px, py, pz, dist: distAU,
                         wr: SKYR * Math.tan(angR), rpx: spherePx });
        continue;
      }
      let size, r, g, bl;
      if (b === SUN) {
        // 日食で欠けているぶん暗くする (点で描かれる倍率では形は出せない)
        size = 18 * (0.35 + 0.65 * sunLeft); r = 1.0 * sunLeft; g = 0.9 * sunLeft; bl = 0.6 * sunLeft;
      } else if (b.key === "moon") {
        size = 11; r = 0.9; g = 0.92; bl = 0.96;
      } else {
        size = magSize(magV == null ? 3.5 : magV); r = b.colA[0]*0.5+0.5; g = b.colA[1]*0.5+0.5; bl = b.colA[2]*0.5+0.5;
      }
      const o = n * 7;
      groundPtArr[o]=px; groundPtArr[o+1]=py; groundPtArr[o+2]=pz;
      groundPtArr[o+3]=size; groundPtArr[o+4]=r; groundPtArr[o+5]=g; groundPtArr[o+6]=bl;
      n++;
    }
    if (n) {
      gl.useProgram(pointP.pr);
      gl.uniformMatrix4fv(pointP.u.uVP, false, gVP32);
      gl.uniform1f(pointP.u.uScale, DPR);
      gl.uniform1f(pointP.u.uAlpha, 1.0);
      gl.bindBuffer(gl.ARRAY_BUFFER, groundPtVB);
      gl.bufferData(gl.ARRAY_BUFFER, groundPtArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pointP.a.aPos);
      gl.enableVertexAttribArray(pointP.a.aSize);
      gl.enableVertexAttribArray(pointP.a.aCol);
      gl.vertexAttribPointer(pointP.a.aPos, 3, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(pointP.a.aSize, 1, gl.FLOAT, false, 28, 12);
      gl.vertexAttribPointer(pointP.a.aCol, 3, gl.FLOAT, false, 28, 16);
      gl.drawArrays(gl.POINTS, 0, n);
    }
    gl.disable(gl.BLEND);
    // 拡大された天体はテクスチャ球で描画。太陽方向から照らすので満ち欠けも再現される
    if (bigBodies.length) {
      // 天体はすべて半径 SKYR のドーム上に置いてあるので、重なったときに球どうしが
      // 同じ距離で交差してしまう (日食で月が太陽を隠せない)。位置と半径を同じ率で
      // 縮めれば投影は1画素も変わらないから、実距離の順にドームの半径を変えて
      // 深度だけを正しくする
      if (bigBodies.length > 1) {
        bigBodies.sort((x, y) => x.dist - y.dist);
        for (let i = 0; i < bigBodies.length; i++) {
          const k = 0.55 + 0.45 * (i / (bigBodies.length - 1)), bb = bigBodies[i];
          bb.px *= k; bb.py *= k; bb.pz *= k; bb.wr *= k;
        }
      }
      if (surfaceBody === "moon") { bodySky(SUN, _fwd); }
      else { const sc = computeObs(SUN); azAltDir(sc.az, sc.alt, _fwd); }
      const sunGx = _fwd[0] * SKYR, sunGy = _fwd[1] * SKYR, sunGz = _fwd[2] * SKYR;
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
      // 距離100に対して半径が極小のため深度精度が足りず、裏側の半球が
      // Zファイティングで突き抜ける。片面カリングで自己交差を防ぐ。
      // この球の巻き方向では FRONT を落とすと観測者側の半球が残る
      // (BACK だと裏側の半球が見えてしまい、満ち欠けが反転する)
      bodyRenderer.beginPass({
        time: nowSec, cameraPosition: ZERO3,
        cullFace: gl.FRONT, depthTest: true, depthWrite: true,
        airSun: _sunG, airDay: dayF,
      });
      let satLx = 0, satLy = 0, satLz = 0;   // 土星の環の照射方向 (ループ内で確定)
      let airBody = null;                    // 大気シェルを重ねる天体 (地球のみ)
      for (const bb of bigBodies) {
        const b = bb.b, R = bb.wr;
        // 天体の実際の自転姿勢 (宇宙ビューと同じ回転) をローカル観測者フレームへ
        // 変換して描く。これにより地球なら「その日時に月へ向いている面」が出る
        const spin = b.rot ? 2 * Math.PI * simDays / b.rot + (b.spin0 || 0) : 0;
        mRotY(spin, SCR.ry);
        if (b.key === "saturn") mMul(SAT_ROT, SCR.ry, SCR.rot);
        else { mRotX(-(b.tilt || 0) * DEG, SCR.rx); mMul(SCR.rx, SCR.ry, SCR.rot); }
        const rw = SCR.rot;   // 列0,1,2 = 天体軸のワールド方向
        SCR.v2[0]=rw[0]; SCR.v2[1]=rw[1]; SCR.v2[2]=rw[2]; worldDirToGround(SCR.v2, SCR.v);
        const axx=SCR.v[0], axy=SCR.v[1], axz=SCR.v[2];
        SCR.v2[0]=rw[4]; SCR.v2[1]=rw[5]; SCR.v2[2]=rw[6]; worldDirToGround(SCR.v2, SCR.v);
        const ayx=SCR.v[0], ayy=SCR.v[1], ayz=SCR.v[2];
        SCR.v2[0]=rw[8]; SCR.v2[1]=rw[9]; SCR.v2[2]=rw[10]; worldDirToGround(SCR.v2, SCR.v);
        const azx=SCR.v[0], azy=SCR.v[1], azz=SCR.v[2];
        const m = gM64;   // f64 のまま合成し、mMul の出力 (f32) だけを GPU へ
        m[0]=axx*R; m[1]=axy*R; m[2]=axz*R; m[3]=0;
        m[4]=ayx*R; m[5]=ayy*R; m[6]=ayz*R; m[7]=0;
        m[8]=azx*R; m[9]=azy*R; m[10]=azz*R; m[11]=0;
        m[12]=bb.px; m[13]=bb.py; m[14]=bb.pz; m[15]=1;
        // 満ち欠けの照射方向: ドーム上の見かけの太陽位置ではなく「天体 → 実際の
        // 太陽」(ワールドで太陽は原点 = -posW) を遠方光源として使う。ドーム上の
        // 2点間で照らすと位相角が 90°-離角/2 に潰れ、常に満ち気味になるため
        if (b === SUN) {
          SCR.sun[0] = sunGx; SCR.sun[1] = sunGy; SCR.sun[2] = sunGz;
        } else {
          const w = posW.get(b.key);
          _gp[0] = -w[0]; _gp[1] = -w[1]; _gp[2] = -w[2];
          const Ld = worldDirToGround(_gp, _fwd);
          if (b.key === "saturn") { satLx = Ld[0]; satLy = Ld[1]; satLz = Ld[2]; }
          SCR.sun[0] = Ld[0] * 1e6; SCR.sun[1] = Ld[1] * 1e6; SCR.sun[2] = Ld[2] * 1e6;
        }
        // 食の遮蔽体。ワールドでの「天体 → 遮蔽体」をそのまま地平フレームへ回し、
        // ドームの縮尺 (球の半径 / 実半径) を掛けて置き直す
        const ecl = eclipseFor(b);
        let eclipse = null;
        if (ecl) {
          const w = posW.get(b.key), sc = R / bodyR(b);
          _eclW[0] = ecl.cw[0] - w[0]; _eclW[1] = ecl.cw[1] - w[1]; _eclW[2] = ecl.cw[2] - w[2];
          worldDirToGround(_eclW, _eclG);
          SCR.ecl.c[0] = bb.px + _eclG[0] * sc;
          SCR.ecl.c[1] = bb.py + _eclG[1] * sc;
          SCR.ecl.c[2] = bb.pz + _eclG[2] * sc;
          SCR.ecl.r = ecl.r * sc; SCR.ecl.sunAng = ecl.sunAng; SCR.ecl.col = ecl.col;
          eclipse = SCR.ecl;
        }
        const mvp = mMul(gVP, m, SCR.mvp);
        SCR.model.set(m);   // uModel は f32 で十分 (法線用)。f64 配列を直接渡さない
        bodyRenderer.draw({ body: b, model: SCR.model, mvp, sunPosition: SCR.sun, radiusPx: bb.rpx, eclipse });
        if (b.air) {
          // 行列とやりたいことは本体と同じで、大きさだけ (1 + air) 倍にする。
          // gM64 は次の天体で上書きされるので、ここで取っておく
          const s = 1 + b.air;
          for (let i = 0; i < 12; i++) SCR.air64[i] = m[i] * s;
          SCR.air64[12] = m[12]; SCR.air64[13] = m[13]; SCR.air64[14] = m[14]; SCR.air64[15] = 1;
          SCR.airSun[0] = SCR.sun[0]; SCR.airSun[1] = SCR.sun[1]; SCR.airSun[2] = SCR.sun[2];
          airBody = b;
        }
      }
      // 大気は加算で重ねるので、本体をすべて描き終えてから最後に足す
      if (airBody) {
        const airMvp = mMul(gVP, SCR.air64, SCR.airMvp);
        SCR.airModel.set(SCR.air64);
        bodyRenderer.drawAtmos({ body: airBody, model: SCR.airModel, mvp: airMvp, sunPosition: SCR.airSun });
      }
      bodyRenderer.endPass();
      // 土星の環 (球として描かれる倍率のときのみ。軸の向きを地上フレームへ変換)
      const satBB = bigBodies.find((x) => x.b.key === "saturn");
      if (satBB) {
        const Ag = worldDirToGround(SATURN_POLE_W, _gp);
        // y = 環の法線 とする正規直交基底 (環は軸対称なので面内回転は任意)
        let xx = -Ag[2], xy = 0, xz = Ag[0];
        let xl = Math.hypot(xx, xy, xz);
        if (xl < 1e-6) { xx = 1; xy = 0; xz = 0; xl = 1; }
        xx /= xl; xz /= xl;
        const zx = xy * Ag[2] - xz * Ag[1], zy = xz * Ag[0] - xx * Ag[2], zz = xx * Ag[1] - xy * Ag[0];
        const s = satBB.wr, m = gM64;
        m[0] = xx * s; m[1] = xy * s; m[2] = xz * s; m[3] = 0;
        m[4] = Ag[0] * s; m[5] = Ag[1] * s; m[6] = Ag[2] * s; m[7] = 0;
        m[8] = zx * s; m[9] = zy * s; m[10] = zz * s; m[11] = 0;
        m[12] = satBB.px; m[13] = satBB.py; m[14] = satBB.pz; m[15] = 1;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.useProgram(ringP.pr);
        gl.uniformMatrix4fv(ringP.u.uMVP, false, mMul(gVP, m, SCR.mvp));
        SCR.model.set(m);
        gl.uniformMatrix4fv(ringP.u.uModel, false, SCR.model);
        gl.uniform3f(ringP.u.uAxis, Ag[0], Ag[1], Ag[2]);
        // 環も本体と同じ「土星 → 実際の太陽」方向の遠方光源で照らす
        gl.uniform3f(ringP.u.uSun, satLx * 1e6, satLy * 1e6, satLz * 1e6);
        gl.uniform3f(ringP.u.uCam, 0.0, 0.0, 0.0);          // 観測者フレームの原点
        gl.uniform3f(ringP.u.uCenter, satBB.px, satBB.py, satBB.pz);
        gl.uniform2f(ringP.u.uRadii, s * satBB.b.rEq / satBB.b.rkm, s * satBB.b.rPol / satBB.b.rkm);
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
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
      gl.disable(gl.DEPTH_TEST);
    }

    // ---- 皆既日食のコロナ ----
    // 普段は光球が明るすぎて見えず、太陽面が完全に隠れて初めて現れる。
    // 板は月の球より奥 (太陽のドーム半径) へ置き、深度テストで中心を月に
    // 食わせて輪にする — 手前に置くと、ただの光の玉になってしまう。
    // Bloom の有無によらず出す: これはカメラや目の中の滲みではなく、
    // 実際にそこにある光だから
    {
      const cAmt = Math.max(0, Math.min(1, (sunCov - 0.985) / 0.015));
      const sBB = bigBodies.find((x) => x.b === SUN);
      const sv = sBB || groundVis.find((v) => v.b === SUN);
      if (cAmt > 0 && sv && sv.py > 0) {
        const cr = sBB ? sBB.wr
                       : SKYR * Math.tan(Math.asin(Math.min(0.9, SUN.rkm / (sunAU * AU_KM))));
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(billP.pr);
        gl.uniformMatrix4fv(billP.u.uVP, false, gVP32);
        gl.uniform3f(billP.u.uCenter, sv.px, sv.py, sv.pz);
        gl.uniform3f(billP.u.uRight, gV64[0], gV64[4], gV64[8]);
        gl.uniform3f(billP.u.uUp, gV64[1], gV64[5], gV64[9]);
        gl.bindBuffer(gl.ARRAY_BUFFER, billVB);
        gl.enableVertexAttribArray(billP.a.aCorner);
        gl.vertexAttribPointer(billP.a.aCorner, 2, gl.FLOAT, false, 0, 0);
        // 内側ほど明るい真珠色。太陽半径の 5倍あたりまで裾を引く
        gl.uniform1f(billP.u.uFall, 1.8);
        gl.uniform1f(billP.u.uSize, cr * 5.0);
        gl.uniform3f(billP.u.uCol1, 0.16 * cAmt, 0.17 * cAmt, 0.21 * cAmt);
        gl.uniform3f(billP.u.uCol2, 0.85 * cAmt, 0.88 * cAmt, 0.96 * cAmt);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(true);
      }
    }

    // 太陽の眩しさ (グレア)。宇宙ビューと同じ理由で Bloom のときだけ足す —
    // Bloom はトーンマップ済みの画面を取り込むので、太陽の円盤は空や雲と同じ
    // 1.0 に潰れていて、Bloom だけでは太陽を特別扱いできない。
    //
    // 地平線より下では出さない。深度バッファは球の描画前に消しているので
    // 地形では隠せず、また昇る前から光っていたら嘘になる。地平線近くは
    // 大気を長く通って実際に減光するので、高度で薄くする (月面には大気が
    // 無いので、この減衰は入れない = 昇った瞬間から容赦なく眩しい)
    if (bloomOn) {
      const sv = groundVis.find((v) => v.b === SUN);
      const sinAlt = sv ? sv.py / SKYR : -1;
      if (sv && sinAlt > 0) {
        // 日食で隠れているぶんは眩しくない。皆既ではグレアが完全に消え、
        // 空だけが暗く残る
        const fade = (surfaceBody === "moon"
          ? 1 : Math.min(1, sinAlt / 0.10)) * (1 - sunCov);
        // 大気を長く通るほど青が抜けて赤くなる (夕日が赤い理由)。地平ぎわの
        // 太陽を白いまま光らせると、周りが焼けているのにそこだけ昼の色になる。
        // 月面には大気が無いので白のまま
        const red = surfaceBody === "moon"
          ? 1 : Math.min(1, Math.max(0, sinAlt) / 0.30);
        const gm = 0.30 + 0.70 * red, bm = 0.08 + 0.92 * red * red;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);
        gl.useProgram(billP.pr);
        gl.uniformMatrix4fv(billP.u.uVP, false, gVP32);
        gl.uniform3f(billP.u.uCenter, sv.px, sv.py, sv.pz);
        gl.uniform3f(billP.u.uRight, gV64[0], gV64[4], gV64[8]);
        gl.uniform3f(billP.u.uUp, gV64[1], gV64[5], gV64[9]);
        gl.bindBuffer(gl.ARRAY_BUFFER, billVB);
        gl.enableVertexAttribArray(billP.a.aCorner);
        gl.vertexAttribPointer(billP.a.aCorner, 2, gl.FLOAT, false, 0, 0);
        // 裾 → 芯 の順。角度で決めるので、画角を狭めても見かけの比率は変わらない
        // 大気のある地上では、太陽まわりの広い暈は skyDayColor のミー散乱が
        // すでに作っている。ここで足すのは目やカメラの中で起きるグレアだけに
        // 絞る — 両方を大きく出すと二重になって白い塊になる。
        // 月面には大気が無く暈も出ないので、宇宙ビューと同じ広さで足す
        const wide = surfaceBody === "moon" ? 1.0 : 0.34;
        gl.uniform1f(billP.u.uFall, 1.6);
        gl.uniform1f(billP.u.uSize, SKYR * GLARE_TAN * wide);
        gl.uniform3f(billP.u.uCol1, 0.55 * fade, 0.32 * fade * gm, 0.12 * fade * bm);
        gl.uniform3f(billP.u.uCol2, 1.00 * fade, 0.86 * fade * gm, 0.66 * fade * bm);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        // 芯の落ち方を平らにしない。加算で 1.0 に張り付いた領域が広がると、
        // その縁が輪郭として読めて「太陽が大きくなった」に見えてしまう
        gl.uniform1f(billP.u.uFall, 1.5);
        gl.uniform1f(billP.u.uSize, SKYR * GLARE_TAN * wide * 0.22);
        gl.uniform3f(billP.u.uCol1, 1.0 * fade, 0.80 * fade * gm, 0.45 * fade * bm);
        gl.uniform3f(billP.u.uCol2, 1.0 * fade, 1.00 * fade * gm, 1.00 * fade * bm);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
    }

    // 彗星のコマ・尾 (太陽接近時のみ)。観測者フレームへ変換し、他の天体と同じく
    // 天球ドーム上へ一様縮小して置く (真の距離のままだと高倍率時に near 面で消える)
    {
      const gfpx = (H / 2) / Math.tan(gFov / 2);
      for (const c of COMETS) {
        const act = cometAct(c);
        if (act < 0.02) continue;
        const distAU = bodySky(c, _gp);                 // _gp = 観測者フレームの単位方向
        const dW = distAU * K_REAL;                     // 観測者からの実距離 [world]
        if (!(dW > 1e-9)) continue;
        const w = posW.get(c.key);
        // 反太陽方向 (イオンテイルの軸)
        const wl = Math.hypot(w[0], w[1], w[2]) || 1;
        SCR.v2[0] = w[0] / wl; SCR.v2[1] = w[1] / wl; SCR.v2[2] = w[2] / wl;
        worldDirToGround(SCR.v2, SCR.v);
        const ax = SCR.v[0], ay = SCR.v[1], az = SCR.v[2];
        // 軌道速度方向 (ダストテイルの湾曲用)
        keplerAU(c, simDays + 2, SCR.v);
        toWorld(SCR.v, SCR.v2);
        let vx = SCR.v2[0] - w[0], vy = SCR.v2[1] - w[1], vz = SCR.v2[2] - w[2];
        const vl = Math.hypot(vx, vy, vz) || 1;
        SCR.v2[0] = vx / vl; SCR.v2[1] = vy / vl; SCR.v2[2] = vz / vl;
        worldDirToGround(SCR.v2, SCR.v);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        drawCometFX(c, act, gVP32, nowSec,
                    _gp[0] * SKYR, _gp[1] * SKYR, _gp[2] * SKYR,
                    ax, ay, az, SCR.v[0], SCR.v[1], SCR.v[2],
                    gfpx, gV64[0], gV64[4], gV64[8], SKYR / dW);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
    }

    // 流星。空のものはすべて描き終えてから重ねる (加算合成なので順序が効く)
    updateMeteors(nowSec);
    drawMeteors(nowSec);

    // 地面 (下半球ドーム) を最後に不透明で描き、地平線より下を覆い隠す。
    // 天体・星・星座より後に描くので、地平線下の要素は確実に隠れる
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    if (showTerrain) {
      // 風景 ON: 稜線つきドームをプロシージャル質感で描く
      gl.useProgram(terrainP.pr);
      gl.uniformMatrix4fv(terrainP.u.uVP, false, gVP32);
      gl.uniform3f(terrainP.u.uSun, _sunG[0], _sunG[1], _sunG[2]);
      gl.uniform1f(terrainP.u.uMoon, isMoonSurf ? 1 : 0);
      gl.uniform1f(terrainP.u.uDay, dayF);
      gl.uniform1f(terrainP.u.uOcc, sunLeft);
      gl.uniform1f(terrainP.u.uSky, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, isMoonSurf ? ridgeVB.moon : ridgeVB.earth);
      gl.enableVertexAttribArray(terrainP.a.aPos);
      gl.vertexAttribPointer(terrainP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, ridgeN);
    } else {
      gl.useProgram(lineP.pr);
      gl.uniformMatrix4fv(lineP.u.uVP, false, gVP32);
      gl.enableVertexAttribArray(lineP.a.aPos);
      gl.uniform4f(lineP.u.uColor, 0.07, 0.075, 0.085, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, groundVB);
      gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, groundDomeN);
      // 水平線 (地面の上端に重ねて縁を鮮明に)
      gl.uniform4f(lineP.u.uColor, 0.30, 0.38, 0.52, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, horizonVB);
      gl.vertexAttribPointer(lineP.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINE_STRIP, 0, horizonN);
    }
    gl.depthMask(true);
    drawGroundOverlay();
  }
  function drawGroundOverlay() {
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.textAlign = "center";
    octx.font = '12px "Avenir Next","Hiragino Sans",sans-serif';
    const o = T().obs;
    octx.fillStyle = "rgba(150,178,224,0.55)";
    for (const [az, lab] of [[0, o.N], [90, o.E], [180, o.S], [270, o.W]]) {
      azAltDir(az, 0, _gp);
      const s = projGround([_gp[0]*SKYR, _gp[1]*SKYR, _gp[2]*SKYR]);
      if (s && s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H) octx.fillText(lab, s.x, s.y - 4);
    }
    // 星座名 (観測者フレームへ投影。地平線より上のもの)
    if (showConst && starVis > 0.04) {
      octx.fillStyle = "rgba(150,178,224," + (0.5 * starVis).toFixed(3) + ")";
      for (const c of CONST_LABELS) {
        // 画面内に見えている頂点の平均位置に名前を置く (中心点が画角外でも
        // 星座の一部が見えていれば、その見えている部分の中央に表示される)
        let sumx = 0, sumy = 0, cnt = 0;
        const v = c.verts;   // ワールド単位方向 [wx,wy,wz]×頂点
        for (let i = 0; i + 2 < v.length; i += 3) {
          const wx = v[i], wy = v[i+1], wz = v[i+2];
          const up = wx*obsU[0]+wy*obsU[1]+wz*obsU[2];
          if (up < 0.03) continue;
          const east = wx*obsE[0]+wy*obsE[1]+wz*obsE[2], north = wx*obsN[0]+wy*obsN[1]+wz*obsN[2];
          const s = projGround([east * SKYR, up * SKYR, -north * SKYR]);
          if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
          sumx += s.x; sumy += s.y; cnt++;
        }
        if (cnt >= 2) octx.fillText(lang === "ja" ? c.ja : c.en, sumx / cnt, sumy / cnt);
      }
      // 黄道ラベル: 画面中央に最も近い可視点に1つ
      const ER = 1895;
      let bx = 0, by = 0, bd = Infinity;
      for (let i = 0; i + 2 < ECL_WORLD.length; i += 3) {
        const wx = ECL_WORLD[i]/ER, wy = ECL_WORLD[i+1]/ER, wz = ECL_WORLD[i+2]/ER;
        const up = wx*obsU[0]+wy*obsU[1]+wz*obsU[2];
        if (up < 0.03) continue;
        const east = wx*obsE[0]+wy*obsE[1]+wz*obsE[2], north = wx*obsN[0]+wy*obsN[1]+wz*obsN[2];
        const s = projGround([east * SKYR, up * SKYR, -north * SKYR]);
        if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
        const d = (s.x - W / 2) ** 2 + (s.y - H / 2) ** 2;
        if (d < bd) { bd = d; bx = s.x; by = s.y; }
      }
      if (bd < Infinity) {
        octx.fillStyle = "rgba(226,178,110," + (0.75 * starVis).toFixed(3) + ")";
        octx.fillText(lang === "ja" ? "黄道" : "Ecliptic", bx, by - 6);
      }
    }
    drawRadiants();   // 放射点 (降っている流星群があるときだけ)
    octx.font = '11px "Avenir Next","Hiragino Sans",sans-serif';
    // 名前は天体リストの「名前」に従う (宇宙ビューと同じ)。名前を消すと選択天体の
    // 目印が無くなってしまうので、選択マークは名前とは別に出す
    const marked = showSelMark ? selected : null;
    const spotB = tourSpot ? BODY_BY_KEY.get(tourSpot) : null;
    for (const v of groundVis) {
      const s = projGround([v.px, v.py, v.pz]);
      if (!s || s.x < -30 || s.x > W + 30) continue;
      const hit = marked === v.b || spotB === v.b;
      // 円盤が画面を覆うほど近い天体 (月面から見た地球など) にリングは要らない
      if (hit && v.rpx < H * 0.3) {
        octx.beginPath();
        octx.arc(s.x, s.y, Math.max(v.rpx, 3) + 6, 0, 2 * Math.PI);
        octx.strokeStyle = "rgba(242,178,62,0.9)";
        octx.lineWidth = 1.2;
        octx.stroke();
      }
      if (!v.b.showLabel) continue;
      octx.fillStyle = hit ? "rgba(242,178,62,0.95)" : "rgba(201,213,234,0.82)";
      octx.fillText(bName(v.b), s.x, s.y - Math.max(v.rpx, 3) - 8);
    }
  }
