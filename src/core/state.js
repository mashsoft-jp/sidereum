  // ---------- 状態 ----------
  let W = 0, H = 0, DPR = 1;
  let simDays = (Date.now() - J2000) / DAY_MS;
  let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let daysPerSec = 8;
  let selected = null;                    // SUN / PLANETS[i] / MOON / null
  let lastCenter = null;                   // 最後に中心にした天体 (解除後のズーム下限に使用)
  // 選択マーク (オレンジのリングとラベル強調) を出すか。ガイドツアーの selected は
  // 「カメラの注視先」であって利用者が選んだわけではないので、既定では出さない
  let showSelMark = true;
  // ガイドツアー実行中。シーンを壊す操作 (天体の選択・再生の切替) を止めるのに使う
  let tourActive = false;
  // ツアーの視線ガイド。注視天体からこの天体へ向かう破線をオーバーレイに描く
  let tourSight = null;
  // ツアーの注目天体。選択とは別に、名前と輪郭を強調して見つけやすくする
  let tourSpot = null;
  // 探査機ツアー中はこの1機だけを描く (他機が画面に混ざると主役が分からない)
  let tourProbe = null;
  // 探査機視点。カメラを探査機の位置に置き、この天体を見る (キー文字列)。
  // 近づくほど見かけの変化が速くなるので、開始時の距離を基準に再生速度を落とす
  let tourRide = null;
  let tourRideRef = 0, tourRideSpd = 0;
  // 探査機視点で機体を描く倍率。目標に近づくほどカメラが機体へ寄っていく見せ方に
  // するために、開始時の距離を基準として大きくする (1 = 等倍)
  let tourRideMag = 1;
  // 探査機視点の補間はカメラ位置を主にする (注視点はそこから逆算する)
  let tourRideEye = null;
  // カメラが目標に落ち着くまで探査機を出さない (寄っている最中は隠す)
  let tourProbeHold = false;
  // 探査機モデルの回転角 [rad]。再生中だけ進めるので、時計を止めれば機体も止まる
  let probeSpin = 0;
  // 探査機の軌跡 (通過済みは濃く、未通過は淡く) を描くか
  let tourPath = false;
  const FOV = 45 * DEG;
  // 宇宙ビューのズーム (拡大率)。距離とは別に、画角を狭めて望遠的に拡大する
  const MAG_MAX = 100;
  let camZoom = 1, camZoomTgt = 1;
  const eFov = () => FOV / camZoom;   // 実効画角

  // カメラ (注視点 + 距離 + 角度)
  // 仰角の上限。90°ちょうどは視線が上方向ベクトル (0,1,0) と平行になり
  // lookAt が破綻するため、表示上 90° に丸まる僅か手前で止める
  const PITCH_MAX = 89.99 * DEG;
  const cam = {
    yaw: 0.9, pitch: 0.35,
    yawTgt: 0.9, pitchTgt: 0.35,
    dist: 1150, distTgt: 1150,
    focus: [0, 0, 0], focusTgt: [0, 0, 0],
    panOff: [0, 0, 0], panOffTgt: [0, 0, 0],   // 注視点からの平行移動 (パン)
    pos: [0, 0, 0],
  };

  // ワールド位置キャッシュ
  const posAU = new Map(), posW = new Map();
  for (const b of [SUN, ...PLANETS, ...SATELLITES, ...PROBES]) { posAU.set(b.key, [0,0,0]); posW.set(b.key, [0,0,0]); }
  const COMETS = PLANETS.filter((p) => p.comet);

  // ---------- 月の位置 (ELP-2000 の主要項による短縮理論, Meeus 第47章由来) ----------
  // 黄経・黄緯・距離の主要周期項のみ採用 (黄経誤差 ~0.01°、位相時刻 ~数分)。
  // 各項は [係数, D, M, M', F] (D=平均離角, M=太陽平均近点角, M'=月平均近点角, F=緯度引数)
  const MOON_LON = [   // 黄経 [度]
    [6.288774,0,0,1,0],[1.274027,2,0,-1,0],[0.658314,2,0,0,0],[0.213618,0,0,2,0],
    [-0.185116,0,1,0,0],[-0.114332,0,0,0,2],[0.058793,2,0,-2,0],[0.057066,2,-1,-1,0],
    [0.053322,2,0,1,0],[0.045758,2,-1,0,0],[-0.040923,0,1,-1,0],[-0.034720,1,0,0,0],
    [-0.030383,0,1,1,0],[0.015327,2,0,0,-2],[-0.012528,0,0,1,2],[0.010980,0,0,1,-2],
    [0.010675,4,0,-1,0],[0.010034,0,0,3,0],[0.008548,4,0,-2,0],[-0.007888,2,1,-1,0],
    [-0.006766,2,1,0,0],[-0.005163,1,0,-1,0],[0.004987,1,1,0,0],[0.004036,2,-1,1,0],
    [0.003994,2,0,2,0],[0.003861,4,0,0,0],[0.003665,2,0,-3,0],[-0.002689,0,1,-2,0],
    [-0.002602,2,0,-1,2],[0.002390,2,-1,-2,0],[-0.002348,1,0,1,0],[0.002236,2,-2,0,0],
  ];
  const MOON_LAT = [   // 黄緯 [度]
    [5.128122,0,0,0,1],[0.280602,0,0,1,1],[0.277693,0,0,1,-1],[0.173237,2,0,0,-1],
    [0.055413,2,0,-1,1],[0.046271,2,0,-1,-1],[0.032573,2,0,0,1],[0.017198,0,0,2,1],
    [0.009266,2,0,1,-1],[0.008822,0,0,2,-1],[0.008216,2,-1,0,-1],[0.004324,2,0,-2,-1],
    [0.004200,2,0,1,1],[-0.003359,2,1,0,-1],[0.002463,2,-1,-1,1],[0.002211,2,-1,0,1],
    [0.002065,2,-1,-1,-1],[-0.001870,0,1,-1,-1],[0.001828,4,0,-1,-1],[-0.001794,0,1,0,1],
  ];
  const MOON_DIST = [  // 距離 [km]
    [-20905.355,0,0,1,0],[-3699.111,2,0,-1,0],[-2955.968,2,0,0,0],[-569.925,0,0,2,0],
    [48.888,0,1,0,0],[-3.149,0,0,0,2],[246.158,2,0,-2,0],[-152.138,2,-1,-1,0],
    [-170.733,2,0,1,0],[-204.586,2,-1,0,0],[-129.620,0,1,-1,0],[108.743,1,0,0,0],
    [104.755,0,1,1,0],[10.321,2,0,0,-2],[79.661,0,0,1,-2],[-34.782,4,0,-1,0],
    [-23.210,0,0,3,0],[-21.636,4,0,-2,0],[24.208,2,1,-1,0],[30.824,2,1,0,0],
    [-8.379,1,0,-1,0],[-16.675,1,1,0,0],[-12.831,2,-1,1,0],[-10.445,2,0,2,0],[-11.650,4,0,0,0],
  ];
  function moonSeries(terms, D, M, Mp, F, E, fn) {
    let s = 0;
    for (const t of terms) {
      let c = t[0];
      if (t[2]) c *= (t[2] === 2 || t[2] === -2) ? E * E : E;   // M を含む項は離心率補正
      s += c * fn(t[1] * D + t[2] * M + t[3] * Mp + t[4] * F);
    }
    return s;
  }
  function moonGeoEclKm(d, out) {
    const T = d / 36525;
    const D  = (297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868) * DEG;
    const M  = (357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * DEG;
    const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699) * DEG;
    const F  = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000) * DEG;
    const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841;
    const E  = 1 - 0.002516 * T - 0.0000074 * T * T;
    const lon = moonSeries(MOON_LON, D, M, Mp, F, E, Math.sin);
    const lat = moonSeries(MOON_LAT, D, M, Mp, F, E, Math.sin) * DEG;
    const r = 385000.56 + moonSeries(MOON_DIST, D, M, Mp, F, E, Math.cos);
    // 平均要素は「その日の分点」基準。アプリの座標系 (J2000 黄道) に合わせて
    // 一般歳差の黄経成分を引く
    const lam = (Lp + lon - 1.3969713 * T - 0.0003086 * T * T) * DEG;
    const cb = Math.cos(lat);
    out[0] = r * cb * Math.cos(lam);
    out[1] = r * cb * Math.sin(lam);
    out[2] = r * Math.sin(lat);
    return out;   // 地心黄道 J2000 [km]
  }

  // ---------- 探査機の軌跡 ----------
  // 経由点は日付が決まっているので、位置も起動時に一度だけ確定させる。
  // 区間は時間で径数付けした Hermite 補間 (区間の長さが大きく違うので、
  // 一様な Catmull-Rom だと短い区間で行き過ぎる)
  // 経由点に置ける天体の黄道座標 [au]。衛星は updatePositions と同じ近似を使い、
  // ワールド座標で出た母天体からの相対位置を黄道へ戻す (toWorld の逆)
  function wayAU(key, days, out) {
    const p = PLANETS.find((x) => x.key === key);
    if (p) return keplerAU(p, days, out);
    const s = SATELLITES.find((x) => x.key === key);
    keplerAU(PLANETS.find((x) => x.key === s.parent), days, out);
    if (s === MOON) {
      const m = [0, 0, 0];
      moonGeoEclKm(days, m);
      out[0] += m[0] / AU_KM; out[1] += m[1] / AU_KM; out[2] += m[2] / AU_KM;
      return out;
    }
    const r = s.aKm / AU_KM;
    const th = s.dir * 2 * Math.PI * days / s.T + s.ph;
    const lx = Math.cos(th) * r, lz = Math.sin(th) * r;
    const ox = s.M[0] * lx + s.M[8] * lz;
    const oy = s.M[1] * lx + s.M[9] * lz;
    const oz = s.M[2] * lx + s.M[10] * lz;
    out[0] += ox; out[1] += -oz; out[2] += oy;
    return out;
  }
  const wayDays = (d) =>
    (Date.parse(d.indexOf("T") > 0 ? d + ":00Z" : d + "T00:00:00Z") - J2000) / DAY_MS;
  {
    const tmp = [0, 0, 0], v0 = [0, 0, 0], v1 = [0, 0, 0];
    for (const pr of PROBES) {
      pr.pts = pr.way.map((w) => {
        const t = wayDays(w.d);
        if (w.au) return { t, au: w.au };
        wayAU(w.at, t, tmp);
        const au = [tmp[0], tmp[1], tmp[2]];
        if (w.miss) {
          // 最接近距離ぶん、その天体の進行方向の後ろ側へずらす (probes.js の miss)
          wayAU(w.at, t - 0.01, v0);
          wayAU(w.at, t + 0.01, v1);
          const vx = v1[0] - v0[0], vy = v1[1] - v0[1], vz = v1[2] - v0[2];
          const s = w.miss / AU_KM / (Math.hypot(vx, vy, vz) || 1);
          au[0] -= vx * s; au[1] -= vy * s; au[2] -= vz * s;
        }
        return { t, au };
      });
    }
  }
  // ---------- 惑星のすぐ近くだけは双曲線軌道 (2体問題) ----------
  // 経由点を繋ぐ補間は「最接近に向かって減速する」など力学と逆の動きになるので、
  // フライバイの前後だけ中心天体まわりのケプラー軌道に差し替える。
  // 軌道の大きさは 最接近距離 q・最接近日時・通過点 (via) の3つで決まる:
  //   離心率は「via の距離から近点までの所要時間が合う値」を逆算する。
  //   軌道面は pole (実測の角運動量の向き) があればそれ、無ければ via の方向と
  //   この区間より後の最初の経由点の方向が張る面。
  //   via の miss (最接近距離) は off の向き、無ければ軌道面の法線方向へずらす。
  //   どちらも via 天体の方向に垂直な成分だけを採る — 動径方向へずらすと
  //   中心天体からの距離が変わって所要時間の逆算が崩れるため
  {
    const vSub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
    const vLen = (a) => Math.hypot(a[0], a[1], a[2]);
    const vUnit = (a) => { const l = vLen(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
    const vDot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const vCross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    // n まわりに th 回す (ロドリゲスの回転公式)
    const vRot = (v, n, th) => {
      const c = Math.cos(th), s = Math.sin(th), k = vDot(n, v) * (1 - c);
      const x = vCross(n, v);
      return [v[0]*c + x[0]*s + n[0]*k, v[1]*c + x[1]*s + n[1]*k, v[2]*c + x[2]*s + n[2]*k];
    };
    const tmp = [0, 0, 0];
    for (const pr of PROBES) {
      if (!pr.hyp) continue;
      pr.hyps = pr.hyp.map((h) => {
        const body = PLANETS.find((x) => x.key === h.at);
        const tp = wayDays(h.peri), tv = wayDays(h.via.d);
        const after = tv > tp;              // via は近点の前か後か
        // via 天体の、中心天体に対する位置 [km]
        const c1 = keplerAU(body, tv, [0, 0, 0]);
        const P1 = vSub(wayAU(h.via.at, tv, tmp), c1).map((x) => x * AU_KM);
        // 軌道の大きさ (離心率):
        //   vinf があればそれから直に。通過点の距離が衛星の軌道半径に対して
        //   大きすぎて手がかりにならない回に使う (via は向きだけを担う)
        //   無ければ「通過点の距離から近点までの所要時間が合う値」を二分法で
        //   (e が大きいほど速く着く)
        let e, r1;
        if (h.vinf) {
          e = 1 + h.q * h.vinf * h.vinf / h.mu;
          r1 = hypR(h.q / (e - 1), e, h.mu, (tv - tp) * 86400);
        } else {
          r1 = vLen(P1);
          const want = Math.abs(tp - tv) * 86400;
          let lo = 1.0001, hi = 60;
          for (let i = 0; i < 160; i++) {
            const ee = (lo + hi) / 2, AA = h.q / (ee - 1);
            const HH = Math.acosh(Math.max(1, (r1 / AA + 1) / ee));
            const t = (ee * Math.sinh(HH) - HH) * Math.sqrt(AA * AA * AA / h.mu);
            if (t > want) lo = ee; else hi = ee;
          }
          e = (lo + hi) / 2;
        }
        const A = h.q / (e - 1);
        const nu1 = (after ? 1 : -1) *
          Math.acos(Math.max(-1, Math.min(1, (h.q * (1 + e) / r1 - 1) / e)));
        const nuInf = Math.acos(-1 / e);
        // 離脱方向 (軌道面と、通る側を決めるのに使う)。
        // to があればその天体の向き、無ければこの区間より後の最初の経由点の向き
        const nx = h.to || pr.way.find((w) => wayDays(w.d) > tp);
        const nxAU = nx.au || wayAU(nx.at, wayDays(nx.d), [0, 0, 0]);
        const uOut = vUnit(vSub(nxAU, keplerAU(body, tp, [0, 0, 0])));
        // 軌道面。pole があれば実測の角運動量方向をそのまま使う (通過点を含む面に
        // なるよう、通過点方向に垂直な成分だけ採る)。向きまで実測なので、通る側を
        // 選び直す必要も無い。pole が無い場合は通過点と離脱方向が張る面 —
        // 離脱方向は惑星間の補間から来るので、実際とは数十度ずれることがある
        const shape = (v) => {
          const u = vUnit(v);
          const mk = (n) => {
            const peri = vRot(u, n, -nu1);
            return { n, peri, asym: vRot(peri, n, nuInf) };
          };
          if (h.pole) {
            const p = vUnit(h.pole), d0 = vDot(p, u);
            return mk(vUnit([p[0] - u[0]*d0, p[1] - u[1]*d0, p[2] - u[2]*d0]));
          }
          const n0 = vUnit(vCross(v, uOut));
          const a1 = mk(n0), a2 = mk([-n0[0], -n0[1], -n0[2]]);
          return vDot(a1.asym, uOut) >= vDot(a2.asym, uOut) ? a1 : a2;
        };
        // miss をずらす向き。off があれば実測のずれの向きをそのまま使い、
        // 無ければ軌道面の法線 (= 衛星の極の上を通る)。どちらも via 天体の方向
        // P1 に垂直な成分だけを採るので、中心天体からの距離は変わらず、
        // 離心率の逆算も崩れない。法線は miss を入れる前の面から一度だけ決める
        const o0 = shape(P1);
        const m = h.via.miss || 0;
        const rHat = vUnit(P1);
        let dir = o0.n;
        if (h.via.off) {
          const p = vUnit(h.via.off), d0 = vDot(p, rHat);
          dir = vUnit([p[0] - rHat[0]*d0, p[1] - rHat[1]*d0, p[2] - rHat[2]*d0]);
        }
        const o = shape([P1[0] + dir[0]*m, P1[1] + dir[1]*m, P1[2] + dir[2]*m]);
        return {
          body, tp, e, A, mu: h.mu, peri: o.peri, side: vCross(o.n, o.peri),
          ta: tp - h.span, tb: tp + h.span,
        };
      });
      // 窓の両端を経由点として差し込み、外側の補間と位置を繋ぐ
      for (const H of pr.hyps) {
        for (const t of [H.ta, H.tb]) {
          const au = hypAU(H, t, [0, 0, 0]);
          pr.pts.push({ t, au: [au[0], au[1], au[2]] });
        }
      }
      pr.pts.sort((a, b) => a.t - b.t);
    }
  }
  // 双曲線ケプラー方程式 M = e sinh F - F を Newton で解いて離心近点角を返す
  function hypF(A, e, mu, sec) {
    const M = Math.sqrt(mu / (A * A * A)) * sec;
    let F = Math.abs(M) > 6 ? Math.sign(M) * Math.log(2 * Math.abs(M) / e + 1.8)
                            : M / (e - 1);
    for (let i = 0; i < 40; i++) {
      const d = (e * Math.sinh(F) - F - M) / (e * Math.cosh(F) - 1);
      F -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return F;
  }
  // 経過秒から中心天体までの距離 [km] (上の構築ブロックから呼ぶので関数宣言で)
  function hypR(A, e, mu, sec) { return A * (e * Math.cosh(hypF(A, e, mu, sec)) - 1); }
  // 双曲線軌道上の位置 (黄道 au)。中心天体の位置に相対位置を足す
  function hypAU(H, days, out) {
    const F = hypF(H.A, H.e, H.mu, (days - H.tp) * 86400);
    const r = H.A * (H.e * Math.cosh(F) - 1) / AU_KM;
    const nu = 2 * Math.atan2(Math.sqrt(H.e + 1) * Math.tanh(F / 2), Math.sqrt(H.e - 1));
    const cn = r * Math.cos(nu), sn = r * Math.sin(nu);
    keplerAU(H.body, days, out);
    out[0] += H.peri[0] * cn + H.side[0] * sn;
    out[1] += H.peri[1] * cn + H.side[1] * sn;
    out[2] += H.peri[2] * cn + H.side[2] * sn;
    return out;
  }
  // 打ち上げ前・最後の経由点より後は null (描かない)
  function probeAU(pr, days, out) {
    const p = pr.pts;
    if (days < p[0].t || days > p[p.length - 1].t) return null;
    if (pr.hyps) {
      for (const H of pr.hyps) if (days >= H.ta && days <= H.tb) return hypAU(H, days, out);
    }
    let i = 0;
    while (i < p.length - 2 && days > p[i + 1].t) i++;
    const p1 = p[i], p2 = p[i + 1];
    const p0 = p[i - 1] || p1, p3 = p[i + 2] || p2;
    const dt = p2.t - p1.t || 1;
    const u = (days - p1.t) / dt, u2 = u * u, u3 = u2 * u;
    const h00 = 2*u3 - 3*u2 + 1, h10 = u3 - 2*u2 + u, h01 = -2*u3 + 3*u2, h11 = u3 - u2;
    for (let k = 0; k < 3; k++) {
      // 接線は前後の経由点からの差分を時間で正規化する
      const m1 = (p2.au[k] - p0.au[k]) / ((p2.t - p0.t) || 1) * dt;
      const m2 = (p3.au[k] - p1.au[k]) / ((p3.t - p1.t) || 1) * dt;
      out[k] = h00 * p1.au[k] + h10 * m1 + h01 * p2.au[k] + h11 * m2;
    }
    return out;
  }

  // 軌跡の線。経由点は固定なので起動時に一度だけ焼く。区間ごとに等時間で刻む —
  // 全体を通して等時間にすると、32年ある離脱区間に点が集中して、惑星まわりの
  // 折れ曲がり (見せたい部分) が数点に潰れてしまう
  {
    const PATH_SEG = 48;
    const au = [0, 0, 0], w = [0, 0, 0];
    for (const pr of PROBES) {
      const legs = pr.pts.length - 1;
      const n = legs * PATH_SEG + 1;
      pr.path = new Float32Array(n * 3);
      pr.pathT = new Float64Array(n);
      let i = 0;
      for (let g = 0; g < legs; g++) {
        const t0 = pr.pts[g].t, t1 = pr.pts[g + 1].t;
        const last = g === legs - 1 ? PATH_SEG : PATH_SEG - 1;
        for (let s = 0; s <= last; s++) {
          const t = t0 + (t1 - t0) * (s / PATH_SEG);
          toWorld(probeAU(pr, t, au), w);
          pr.path[i * 3] = w[0]; pr.path[i * 3 + 1] = w[1]; pr.path[i * 3 + 2] = w[2];
          pr.pathT[i] = t;
          i++;
        }
      }
    }
  }

  function updatePositions() {
    const tmp = [0, 0, 0];
    for (const p of PLANETS) {
      keplerAU(p, simDays, tmp);
      posAU.get(p.key)[0] = tmp[0]; posAU.get(p.key)[1] = tmp[1]; posAU.get(p.key)[2] = tmp[2];
      toWorld(tmp, posW.get(p.key));
    }
    // 衛星 (母天体中心, 実距離)。月のみ短縮 ELP 理論、他は円軌道近似
    for (const s of SATELLITES) {
      const par = posW.get(s.parent);
      const w = posW.get(s.key);
      if (s === MOON) {
        moonGeoEclKm(simDays, tmp);
        w[0] = par[0] + tmp[0] * KM2W;      // 黄道 → ワールド (toWorld と同じ軸対応)
        w[1] = par[1] + tmp[2] * KM2W;
        w[2] = par[2] - tmp[1] * KM2W;
        continue;
      }
      const r = s.aKm * KM2W;
      const th = s.dir * 2 * Math.PI * simDays / s.T + s.ph;
      const lx = Math.cos(th) * r, lz = Math.sin(th) * r;
      w[0] = par[0] + s.M[0] * lx + s.M[8] * lz;
      w[1] = par[1] + s.M[1] * lx + s.M[9] * lz;
      w[2] = par[2] + s.M[2] * lx + s.M[10] * lz;
    }
    // 探査機
    for (const pr of PROBES) {
      pr.live = !!probeAU(pr, simDays, tmp);
      if (!pr.live) continue;
      const a = posAU.get(pr.key);
      a[0] = tmp[0]; a[1] = tmp[1]; a[2] = tmp[2];
      toWorld(tmp, posW.get(pr.key));
    }
  }

  function minDist() {
    // 解除後も最後に中心だった天体のサイズを下限に使う (解除時に太陽サイズの下限へ
    // 跳ね上がってズームが一気に引かれるのを防ぐ)。中心が太陽/原点のときは太陽サイズ。
    const b = selected || lastCenter;
    return b && b !== SUN ? bodyR(b) * 1.7 : bodyR(SUN) * 2.2;
  }

