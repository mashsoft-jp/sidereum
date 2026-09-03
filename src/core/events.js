  // ============================================================
  // 天文イベントの探索
  //   位置計算 (keplerAU / moonGeoEclKm) は時刻を引数に取る純粋な関数なので、
  //   表示中の時刻を触らずに未来を先読みできる。ここでは時間方向に粗く走査して
  //   「符号が変わったところ」「極値」を拾い、二分法で詰める。
  //
  //   ここが返すのは日時と種別だけで、絵は既存のビューに任せる (イベントを
  //   選ぶと、その日時・その天体・そのビューへ飛ぶ)。
  //
  //   注意: 観測地 (obsLat/obsLon) と ECL・gmstDeg は ui/observe.js の値を
  //   実行時に借りている。この断片のトップレベルでは触らない
  // ============================================================
  const EV_TWO_PI = 2 * Math.PI;
  const EARTH_B = PLANETS.find((p) => p.key === "earth");
  const EV_RE_KM = 6378.14;                    // 観測地の視差に使う地球半径
  const evWrap = (a) => {                      // 角度差を (-π, π] へ畳む
    a = (a + Math.PI) % EV_TWO_PI;
    return (a < 0 ? a + EV_TWO_PI : a) - Math.PI;
  };
  const evAng = (a, b) => {                    // 2つのベクトルのなす角 [rad]
    const la = Math.hypot(a[0], a[1], a[2]), lb = Math.hypot(b[0], b[1], b[2]);
    if (la < 1e-12 || lb < 1e-12) return 0;
    const c = (a[0]*b[0] + a[1]*b[1] + a[2]*b[2]) / (la * lb);
    return Math.acos(Math.max(-1, Math.min(1, c)));
  };
  const _evA = [0,0,0], _evB = [0,0,0], _evC = [0,0,0], _evD = [0,0,0], _evE = [0,0,0];
  const _evP = [0,0,0];   // 歳差をかけた/戻したベクトル

  // 地心黄道ベクトル [AU]。out に書いて返す (out へ _evD は渡さないこと)
  function evGeo(b, t, out) {
    if (b === MOON) {
      moonGeoEclKm(t, out);
      out[0] /= AU_KM; out[1] /= AU_KM; out[2] /= AU_KM;
      return out;
    }
    keplerAU(EARTH_B, t, _evD);
    if (b === SUN) {
      out[0] = -_evD[0]; out[1] = -_evD[1]; out[2] = -_evD[2];
      return out;
    }
    keplerAU(b, t, out);
    out[0] -= _evD[0]; out[1] -= _evD[1]; out[2] -= _evD[2];
    return out;
  }
  const evLon = (b, t, tmp) => { evGeo(b, t, tmp); return Math.atan2(tmp[1], tmp[0]); };

  // f(t) = 0 を二分法で詰める (t0 と t1 で符号が違うこと)。返すのは日。
  // 32回で 1日の区間が 2e-8 秒まで縮むので、位置計算の精度より十分細かい
  function evRoot(f, t0, t1) {
    let a = t0, b = t1, fa = f(a);
    for (let i = 0; i < 32; i++) {
      const m = (a + b) / 2, fm = f(m);
      if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else { b = m; }
    }
    return (a + b) / 2;
  }
  // g(t) の極大を三分探索で詰める (1回で区間が 2/3 になる)
  function evPeak(g, t0, t1) {
    let a = t0, b = t1;
    for (let i = 0; i < 32; i++) {
      const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      if (g(m1) < g(m2)) a = m1; else b = m2;
    }
    return (a + b) / 2;
  }

  // g(t) の極大・極小を step 日刻みで探し、詰めてから cb(t, isMax) へ渡す
  function evScanExtrema(g, t0, t1, step, cb) {
    let ga = g(t0 - step), gb = g(t0);
    for (let t = t0; t < t1; t += step) {
      const tc = Math.min(t + step, t1), gc = g(tc);
      if (gb > ga && gb >= gc) cb(evPeak(g, t - step, tc), true);
      else if (gb < ga && gb <= gc) cb(evPeak((x) => -g(x), t - step, tc), false);
      ga = gb; gb = gc;
    }
  }
  const evLen = (v) => Math.hypot(v[0], v[1], v[2]);
  // 一般歳差 (黄経方向) [rad/世紀] と、太陽の光行差 [rad]。二至二分は「その日の分点」の
  // 黄経で決まるので、J2000 の黄経にこの2つを足してから比べる (足さないと 2026年で
  // 9時間ずれる。光行差ぶんは 8分)
  const EV_PREC = 1.396971 * DEG, EV_ABERR = -20.5 / 3600 * DEG;
  const EV_MOON_F = 1 / 82.3;   // 月の質量 / (地球 + 月)。重心 → 地球中心のずれ

  // ---------- 観測地からの見え方 ----------
  // 観測地の日心黄道位置 [AU] (地心ではなく地表の点。日食は 1° 近く変わる)
  function evObsHelio(t, out) {
    keplerAU(EARTH_B, t, out);
    const lst = (((280.46061837 + 360.98564736629 * t) % 360 + 360) % 360 + obsLon) * DEG;
    const la = obsLat * DEG, RE = EV_RE_KM / AU_KM;
    // 観測地はその日の平均分点。天体は J2000 なので歳差ぶんを戻してから足す
    // (向きがそのまま「天頂」になるので、大きさが小さくても効く)
    precessFrom(t, Math.cos(la) * Math.cos(lst), Math.cos(la) * Math.sin(lst), Math.sin(la), _evP);
    out[0] += RE * _evP[0];
    out[1] += RE * (_evP[1] * Math.cos(ECL) + _evP[2] * Math.sin(ECL));   // 赤道 → 黄道
    out[2] += RE * (-_evP[1] * Math.sin(ECL) + _evP[2] * Math.cos(ECL));
    return out;
  }
  // 観測地から見た天体の高度 [rad]。天頂方向は「地心 → 観測地」そのもの
  function evAlt(b, t) {
    evObsHelio(t, _evA);
    keplerAU(EARTH_B, t, _evC);
    const ux = _evA[0]-_evC[0], uy = _evA[1]-_evC[1], uz = _evA[2]-_evC[2];
    const ul = Math.hypot(ux, uy, uz) || 1;
    evGeo(b, t, _evB);
    const tx = _evB[0]-ux, ty = _evB[1]-uy, tz = _evB[2]-uz;
    const tl = Math.hypot(tx, ty, tz) || 1;
    return Math.asin(Math.max(-1, Math.min(1, (tx*ux + ty*uy + tz*uz) / (tl * ul))));
  }

  // 観測地から見た月と天体 b (惑星) の離角 [rad] と、月の視半径 [rad]。
  // 月は近いので、地心と観測地で見え方が最大 1° 違う — 掩蔽の判定は観測地で
  function evMoonSep(b, t) {
    evObsHelio(t, _evA);                         // 観測地 (日心)
    keplerAU(EARTH_B, t, _evC);
    moonGeoEclKm(t, _evB);
    const mx = _evC[0] + _evB[0]/AU_KM - _evA[0],   // 観測地 → 月
          my = _evC[1] + _evB[1]/AU_KM - _evA[1],
          mz = _evC[2] + _evB[2]/AU_KM - _evA[2];
    keplerAU(b, t, _evE);
    const px = _evE[0] - _evA[0], py = _evE[1] - _evA[1], pz = _evE[2] - _evA[2];
    const dm = Math.hypot(mx, my, mz), dp = Math.hypot(px, py, pz);
    return {
      sep: Math.acos(Math.max(-1, Math.min(1, (mx*px + my*py + mz*pz) / (dm * dp)))),
      rMoon: Math.asin(Math.min(1, MOON.rkm / (dm * AU_KM))),
    };
  }

  // 観測地から見て太陽面が月に隠されている割合 (0〜1) と食分
  function evSolarLocal(t) {
    evObsHelio(t, _evA);                         // 観測地 (日心)
    moonGeoEclKm(t, _evB);
    keplerAU(EARTH_B, t, _evC);
    const mx = _evC[0] + _evB[0]/AU_KM - _evA[0],   // 観測地 → 月
          my = _evC[1] + _evB[1]/AU_KM - _evA[1],
          mz = _evC[2] + _evB[2]/AU_KM - _evA[2];
    const sx = -_evA[0], sy = -_evA[1], sz = -_evA[2];   // 観測地 → 太陽
    const dm = Math.hypot(mx, my, mz), ds = Math.hypot(sx, sy, sz);
    const rs = Math.asin(Math.min(1, SUN.rkm / (ds * AU_KM)));
    const ro = Math.asin(Math.min(1, MOON.rkm / (dm * AU_KM)));
    const sep = Math.acos(Math.max(-1, Math.min(1, (mx*sx + my*sy + mz*sz) / (dm * ds))));
    return {
      // 食分 = 太陽の直径のうち隠れた割合。金環は月のほうが小さいので 1 に届かない
      mag: Math.max(0, (rs + ro - sep) / (2 * rs)),
      // 中心食 (月が太陽面にすっかり入る) かどうかは離角で決まる。
      // 食分のしきい値で判定すると、月が小さい回 (金環) を部分食に取り違える
      central: sep <= Math.abs(rs - ro),
      total: ro >= rs,
    };
  }

  // 月が地球の本影・半影のどこにいるか。covMin/covMax は月面の最も浅い点と
  // 最も深い点で「太陽面が隠れた割合」を見たもの
  function evLunar(t) {
    keplerAU(EARTH_B, t, _evA);
    moonGeoEclKm(t, _evB);
    const mx = _evA[0] + _evB[0]/AU_KM, my = _evA[1] + _evB[1]/AU_KM, mz = _evA[2] + _evB[2]/AU_KM;
    const ds = Math.hypot(mx, my, mz);                       // 月 → 太陽
    const ex = _evA[0]-mx, ey = _evA[1]-my, ez = _evA[2]-mz;  // 月 → 地球
    const de = Math.hypot(ex, ey, ez);
    const rs = Math.asin(Math.min(1, SUN.rkm / (ds * AU_KM)));
    const ro = Math.asin(Math.min(1, EARTH_B.rkm / (de * AU_KM)));
    const sep = Math.acos(Math.max(-1, Math.min(1, (-(ex*mx + ey*my + ez*mz)) / (de * ds))));
    const shift = MOON.rkm / (de * AU_KM);                    // 月の縁での離角のずれ
    return {
      sep,                                                     // 影の軸からの離角
      covMax: diskCoverage(Math.max(0, sep - shift), rs, ro),  // いちばん深く入る点
      covMin: diskCoverage(sep + shift, rs, ro),               // いちばん浅い点
    };
  }

  // ---------- 走査 ----------
  // t0 から days 日ぶんのイベントを日時順に返す。
  //   { t: 日, kind: 種別, key: 天体キー, view: "ground"|"space", data: {…} }
  function findEvents(t0, days) {
    const out = [];
    const t1 = t0 + days;
    const tmp = [0,0,0];
    const lonSun = (t) => evLon(SUN, t, tmp);
    const push = (e) => { if (e.t >= t0 && e.t <= t1) out.push(e); };

    // ---- 朔望 (新月・満月)。同時に食も調べる ----
    {
      const dl = (t) => evWrap(evLon(MOON, t, tmp) - lonSun(t));
      let pa = dl(t0);
      for (let t = t0; t < t1; t += 1) {
        const tb = Math.min(t + 1, t1), pb = dl(tb);
        // 新月: 差が −π 側から +π 側へ 0 をまたぐ (π のまたぎと区別する)。
        // 新月そのものは一覧に出さない (空に見えるものが無い) — 日食の起点にだけ使う
        if (pa < 0 && pb >= 0 && pb - pa < Math.PI) {
          const ec = evSolarSearch(evRoot(dl, t, tb));
          if (ec) push(ec);
        }
        // 満月: 差が π をまたぐ (evWrap の値が +π 付近から −π 付近へ飛ぶ)
        if (pa > 0 && pb < 0 && pa - pb > Math.PI) {
          const g = (t2) => evWrap(evLon(MOON, t2, tmp) - lonSun(t2) - Math.PI);
          const tf = evRoot(g, t, tb);
          moonGeoEclKm(tf, _evB);   // 距離を控えて、その年いちばん大きい/小さい満月の印に使う
          push({ t: tf, kind: "fullmoon", key: "moon", view: "ground", data: { km: evLen(_evB) } });
          const ec = evLunarSearch(tf);
          if (ec) push(ec);
        }
        pa = pb;
      }
    }

    // ---- 衝 (外惑星)。地球を挟んで太陽の反対に来る = 一晩中見える ----
    // 太陽の見かけの動きのほうが速いので、離角は減る向きに 180° を通る。
    // 向きを決め打ちせず、|変化| が π 未満の符号反転だけを拾う (π 未満に
    // 限るのは、evWrap の折り返しを 0 の通過と取り違えないため)
    // 小惑星は入れない: 軌道上の位相 (L0) が概略で、衝の日付が実際と月単位でずれる
    // (2026-09-03 にケレス・ベスタで確かめた)
    for (const k of ["mars", "jupiter", "saturn", "uranus", "neptune"]) {
      const b = PLANETS.find((p) => p.key === k);
      const f = (t) => evWrap(evLon(b, t, tmp) - lonSun(t) - Math.PI);
      let pa = f(t0);
      for (let t = t0; t < t1; t += 2) {
        const tb = Math.min(t + 2, t1), pb = f(tb);
        if ((pa < 0) !== (pb < 0) && Math.abs(pb - pa) < Math.PI) {
          push({ t: evRoot(f, t, tb), kind: "opposition", key: k, view: "ground" });
        }
        pa = pb;
      }
    }

    // ---- 最大離角 (水星・金星)。太陽から最も離れる = いちばん見つけやすい ----
    for (const k of ["mercury", "venus"]) {
      const b = PLANETS.find((p) => p.key === k);
      const el = (t) => { evGeo(b, t, _evE); evGeo(SUN, t, tmp); return evAng(_evE, tmp); };
      let e0 = el(t0 - 2), e1 = el(t0);
      for (let t = t0; t < t1; t += 2) {
        const tb = Math.min(t + 2, t1), e2 = el(tb);
        if (e1 > e0 && e1 >= e2) {
          const tp = evPeak(el, t - 2, tb);
          evGeo(b, tp, _evE);
          const east = evWrap(Math.atan2(_evE[1], _evE[0]) - lonSun(tp)) > 0;
          push({ t: tp, kind: "elongation", key: k, view: "ground",
                 data: { deg: el(tp) / DEG, east } });
        } else if (e1 < e0 && e1 <= e2) {
          // 離角の極小 = 合。内合 (太陽より手前) で太陽面の中に入れば太陽面通過
          const tp = evPeak((t2) => -el(t2), t - 2, tb);
          const dp = evLen(evGeo(b, tp, _evE)), ds = evLen(evGeo(SUN, tp, tmp));
          const rs = Math.asin(SUN.rkm / (ds * AU_KM)), rp = Math.asin(b.rkm / (dp * AU_KM));
          if (dp < ds && el(tp) < rs + rp) {
            push({ t: tp, kind: "transit", key: k, view: "ground",
                   data: { up: evAlt(SUN, tp) > 0 } });
          }
        }
        e0 = e1; e1 = e2;
      }
    }

    // ---- 二至二分 (その日の分点で測った太陽黄経が 0 / 90 / 180 / 270° になる瞬間) ----
    {
      const pLon = (t) => lonSun(t) + EV_PREC * (t / 36525) + EV_ABERR;
      for (let q = 0; q < 4; q++) {
        const f = (t) => evWrap(pLon(t) - q * Math.PI / 2);
        let pa = f(t0);
        for (let t = t0; t < t1; t += 2) {
          const tb = Math.min(t + 2, t1), pb = f(tb);
          if (pa < 0 && pb >= 0 && pb - pa < Math.PI) {
            push({ t: evRoot(f, t, tb), kind: "season", key: "sun", view: "ground", data: { q } });
          }
          pa = pb;
        }
      }
    }

    // ---- 地球の近日点・遠日点 ----
    // 軌道要素は地球・月の重心のもの。地球そのものは月に引かれて重心のまわりを
    // 回っているので、そのぶんを戻さないと日付が1日ずれる
    {
      const r = (t) => {
        keplerAU(EARTH_B, t, tmp); moonGeoEclKm(t, _evE);
        return Math.hypot(tmp[0] - EV_MOON_F * _evE[0] / AU_KM, tmp[1] - EV_MOON_F * _evE[1] / AU_KM,
                          tmp[2] - EV_MOON_F * _evE[2] / AU_KM);
      };
      evScanExtrema(r, t0, t1, 5, (tp, isMax) => {
        push({ t: tp, kind: "apsis", key: "sun", view: "ground", data: { far: isMax, au: r(tp) } });
      });
    }

    // ---- 彗星の近日点通過と、地球への最接近 ----
    // 地心距離の極小は、地球の公転のせいで遠くにいても毎年できる。近いときだけ拾う。
    // 他と同じく地上ビューで見せる (コマと尾は地上ビューでも描く。近日点は太陽に
    // 近くて暗い空に出ないことが多いが、その場合はその瞬間へ飛ぶ)
    for (const b of PLANETS) {
      if (!b.comet) continue;
      const rs = (t) => { keplerAU(b, t, tmp); return evLen(tmp); };
      evScanExtrema(rs, t0, t1, 5, (tp, isMax) => {
        if (!isMax) push({ t: tp, kind: "perihelion", key: b.key, view: "ground", data: { au: rs(tp) } });
      });
      const rg = (t) => evLen(evGeo(b, t, tmp));
      evScanExtrema(rg, t0, t1, 2, (tp, isMax) => {
        const d = rg(tp);
        if (!isMax && d < 1.5) push({ t: tp, kind: "closest", key: b.key, view: "ground", data: { au: d } });
      });
    }

    // ---- 留 (逆行の始まり・終わり)。地心黄経の進みが 0 になる瞬間 ----
    // 外惑星だけ。水星・金星の留は太陽に近すぎて見せるものが無い
    for (const k of ["mars", "jupiter", "saturn"]) {
      const b = PLANETS.find((p) => p.key === k);
      const rate = (t) => evWrap(evLon(b, t + 0.5, tmp) - evLon(b, t - 0.5, tmp));
      let ra = rate(t0);
      for (let t = t0; t < t1; t += 2) {
        const tb = Math.min(t + 2, t1), rb = rate(tb);
        if ((ra < 0) !== (rb < 0)) {
          push({ t: evRoot(rate, t, tb), kind: "station", key: k, view: "ground", data: { retro: rb < 0 } });
        }
        ra = rb;
      }
    }

    // ---- 月による惑星の掩蔽 ----
    // 見かけが近いだけの「接近」は載せない (距離はまったく縮まらないので誤解を招く)。
    // 月の縁に実際に隠れるものだけ。まず地心の離角で通過を見つけ (1日刻みで十分)、
    // その前後を観測地の離角で詰め直す。観測地の離角は日周視差で1日周期の波が乗る
    // ので、最初からそれで極小を探すと、同じ通過が何度も拾われる
    {
      const keys = ["mercury", "venus", "mars", "jupiter", "saturn"];
      for (const k of keys) {
        const b = PLANETS.find((p) => p.key === k);
        const sepG = (t) => { evGeo(MOON, t, _evE); evGeo(b, t, tmp); return evAng(_evE, tmp); };
        evScanExtrema(sepG, t0, t1, 1, (tg, isMax) => {
          if (isMax || sepG(tg) > 3 * DEG) return;
          // 観測地での極小: 5分刻みで最も近い時刻を探し、その前後を詰める
          let best = null;
          for (let t = tg - 0.5; t <= tg + 0.5; t += 1 / 288) {
            const c = evMoonSep(b, t);
            if (!best || c.sep < best.sep) best = { t, sep: c.sep };
          }
          const tp = evPeak((t) => -evMoonSep(b, t).sep, best.t - 1 / 288, best.t + 1 / 288);
          const c = evMoonSep(b, tp);
          if (c.sep >= c.rMoon) return;
          // 太陽に近すぎるものは落とす (昼の空で、月も惑星も見えない)
          evGeo(b, tp, _evE); evGeo(SUN, tp, tmp);
          if (evAng(_evE, tmp) / DEG < 15) return;
          push({ t: tp, kind: "occult", key: k, view: "ground",
                 data: { up: evAlt(b, tp) > 0 } });
        });
      }
    }

    // ---- 流星群の極大 (太陽黄経が決まった値になる瞬間) ----
    for (const s of SHOWERS) {
      if (s.key === "sporadic") continue;
      const f = (t) => evWrap(lonSun(t) - s.sl * DEG);
      let pa = f(t0);
      for (let t = t0; t < t1; t += 2) {
        const tb = Math.min(t + 2, t1), pb = f(tb);
        if (pa < 0 && pb >= 0 && pb - pa < Math.PI) {
          push({ t: evRoot(f, t, tb), kind: "shower", key: s.key, view: "ground" });
        }
        pa = pb;
      }
    }

    out.sort((a, b) => a.t - b.t);
    return out;
  }

  // 流星群の放射点の高度 [rad] (赤経赤緯から直接)
  function evRadiantAlt(key, t) {
    const s = SHOWERS.find((x) => x.key === key);
    if (!s) return -1;
    const lst = (((280.46061837 + 360.98564736629 * t) % 360 + 360) % 360 + obsLon) * DEG;
    // 放射点は J2000。時角はその日の恒星時と比べるので歳差ぶんを掛けて揃える
    const ra0 = s.ra * DEG, dc0 = s.dec * DEG;
    precessTo(t, Math.cos(dc0) * Math.cos(ra0), Math.cos(dc0) * Math.sin(ra0), Math.sin(dc0), _evP);
    const H = lst - Math.atan2(_evP[1], _evP[0]), dec = Math.asin(_evP[2]), la = obsLat * DEG;
    return Math.asin(Math.max(-1, Math.min(1,
      Math.sin(dec) * Math.sin(la) + Math.cos(dec) * Math.cos(la) * Math.cos(H))));
  }

  // イベントを「実際に見える時刻」へずらす。衝や最大離角の瞬間は昼に来ることが
  // 多く、その時刻へ飛ぶと地平線の下を向いてしまう。前後半日から「空が暗くて
  // いちばん高い」時刻を選ぶ (食だけは瞬間そのものが見せ場なのでずらさない)
  function evViewTime(ev) {
    const k = ev.kind;
    // 食・太陽面通過・掩蔽は瞬間そのものが見せ場なのでずらさない
    if (k === "solarEclipse" || k === "lunarEclipse" || k === "transit" || k === "occult") return ev.t;
    const alt = k === "shower"
      ? (t) => evRadiantAlt(ev.key, t)
      : (t) => evAlt(BODY_BY_KEY.get(ev.key), t);
    // 太陽そのもの (二至二分・近日点) は南中で見せる
    if (ev.key === "sun") {
      let best = null;
      for (let t = ev.t - 0.5; t <= ev.t + 0.5; t += 1 / 288) {
        const a = alt(t);
        if (!best || a > best.a) best = { t, a };
      }
      return best.t;
    }
    let best = null;
    for (let t = ev.t - 0.75; t <= ev.t + 0.75; t += 1 / 288) {   // 5分刻み
      if (evAlt(SUN, t) > -8 * DEG) continue;      // 薄明が残るうちは見えない
      const a = alt(t);
      if (!best || a > best.a) best = { t, a };
    }
    return best && best.a > 0 ? best.t : ev.t;
  }

  // 新月の前後を細かく見て、観測地での日食の最大の瞬間を探す
  function evSolarSearch(tNew) {
    let best = null;
    for (let t = tNew - 0.25; t <= tNew + 0.25; t += 1 / 720) {   // 2分刻み
      const c = evSolarLocal(t);
      if (!best || c.mag > best.mag) best = { t, mag: c.mag };
    }
    if (!best || best.mag <= 0) return null;
    // 極大を詰める
    const tp = evPeak((t) => evSolarLocal(t).mag, best.t - 1 / 720, best.t + 1 / 720);
    const c = evSolarLocal(tp);
    if (c.mag <= 0) return null;
    const type = !c.central ? "partial" : (c.total ? "total" : "annular");
    return { t: tp, kind: "solarEclipse", key: "sun", view: "ground",
             data: { type, mag: c.mag, up: evAlt(SUN, tp) > 0 } };
  }

  // 満月の前後を細かく見て、月食の最大の瞬間 (影の軸に最も近づく時刻) を探す。
  // 遮蔽率で探すと、皆既のあいだは 1 で頭打ちになって「いつが最大か」が
  // 決まらない。離角そのものを見れば、皆既の最中でも中心が一意に決まる
  function evLunarSearch(tFull) {
    let best = null;
    for (let t = tFull - 0.25; t <= tFull + 0.25; t += 1 / 288) {   // 5分刻み
      const c = evLunar(t);
      if (!best || c.sep < best.c.sep) best = { t, c };
    }
    if (!best || best.c.covMax <= 0) return null;
    const tp = evPeak((t) => -evLunar(t).sep, best.t - 1 / 288, best.t + 1 / 288);
    const c = evLunar(tp);
    if (c.covMax <= 0) return null;
    const type = c.covMin >= 1 ? "total" : (c.covMax >= 1 ? "partial" : "penumbral");
    return { t: tp, kind: "lunarEclipse", key: "moon", view: "ground",
             data: { type, up: evAlt(MOON, tp) > 0 } };
  }
