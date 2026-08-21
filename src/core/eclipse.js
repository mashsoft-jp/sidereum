  // ============================================================
  // 食 (球の影)
  //   太陽 – 遮蔽体 – 被照射体 が一直線に並ぶと、被照射体の表面から見た太陽面が
  //   遮蔽体に食われる。月食 (地球の影に入る月)・日食 (地球へ落ちる月の影)・
  //   木星面を渡るガリレオ衛星の影は、どれも同じ1つの計算で出る。
  //
  //   遮蔽の量は「その点から見て太陽面の何割が隠れたか」なので、面積の計算は
  //   画素ごとにシェーダ (body.frag) で解く。ここが決めるのは「どの天体を
  //   遮蔽体として渡すか」だけ — 太陽系のどの天体も、影を落としうる相手は
  //   同じ系の中の数個しかない。
  // ============================================================

  // 2円 (太陽面と遮蔽体) の重なり。返すのは太陽面が隠れた割合 0〜1。
  // sep = 中心どうしの離角、rs = 太陽の視半径、ro = 遮蔽体の視半径 [rad]
  function diskCoverage(sep, rs, ro) {
    if (sep >= rs + ro) return 0;              // 触れていない
    if (sep <= ro - rs) return 1;              // 皆既 (太陽が完全に隠れる)
    if (sep <= rs - ro) return (ro * ro) / (rs * rs);   // 金環 (遮蔽体が太陽面の中)
    const ca = Math.max(-1, Math.min(1, (sep*sep + rs*rs - ro*ro) / (2*sep*rs)));
    const cb = Math.max(-1, Math.min(1, (sep*sep + ro*ro - rs*rs) / (2*sep*ro)));
    const area = rs*rs * (Math.acos(ca) - ca * Math.sqrt(Math.max(0, 1 - ca*ca)))
               + ro*ro * (Math.acos(cb) - cb * Math.sqrt(Math.max(0, 1 - cb*cb)));
    return Math.min(1, area / (Math.PI * rs * rs));
  }

  // 皆既月食の赤銅色。本影の中へ届くのは、地球の大気を回り込むあいだに青を
  // 散乱で失った赤い光だけ。実際の明るさは満月の 1万分の1ほどで、そのまま
  // 出すと画面上は真っ黒になる — 同じ画面の中で「満月よりはっきり暗い赤」に
  // 見える値を置いている (リニア。照明の係数なのでトーンマップの前に効く)
  const ECL_REFRACT = [0.85, 0.185, 0.065];
  const ECL_NO_AIR = [0, 0, 0];

  // 遮蔽体になりうる相手。惑星には自分の衛星が、衛星には母惑星と兄弟の衛星が影を落とす
  const ECL_CAND = new Map();
  {
    const byParent = new Map();
    for (const s of SATELLITES) {
      if (!byParent.has(s.parent)) byParent.set(s.parent, []);
      byParent.get(s.parent).push(s);
    }
    for (const p of PLANETS) {
      const kids = byParent.get(p.key);
      if (kids && kids.length) ECL_CAND.set(p, kids);
    }
    for (const s of SATELLITES) {
      const par = PLANETS.find((p) => p.key === s.parent);
      const sib = (byParent.get(s.parent) || []).filter((x) => x !== s);
      const cands = par ? [par].concat(sib) : sib;
      if (cands.length) ECL_CAND.set(s, cands);
    }
  }

  // 天体キー → その天体を照らす太陽面を隠している遮蔽体 (無ければ null)。
  //   cw     遮蔽体の中心 (ワールド。posW の配列をそのまま指す)
  //   r      遮蔽体の半径 (ワールド)
  //   sunAng その天体から見た太陽の視半径 [rad]
  //   col    皆既のとき届く屈折光 (リニア)。大気の無い遮蔽体は 0
  const eclipseByKey = new Map();

  function updateEclipses() {
    const Rsun = bodyR(SUN);
    for (const [b, cands] of ECL_CAND) {
      eclipseByKey.set(b.key, null);
      const w = posW.get(b.key);
      const ds = Math.hypot(w[0], w[1], w[2]);      // 太陽はワールド原点にある
      if (ds < 1e-12) continue;
      const rs = Math.asin(Math.min(1, Rsun / ds));
      const lx = -w[0] / ds, ly = -w[1] / ds, lz = -w[2] / ds;   // 天体 → 太陽
      const rb = bodyR(b);
      let best = null, bestSlack = 0;
      for (const c of cands) {
        const cw = posW.get(c.key);
        const dx = cw[0] - w[0], dy = cw[1] - w[1], dz = cw[2] - w[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-12 || d >= ds) continue;         // 太陽より遠い側からは影が届かない
        const cos = (dx * lx + dy * ly + dz * lz) / d;
        if (cos <= 0) continue;                     // 太陽と反対側
        const sep = Math.acos(Math.max(-1, Math.min(1, cos)));
        const ro = Math.asin(Math.min(1, bodyR(c) / d));
        // 天体には広がりがあるので、中心では外れていても縁が影に入ることがある。
        // 表面の点で離角がずれる量は最大 rb/d [rad] なので、そのぶん広く採る
        const slack = (rs + ro + rb / d) - sep;
        if (slack <= 0) continue;
        if (slack > bestSlack) { bestSlack = slack; best = c; }
      }
      if (!best) continue;
      eclipseByKey.set(b.key, {
        cw: posW.get(best.key), r: bodyR(best), sunAng: rs,
        col: best.air ? ECL_REFRACT : ECL_NO_AIR,
      });
    }
  }
  const eclipseFor = (b) => eclipseByKey.get(b.key) || null;
