  // ---------- 流星 (地上ビューのみ) ----------
  // 出現数はシム時間に比例させる。再生速度がそのまま「眺める速さ」になり、
  // 3分/秒 (180倍) で流せば ZHR 100 の群が毎秒1個ほど流れる。ただし1本1本が流れる
  // 速さは実時間 — 探査機の自転と同じ扱いで、早送りしても線が一瞬で消える
  // ことはない。停止中は 1秒=1秒 で流す。
  //
  // 見かけの速さ・長さは決め打ちではなく、対地速度から出している。高度 95km
  // を秒速 v [km/s] で飛ぶと、放射点から角距離 ψ の位置での角速度は
  // (v/95)·sin ψ [rad/s]。しし座の 71km/s は 40°/秒 を超えて一瞬で走り、
  // りゅう座の 20km/s はその 1/3 の速さでゆっくり流れる。放射点のそばほど
  // 短く見える (真正面から向かってくるため) のもこの sin ψ による。
  const MET_MAX = 96;          // 同時に描く上限 (突発出現でも頭打ちにする)
  const MET_K = 8;             // 光跡の分割点数
  const MET_H = 95;            // 発光する高さ [km]
  const MET_R = 2.3;           // 個数比 (1等級暗くなるごとに何倍増えるか)
  const MET_MLIM = 6.0;        // ここまで暗いものを出す (ZHR の定義は 6.5等)
  const MET_ZSCALE = Math.pow(MET_R, MET_MLIM - 6.5);   // 暗い側を切ったぶんの補正
  const meteors = [];
  const MET_ALL = SHOWERS.concat(SPORADIC);
  const metArr = new Float32Array(MET_MAX * (MET_K - 1) * 6 * 7);
  let metVB = null;
  // リボン1枚ぶんの頂点並び: 0=前の分割点 / 1=今の分割点、side は幅方向の符号
  const MET_TRI = [0, 0, 1, 0, 1, 1], MET_SIDE = [-1, 1, -1, 1, 1, -1];
  let metPrevSec = -1, metPrevSim = 0;
  const metActive = [];        // いま降っている群 [{ s, zhr, alt, dir }]
  const _rad = [0, 0, 0], _mf = [0, 0, 0], _me1 = [0, 0, 0], _me2 = [0, 0, 0];
  let showMeteor = localStorage.getItem("ssMeteor") !== "0";   // 既定 ON

  // 放射点 (ワールド固定方向) → 地平フレーム [東, 天頂, -北]
  function metRadiantG(s, out) { return worldDirToGround(s.dirW, out); }
  // 放射点の方位・高度 [度] (ツアーの照準・追尾用)
  function radiantAltAz(key) {
    const s = SHOWER_BY_KEY.get(key);
    if (!s) return null;
    metRadiantG(s, _rad);
    return { az: (Math.atan2(_rad[0], -_rad[2]) / DEG + 360) % 360,
             alt: Math.asin(Math.max(-1, Math.min(1, _rad[1]))) / DEG };
  }
  // ツアー用: 放射点へ照準を合わせ、そのまま日周運動を追尾する。天体と違って
  // 選択の対象にならないので、追尾は gRadTrack (群のキー) で持つ
  let gRadTrack = "";
  function aimGroundAtRadiant(key, instant) {
    const c = radiantAltAz(key);
    if (!c) return false;
    gTrack = true;
    gRadTrack = key;
    let d = (c.az * DEG - gAz) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    gAzTgt = gAz + d;
    gAltTgt = Math.max(-1.3, Math.min(GALT_MAX, c.alt * DEG));
    if (instant) { gAz = gAzTgt; gAlt = gAltTgt; gTrkKey = ""; }
    return true;
  }
  // 視野の円錐 (対角) の半角。流星はこの中だけに出し、そのぶん出現数も
  // 立体角比 (1 - cos θ) で減らす — 空全体に出して捨てるより無駄がない
  function metConeHalf() {
    return Math.min(1.47, Math.atan(Math.tan(Math.min(MAX_FOV, gFov) * 0.5) * Math.hypot(1, W / H)));
  }
  // 昼は流星が見えない。風景 (showTerrain) を切っていると空は昼でも暗いままで
  // 星も出したままにしてあるが、それに合わせて真昼に流星を降らせるのはさすがに
  // 誤解を招く。ここだけは風景の設定と関係なく太陽高度で決める
  function metNightF() {
    const a = Math.asin(Math.max(-1, Math.min(1, _sunG[1]))) / DEG;
    return Math.max(0, Math.min(1, (-a - 4) / 8));   // −4° で 0、−12° で 1
  }
  // 月明かり。満月が高いと暗い流星が空に埋もれる (概算)
  function metMoonF() {
    const c = computeObs(MOON);
    if (c.alt <= 0) return 1;
    return 1 - 0.62 * c.illum * Math.sqrt(Math.sin(c.alt * DEG));
  }

  // 1本ぶんの発生。radG = 放射点方向 (散在流星は null)
  function metSpawn(radG, v, nowSec) {
    // 視野円錐内へ立体角一様に開始点を取る
    const th = metConeHalf();
    const cu = 1 - (1 - Math.cos(th)) * Math.random();
    const su = Math.sqrt(Math.max(0, 1 - cu * cu));
    const ph = Math.random() * 2 * Math.PI;
    const ca = Math.cos(gAlt);
    _mf[0] = ca * Math.sin(gAz); _mf[1] = Math.sin(gAlt); _mf[2] = -ca * Math.cos(gAz);
    // _mf 周りの正規直交基底 (天頂と平行になる場合は東を使う)
    let ax = 0, ay = 1, az = 0;
    if (Math.abs(_mf[1]) > 0.98) { ax = 1; ay = 0; }
    _me1[0] = ay * _mf[2] - az * _mf[1];
    _me1[1] = az * _mf[0] - ax * _mf[2];
    _me1[2] = ax * _mf[1] - ay * _mf[0];
    const e1l = Math.hypot(_me1[0], _me1[1], _me1[2]) || 1;
    _me1[0] /= e1l; _me1[1] /= e1l; _me1[2] /= e1l;
    _me2[0] = _mf[1] * _me1[2] - _mf[2] * _me1[1];
    _me2[1] = _mf[2] * _me1[0] - _mf[0] * _me1[2];
    _me2[2] = _mf[0] * _me1[1] - _mf[1] * _me1[0];
    const cp = Math.cos(ph) * su, sp = Math.sin(ph) * su;
    const px = _mf[0] * cu + _me1[0] * cp + _me2[0] * sp;
    const py = _mf[1] * cu + _me1[1] * cp + _me2[1] * sp;
    const pz = _mf[2] * cu + _me1[2] * cp + _me2[2] * sp;
    if (py < 0.015) return;                     // 地平線下からは出さない
    // 進む向き: 放射点と開始点を通る大円を、放射点と反対側へ
    let tx, ty, tz, sinPsi;
    if (radG) {
      const c = px * radG[0] + py * radG[1] + pz * radG[2];
      sinPsi = Math.sqrt(Math.max(0, 1 - c * c));
      if (sinPsi < 0.035) return;               // 放射点のごく近くは点にしかならない
      tx = (px * c - radG[0]) / sinPsi;
      ty = (py * c - radG[1]) / sinPsi;
      tz = (pz * c - radG[2]) / sinPsi;
    } else {
      // 散在流星は放射点を持たない。適当な大円へ流す
      const rx = Math.random() - 0.5, ry = Math.random() - 0.5, rz = Math.random() - 0.5;
      const d = rx * px + ry * py + rz * pz;
      tx = rx - d * px; ty = ry - d * py; tz = rz - d * pz;
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      sinPsi = 0.45 + 0.55 * Math.random();
    }
    // 明るさ: 1等級暗くなるごとに MET_R 倍に増える分布から引く
    const m = Math.max(-4, MET_MLIM + Math.log(Math.random() || 1e-6) / Math.log(MET_R));
    const bri = Math.pow(2.512, 3.0 - m);       // 3等を1とした明るさ
    const dur = 0.16 + 0.85 * Math.pow(Math.random(), 1.6) * (1 + Math.min(1.2, bri * 0.1));
    const len = Math.min(1.5, (v / MET_H) * sinPsi * dur);
    // 光跡の残り方 [s]。飛んだ長さに対する見かけの長さを決めるので、飛行時間に
    // 比例させる (固定値だと、短命な流星は尾が伸びきる前に消えて点に見える)。
    // 痕: 速い群の明るい流星は、通り過ぎたあとしばらく光の筋が残る
    const tau = 0.34 * dur + (v > 55 && m < 1 ? 0.25 + Math.random() * 0.6 : 0);
    // 色は対地速度で決まる (遅い = 黄橙、速い = 青白)。明るいものほど白く飛ぶ
    const w = Math.min(1, Math.max(0, (v - 30) / 40));
    const wh = Math.min(0.65, Math.max(0, bri * 0.1));
    const r = (1.00 + (0.70 - 1.00) * w), g = (0.72 + (0.80 - 0.72) * w), b = (0.36 + (1.00 - 0.36) * w);
    meteors.push({
      t0: nowSec, dur, len, tau,
      px, py, pz, tx, ty, tz,
      // 画面での明るさは等級から直に引く。放射エネルギー比 (2.512^Δm) をそのまま
      // 使うと6等がほぼ見えず、実際の空の見え方 (6等星は見える) と合わない。
      // 恒星の描き方 (sky の brK/brA) と同じ傾きに揃えてある
      // 画面での明るさは等級から直に引く。放射エネルギー比 (2.512^Δm) をそのまま
      // 使うと6等がほとんど見えず、実際の空の見え方 (6等星は見える) と合わない。
      // 恒星の描き方 (sky.js の brK/brA) と同じ傾きに揃えてある
      a: Math.max(0.55, Math.min(2.2, 1.75 - 0.18 * m)),
      wpx: 1.8 + 0.5 * Math.max(0, 3 - m),   // 明るいものほど太い (火球は5px)
      r: r + (1 - r) * wh, g: g + (1 - g) * wh, b: b + (1 - b) * wh,
    });
  }

  function updateMeteors(nowSec) {
    const dtReal = metPrevSec < 0 ? 0 : Math.min(0.25, Math.max(0, nowSec - metPrevSec));
    metPrevSec = nowSec;
    const dSim = Math.abs(simDays - metPrevSim);
    metPrevSim = simDays;
    metActive.length = 0;
    // 月面には大気が無いので流星は光らない
    if (!showMeteor || !groundView || surfaceBody !== "earth") { meteors.length = 0; return; }
    // 寿命の尽きたものを落とす
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      if (nowSec - m.t0 > m.dur + m.tau * 3) meteors.splice(i, 1);
    }
    // 1フレームで進める時間。日時をジャンプしたときに一気に湧かないよう頭打ちにする
    const dtH = playing ? Math.min(dSim * 24, 1.0) : dtReal / 3600;
    if (dtH <= 0) return;
    const coneF = 1 - Math.cos(metConeHalf());
    const nightF = metNightF();
    // 昼でも放射点の印は出す (「空にはあるが見えない」を示すため)。出現数だけ 0 になる
    const moonF = nightF > 0 ? metMoonF() : 1;
    const sl = sunLonDeg();
    for (const s of MET_ALL) {
      const spor = s === SPORADIC;
      let sinAlt = 0.5, zhr = s.zhr;
      if (!spor) {
        zhr = showerZhr(s, simDays, sl);
        if (zhr < 1.2) { s.acc = 0; continue; }
        metRadiantG(s, _rad);
        sinAlt = _rad[1];
        metActive.push({ s, zhr, alt: Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG,
                         dir: [_rad[0], _rad[1], _rad[2]] });
        if (sinAlt < 0.03) { s.acc = 0; continue; }
      }
      // 実際の出現数 = ZHR × sin(放射点高度) × 月明かり × 夜か
      const hr = zhr * sinAlt * moonF * nightF * MET_ZSCALE * coneF;
      s.acc = Math.min(4, s.acc + hr * dtH);
      while (s.acc >= 1 && meteors.length < MET_MAX) {
        s.acc -= 1;
        // 発生時刻はフレーム内へばらけさせる。全部を今フレームの頭から始めると
        // 「まとめて出てまとめて消える」拍が見えるし、フレーム間隔が空く端末
        // (低 fps・タブ復帰直後) では出た瞬間に寿命が尽きて1本も見えなくなる
        const t0 = nowSec - Math.random() * Math.min(0.4, Math.max(dtReal, 0.016));
        if (spor) metSpawn(null, 15 + Math.random() * 55, t0);
        else metSpawn(_rad, s.v, t0);
      }
    }
  }

  // 光跡を1本のリボンとして描く。加算合成なので、後ろの星が透けて見える
  function drawMeteors(nowSec) {
    if (!meteors.length) return;
    let n = 0;
    const pxW = gFov / H * SKYR;                // 画面1px ぶんの world 幅
    for (const m of meteors) {
      const age = nowSec - m.t0;
      const span = m.tau * 3;                   // 先端から後ろへ引く時間
      const endF = age <= m.dur ? 1 : Math.max(0, 1 - (age - m.dur) / span);
      if (endF <= 0) continue;
      const fadeIn = Math.min(1, age / 0.05);
      const headA = Math.min(age, m.dur) / m.dur * m.len;
      const rate = m.len / m.dur;               // 弧長の進み [rad/s]
      const half = Math.max(0.6, m.wpx * 0.5) * pxW;
      // 頂点は前の分割点との間に張るので、1点ぶんだけ持ち越す
      let has = 0, ox = 0, oy = 0, oz = 0, ohx = 0, ohy = 0, ohz = 0, orr = 0, og = 0, ob = 0;
      for (let k = 0; k < MET_K; k++) {
        const ageK = k / (MET_K - 1) * span;
        const arc = headA - ageK * rate;
        const t = Math.max(0, arc);
        const ct = Math.cos(t), st = Math.sin(t);
        const x = m.px * ct + m.tx * st, y = m.py * ct + m.ty * st, z = m.pz * ct + m.tz * st;
        const dx = -m.px * st + m.tx * ct, dy = -m.py * st + m.ty * ct, dz = -m.pz * st + m.tz * ct;
        // 位置と進行方向はどちらも単位で直交するので、外積がそのまま横方向の単位になる
        const hx = (y * dz - z * dy) * half, hy = (z * dx - x * dz) * half, hz = (x * dy - y * dx) * half;
        const a = (arc < 0 ? 0 : Math.exp(-ageK / m.tau)) * endF * fadeIn * m.a;
        const cx = x * SKYR, cy = y * SKYR, cz = z * SKYR;
        const cr = m.r * a, cg = m.g * a, cb = m.b * a;
        if (has) {
          // 前の点 (o*) と今の点 (c*) で四角形 1枚 = 三角形 2枚
          for (let i = 0; i < 6; i++) {
            const cur = MET_TRI[i], sgn = MET_SIDE[i], oo = (n + i) * 7;
            const bx = cur ? cx : ox, by = cur ? cy : oy, bz = cur ? cz : oz;
            metArr[oo]     = bx + (cur ? hx : ohx) * sgn;
            metArr[oo + 1] = by + (cur ? hy : ohy) * sgn;
            metArr[oo + 2] = bz + (cur ? hz : ohz) * sgn;
            metArr[oo + 3] = cur ? cr : orr;
            metArr[oo + 4] = cur ? cg : og;
            metArr[oo + 5] = cur ? cb : ob;
            metArr[oo + 6] = sgn;
          }
          n += 6;
        }
        has = 1;
        ox = cx; oy = cy; oz = cz; ohx = hx; ohy = hy; ohz = hz; orr = cr; og = cg; ob = cb;
      }
    }
    if (!n) return;
    if (!metVB) metVB = gl.createBuffer();
    // 状態は暗黙で引き継がせない (直前が球の描画なら深度とカリングが立っている)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.useProgram(meteorP.pr);
    gl.uniformMatrix4fv(meteorP.u.uVP, false, gVP32);
    gl.bindBuffer(gl.ARRAY_BUFFER, metVB);
    gl.bufferData(gl.ARRAY_BUFFER, metArr.subarray(0, n * 7), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(meteorP.a.aPos);
    gl.enableVertexAttribArray(meteorP.a.aCol);
    gl.enableVertexAttribArray(meteorP.a.aY);
    gl.vertexAttribPointer(meteorP.a.aPos, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(meteorP.a.aCol, 3, gl.FLOAT, false, 28, 12);
    gl.vertexAttribPointer(meteorP.a.aY, 1, gl.FLOAT, false, 28, 24);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    gl.disable(gl.BLEND);
  }

  // 放射点の印と群名 (オーバーレイ)。降っている群だけ、地平線より上にあるとき
  function drawRadiants() {
    if (!metActive.length) return;
    octx.textAlign = "center";
    octx.font = '11px "Avenir Next","Hiragino Sans",sans-serif';
    for (const a of metActive) {
      if (a.dir[1] < 0.02) continue;
      const s = projGround([a.dir[0] * SKYR, a.dir[1] * SKYR, a.dir[2] * SKYR]);
      if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > H) continue;
      // 濃さは出現数で。平年の極大 (ZHR 100 前後) で最も濃くなる
      const v = Math.min(0.85, 0.22 + Math.log10(1 + a.zhr) * 0.26) * starVis;
      octx.strokeStyle = "rgba(150,196,236," + v.toFixed(3) + ")";
      octx.lineWidth = 1.1;
      octx.beginPath();
      octx.arc(s.x, s.y, 7, 0, 2 * Math.PI);
      octx.stroke();
      octx.beginPath();
      octx.moveTo(s.x - 12, s.y); octx.lineTo(s.x - 9, s.y);
      octx.moveTo(s.x + 9, s.y); octx.lineTo(s.x + 12, s.y);
      octx.moveTo(s.x, s.y - 12); octx.lineTo(s.x, s.y - 9);
      octx.moveTo(s.x, s.y + 9); octx.lineTo(s.x, s.y + 12);
      octx.stroke();
      octx.fillStyle = "rgba(178,214,246," + v.toFixed(3) + ")";
      octx.fillText(lang === "ja" ? a.s.ja : a.s.en, s.x, s.y - 17);
    }
  }
