  // ---------- 選択 ----------
  const infoPanel = document.getElementById("info");
  const navEl = document.getElementById("nav");

  // 選択中の天体をもう一度押したとき。注視先はそのままに、選択の飾り
  // (オレンジの枠と説明パネル) だけを出し入れする。寄って眺めるときに、
  // 見たい面へ枠と文字が重なるのを避けるため。解除は何もない所を押す
  function toggleSelChrome(body) {
    showSelMark = !showSelMark;
    if (showSelMark) openInfo(body);
    else infoPanel.classList.remove("open");
  }
  function select(body, fly) {
    selected = body;
    updateNavSel();
    if (!body) {
      infoPanel.classList.remove("open");
      return;
    }
    openInfo(body);
    // 子天体を直接選択したときは親グループを展開し、リスト内に見えるようスクロール
    EXPAND_BY_CHILD.get(body.key)?.();
    const navBtn = navEl.querySelector('button.body[data-key="' + body.key + '"]');
    if (navBtn) navBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (fly && groundView) {
      // 地上ビュー中はカメラ飛行の代わりに、その天体の方向へ視点を向ける
      aimGroundAt(body);
    } else if (fly) {
      // 天体からの接近距離 (km)。サイズに応じて調整、未指定は10万km
      const zoomKm = {
        mercury: 50000, moon: 30000, mars: 50000,
        phobos: 300, deimos: 300,
        jupiter: 700000, io: 30000, europa: 30000, ganymede: 50000, callisto: 50000,
        saturn: 700000, titan: 50000,
        uranus: 500000, titania: 20000,
        neptune: 500000, triton: 30000,
        pluto: 30000, charon: 20000,
        ceres: 10000, vesta: 10000, pallas: 10000, juno: 10000,
        halley: 300,
      };
      cam.distTgt = body === SUN
        ? bodyR(SUN) * 4.2
        : Math.max(bodyR(body) * 2.2, (zoomKm[body.key] || 100000) * KM2W);
      if (body !== SUN) {
        // 太陽光の当たる側 (太陽と天体の間) へ回り込む
        const w = posW.get(body.key);
        const l = Math.hypot(w[0], w[1], w[2]) || 1;
        const d = [-w[0] / l, -w[1] / l, -w[2] / l];
        cam.yawTgt = Math.atan2(d[2], d[0]) + 0.5;
        cam.pitchTgt = Math.asin(Math.max(-1, Math.min(1, d[1]))) + 0.22;
      }
    }
    if (body === SUN) { cam.focusTgt[0] = 0; cam.focusTgt[1] = 0; cam.focusTgt[2] = 0; }
    resetPan();   // 天体を選んだら平行移動をリセットして中心に据える
    hideHint();
  }

  // モバイル: 情報パネルを操作パネルのすぐ上に配置 (実高さを測って追従)。
  // 横持ちは右側の情報パネルが中央寄せの操作パネルと重ならないよう高さを制限
  function positionInfoPanel() {
    const ctrlHidden = document.getElementById("app").classList.contains("ctrlHidden");
    if (window.matchMedia("(max-width: 720px)").matches) {
      infoPanel.style.maxHeight = "";
      if (ctrlHidden) {
        infoPanel.style.bottom = "12px";   // パネル格納中は画面下端まで使う
        return;
      }
      const top = document.getElementById("controls").getBoundingClientRect().top;
      infoPanel.style.bottom = Math.round(window.innerHeight - top + 8) + "px";
    } else if (window.matchMedia("(max-height: 480px)").matches) {
      infoPanel.style.bottom = "";
      if (ctrlHidden) { infoPanel.style.maxHeight = ""; return; }
      const ctlTop = document.getElementById("controls").getBoundingClientRect().top;
      const infoTop = infoPanel.getBoundingClientRect().top;
      infoPanel.style.maxHeight = Math.max(120, Math.round(ctlTop - infoTop - 8)) + "px";
    } else {
      infoPanel.style.bottom = "";
      infoPanel.style.maxHeight = "";
    }
  }
  window.addEventListener("resize", positionInfoPanel);

  // 操作パネルの折りたたみ (⌄ で画面下へ格納、⌃ で復帰)
  const ctrlCollapseBtn = document.getElementById("ctrlCollapse");
  const ctrlExpandBtn = document.getElementById("ctrlExpand");
  function setCtrlVisible(v) {
    document.getElementById("app").classList.toggle("ctrlHidden", !v);
    positionInfoPanel();
    setTimeout(positionInfoPanel, 300);   // スライドアニメーション後に再計測
  }
  ctrlCollapseBtn.addEventListener("click", () => setCtrlVisible(false));
  ctrlExpandBtn.addEventListener("click", () => setCtrlVisible(true));

  // ---------- 地球からの観測モード (クライアント計算, 近似) ----------
  const ECL = 23.4393 * DEG, RS_RATE = 15.041;   // 黄道傾斜, 時角の進み (度/時)
  // 土星の自転軸 (環の法線) の実方向: 赤経40.589°・赤緯83.537° (ICRF)。
  // 環の見かけの開閉 (約15年周期で真横⇄最大±27°) を正しく再現するために使う
  const SATURN_POLE_W = (() => {
    const ra = 40.589 * DEG, dec = 83.537 * DEG;
    const xq = Math.cos(dec) * Math.cos(ra), yq = Math.cos(dec) * Math.sin(ra), zq = Math.sin(dec);
    const ye = yq * Math.cos(ECL) + zq * Math.sin(ECL);    // 赤道 → 黄道
    const ze = -yq * Math.sin(ECL) + zq * Math.cos(ECL);
    return [xq, ze, -ye];                                   // 黄道 → ワールド (toWorld と同じ軸対応)
  })();
  // 極方向を y 軸とする回転行列 (土星の本体・環のモデル用。x/z は軸対称なので任意)
  const SAT_ROT = (() => {
    const A = SATURN_POLE_W;
    let xx = -A[2], xz = A[0];
    const xl = Math.hypot(xx, xz) || 1; xx /= xl; xz /= xl;
    const o = new Float32Array(16);
    o[0] = xx; o[1] = 0; o[2] = xz;
    o[4] = A[0]; o[5] = A[1]; o[6] = A[2];
    o[8] = -xz * A[1]; o[9] = xz * A[0] - xx * A[2]; o[10] = xx * A[1];
    o[15] = 1;
    return o;
  })();
  let obsLat = parseFloat(localStorage.getItem("ssLat"));
  let obsLon = parseFloat(localStorage.getItem("ssLon"));
  if (!isFinite(obsLat) || !isFinite(obsLon)) { obsLat = 35.68; obsLon = 139.69; }   // 既定: 東京
  const CITIES = [
    { ja: "東京", en: "Tokyo", lat: 35.68, lon: 139.69 },
    { ja: "ニューヨーク", en: "New York", lat: 40.71, lon: -74.01 },
    { ja: "ロンドン", en: "London", lat: 51.51, lon: -0.13 },
    { ja: "パリ", en: "Paris", lat: 48.85, lon: 2.35 },
    { ja: "北京", en: "Beijing", lat: 39.90, lon: 116.41 },
    { ja: "シンガポール", en: "Singapore", lat: 1.35, lon: 103.82 },
    { ja: "ロサンゼルス", en: "Los Angeles", lat: 34.05, lon: -118.24 },
    { ja: "ホノルル", en: "Honolulu", lat: 21.31, lon: -157.86 },
    { ja: "シドニー", en: "Sydney", lat: -33.87, lon: 151.21 },
    { ja: "リオデジャネイロ", en: "Rio de Janeiro", lat: -22.91, lon: -43.17 },
    { ja: "ケープタウン", en: "Cape Town", lat: -33.92, lon: 18.42 },
    { ja: "レイキャビク", en: "Reykjavík", lat: 64.15, lon: -21.94 },
  ];
  // 視等級モデル (V = 基準 + 5log10(rΔ) + 位相項, i = 位相角[度]) — 主要天体のみ
  const MAG = {
    mercury: (r, D, i) => -0.42 + 5*Math.log10(r*D) + 0.038*i - 0.000273*i*i + 2e-6*i*i*i,
    venus:   (r, D, i) => -4.40 + 5*Math.log10(r*D) + 0.0009*i + 0.000239*i*i - 6.5e-7*i*i*i,
    mars:    (r, D, i) => -1.52 + 5*Math.log10(r*D) + 0.016*i,
    jupiter: (r, D, i) => -9.40 + 5*Math.log10(r*D) + 0.005*i,
    saturn:  (r, D, i) => -8.88 + 5*Math.log10(r*D) + 0.044*Math.abs(i),   // 環は無視した近似
    uranus:  (r, D)    => -7.19 + 5*Math.log10(r*D),
    neptune: (r, D)    => -6.87 + 5*Math.log10(r*D),
    moon:    (r, D, i) => 0.23 + 5*Math.log10(r*D) + 0.026*Math.abs(i) + 4e-9*i*i*i*i,
  };
  // world 座標 → 黄道 AU (toWorld の逆)
  const _he = [0,0,0], _ge = [0,0,0], _ea = [0,0,0], _gw = [0,0,0], _pv = [0,0,0];
  function wEcl(w, out) { out[0] = w[0]/K_REAL; out[1] = -w[2]/K_REAL; out[2] = w[1]/K_REAL; return out; }
  const gmstDeg = (days) => (((280.46061837 + 360.98564736629*days) % 360) + 360) % 360;

  // 時角の進み [度/時]。恒星時の進み (RS_RATE) から、その天体自身の赤経の
  // 動きを引いたもの。太陽はこれでちょうど 15.000 になる — 平均太陽日の定義
  // そのもので、恒星時の進みのまま使うと日の入りが約1分早く出ていた。
  // 月は赤経が 1時間に 0.55° 進むので 14.5 前後になり、ここが最大15分効く
  const _hr = [0,0,0];
  const geoRaDeg = (b, t) => {
    evGeo(b, t, _hr);
    return Math.atan2(_hr[1] * Math.cos(ECL) - _hr[2] * Math.sin(ECL), _hr[0]) / DEG;
  };
  function haRate(body) {
    // 衛星は母惑星と一緒に動く (自分の公転ぶんは母惑星までの距離に比べて小さい)
    const b = (body === MOON || !body.parent) ? body : BODY_BY_KEY.get(body.parent);
    // 位置を任意の時刻で出せない相手 (探査機・地球そのもの) は恒星時の進みのまま
    if (!b || b === BODY_BY_KEY.get("earth") || !(b === SUN || b === MOON || b.a !== undefined)) {
      return RS_RATE;
    }
    const dt = 0.25;                                  // ±6時間の中央差分
    let d = geoRaDeg(b, simDays + dt) - geoRaDeg(b, simDays - dt);
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    return Math.max(1, RS_RATE - d / (2 * dt * 24));
  }
  function computeObs(body) {
    const b = posW.get(body.key), e = posW.get("earth");
    _gw[0] = b[0]-e[0]; _gw[1] = b[1]-e[1]; _gw[2] = b[2]-e[2];
    wEcl(_gw, _ge);                                         // 地心黄道 (J2000)
    // 黄道 (J2000) → 赤道 (J2000) → その日の平均分点。時角はその日のグリニッジ
    // 恒星時と比べるので、赤経赤緯もその日の分点へ揃えないと空全体がずれる
    precessTo(simDays,
      _ge[0],
      _ge[1] * Math.cos(ECL) - _ge[2] * Math.sin(ECL),
      _ge[1] * Math.sin(ECL) + _ge[2] * Math.cos(ECL), _pv);
    // 測心視差補正: 観測者は地心ではなく地表にいる (月では最大約1°の差)。
    // 観測地はその日の分点でそのまま書けるので、赤道座標のまま引く
    const lst = (gmstDeg(simDays) + obsLon) * DEG, latR = obsLat * DEG;
    {
      const RE = 6378.14 / AU_KM;
      _pv[0] -= RE * Math.cos(latR) * Math.cos(lst);
      _pv[1] -= RE * Math.cos(latR) * Math.sin(lst);
      _pv[2] -= RE * Math.sin(latR);
    }
    const D = Math.hypot(_pv[0], _pv[1], _pv[2]);
    const ra = Math.atan2(_pv[1], _pv[0]), dec = Math.asin(_pv[2] / D);
    const lat = obsLat * DEG, H = lst - ra;
    // 高度は大気差を入れた「見かけの高度」を返す。地上ビューの描画・照準・
    // 「地平線下」の判定はすべてこちらを使う (出没時刻は h0 に大気差が
    // 織り込み済みなので、下の計算は真高度のまま dec と H から解く)
    const altGeo = Math.asin(Math.max(-1, Math.min(1, Math.sin(dec)*Math.sin(lat) + Math.cos(dec)*Math.cos(lat)*Math.cos(H))));
    const alt = altGeo + refractRad(altGeo);
    const A = Math.atan2(Math.sin(H), Math.cos(H)*Math.sin(lat) - Math.tan(dec)*Math.cos(lat));
    let az = (A/DEG + 180) % 360; if (az < 0) az += 360;
    // 日心距離・位相・視等級
    wEcl(b, _he); const r = Math.hypot(_he[0], _he[1], _he[2]);
    wEcl(e, _ea); const R = Math.hypot(_ea[0], _ea[1], _ea[2]);
    let phaseAng = 0;
    if (r > 1e-6 && D > 1e-6) phaseAng = Math.acos(Math.max(-1, Math.min(1, (r*r + D*D - R*R)/(2*r*D))));
    const illum = (1 + Math.cos(phaseAng)) / 2;
    let mag = body === SUN ? -26.7 : (MAG[body.key] ? MAG[body.key](r, D, phaseAng/DEG) : null);
    const sizeAS = 2 * body.rkm / (D * AU_KM) / DEG * 3600;
    let elong = 0;
    if (body !== SUN) {
      // 離角は地心で見るので、距離も地心のもの (D は測心)
      const Dg = Math.hypot(_ge[0], _ge[1], _ge[2]);
      const dp = -(_ge[0]*_ea[0] + _ge[1]*_ea[1] + _ge[2]*_ea[2]);   // 太陽の地心方向 = -地球日心
      elong = Math.acos(Math.max(-1, Math.min(1, dp/(Dg*R)))) / DEG;
    }
    // 出没・南中 (瞬時の赤経赤緯で近似)。時角の進みは天体ごとに違う — 恒星時の
    // 進みから、その天体自身の赤経の動きを引いたもの
    const rate = haRate(body);
    const Hn = ((H/DEG + 180) % 360 + 360) % 360 - 180;
    const transitMs = J2000 + simDays*DAY_MS - (Hn / rate) * 3600e3;
    const h0 = body === SUN ? -0.833 : (body.key === "moon" ? 0.125 : -0.567);
    const cosH0 = (Math.sin(h0*DEG) - Math.sin(lat)*Math.sin(dec)) / (Math.cos(lat)*Math.cos(dec));
    let rise = 0, set = 0, circ = 0;
    if (cosH0 < -1) circ = 1; else if (cosH0 > 1) circ = -1;
    else { const H0 = Math.acos(cosH0)/DEG; rise = transitMs - H0/rate*3600e3; set = transitMs + H0/rate*3600e3; }
    return { alt: alt/DEG, az, distAU: D, illum, mag, sizeAS, elong, transitMs, rise, set, circ };
  }
  const fmtHM = clockHM;   // 時計と同じ基準 (端末/地方時/UTC) で出す
  function fmtGeoDist(au) {
    const km = au * AU_KM;
    const kmStr = distUnit === "mi" ? Math.round(km/KM_PER_MI).toLocaleString("en-US") + " mi"
                                    : Math.round(km).toLocaleString("en-US") + " km";
    return au.toFixed(3) + " au (" + kmStr + ")";
  }
  function obsContent(body) {
    const o = T().obs;
    if (body.key === "earth") return { rows: "", fact: o.earth };
    const c = computeObs(body);
    const dir = o.dirs[Math.round(c.az/45) % 8];
    const rows = [[o.loc, siteLabel()]];               // 観測地 (変更は地上ビューのチップから)
    rows.push([o.az, c.az.toFixed(0) + "° (" + dir + ")"]);
    rows.push([o.alt, c.alt.toFixed(1) + "°" + (c.alt < 0 ? " (" + o.below + ")" : "")]);
    const rs = (t, other) => c.circ === 1 ? o.noSet : c.circ === -1 ? o.noRise : fmtHM(t);
    rows.push([o.rise, rs(c.rise)]);
    rows.push([o.transit, fmtHM(c.transitMs)]);
    rows.push([o.set, rs(c.set)]);
    if (c.mag != null) rows.push([o.mag, (c.mag >= 0 ? "+" : "") + c.mag.toFixed(1)]);
    rows.push([o.phase, Math.round(c.illum*100) + "%"]);
    rows.push([o.size, c.sizeAS >= 120 ? (c.sizeAS/60).toFixed(1) + "′" : c.sizeAS.toFixed(1) + "″"]);
    if (body !== SUN) rows.push([o.elong, c.elong.toFixed(0) + "°"]);
    rows.push([o.dist, fmtGeoDist(c.distAU)]);
    return {
      rows: rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join(""),
      fact: c.alt >= 0 ? o.seenIn(dir, c.alt.toFixed(0)) : o.seenBelow,
    };
  }

  let infoTab = "facts", currentInfoBody = null, lastObsStr = "";
  const tabFactsBtn = document.getElementById("tabFacts");
  const tabObsBtn = document.getElementById("tabObs");
  const obsCity = document.getElementById("obsCity");
  const obsLatInput = document.getElementById("obsLat");
  const obsLonInput = document.getElementById("obsLon");
  const obsNSBtn = document.getElementById("obsNS");
  const obsEWBtn = document.getElementById("obsEW");
  const obsGeoBtn = document.getElementById("obsGeo");
  function syncCitySelect() {
    let idx = -1;
    for (let i = 0; i < CITIES.length; i++) {
      if (Math.abs(CITIES[i].lat - obsLat) < 0.02 && Math.abs(CITIES[i].lon - obsLon) < 0.02) { idx = i; break; }
    }
    obsCity.value = String(idx);
  }
  function rebuildCitySelect() {
    const o = T().obs;
    obsCity.innerHTML = '<option value="-1">' + o.custom + "</option>" +
      CITIES.map((c, i) => '<option value="' + i + '">' + (lang === "ja" ? c.ja : c.en) + "</option>").join("");
    syncCitySelect();
  }

  function renderInfoBody() {
    const body = currentInfoBody;
    if (!body) return;
    // 「地球から見る」は地球の観測地からの見え方なので、月面ビューではタブ自体を
    // 隠している。選択状態が obs のまま残ると、月に立っているのに東京基準の
    // 方位・高度が出てしまうため (地球を選ぶと「観測地点そのものです」も出る)
    if (surfaceBody === "moon" && infoTab === "obs") infoTab = "facts";
    positionInfoPanel();
    const t = T();
    document.getElementById("infoEyebrow").textContent = lang === "ja" ? body.en : body.name;
    document.getElementById("infoName").textContent = bName(body);
    tabFactsBtn.textContent = t.obs.tabFacts;
    tabObsBtn.textContent = t.obs.tabObs;
    tabFactsBtn.classList.toggle("on", infoTab === "facts");
    tabObsBtn.classList.toggle("on", infoTab === "obs");
    const credEl = document.getElementById("infoCredit");
    if (infoTab === "obs") {
      const r = obsContent(body);
      document.getElementById("infoRows").innerHTML = r.rows;
      document.getElementById("infoFact").textContent = r.fact;
      credEl.textContent = body.key === "earth" ? "" : t.obs.note;
      lastObsStr = r.rows;
    } else {
      const d = lang === "en" ? EN_DATA[body.key] : null;
      document.getElementById("infoRows").innerHTML =
        (d ? d.rows : body.rows).map(([kk, v]) => `<tr><td>${kk}</td><td>${v}</td></tr>`).join("");
      document.getElementById("infoFact").textContent = d ? d.fact : body.fact;
      const cr = IMG_CREDIT[body.key];
      credEl.textContent = cr
        ? t.imgPrefix + cr + (MONO_TEX.has(body.key) ? t.monoTex : "")
        : t.procTex;
    }
  }
  function openInfo(body) { currentInfoBody = body; renderInfoBody(); infoPanel.classList.add("open"); }
  // 観測モード表示中は時間経過に合わせて数値を更新
  function updateObs() {
    // 月面ビューへ切り替えただけでは情報パネルは再描画されないので、
    // 表示中の「地球から見る」がそのまま残る。ここで基本情報へ戻す
    if (surfaceBody === "moon" && infoTab === "obs" && currentInfoBody) {
      renderInfoBody();
      return;
    }
    if (infoTab !== "obs" || !currentInfoBody || currentInfoBody.key === "earth") return;
    if (!infoPanel.classList.contains("open")) return;
    const r = obsContent(currentInfoBody);
    if (r.rows !== lastObsStr) {
      document.getElementById("infoRows").innerHTML = r.rows;
      document.getElementById("infoFact").textContent = r.fact;
      lastObsStr = r.rows;
    }
  }
  tabFactsBtn.addEventListener("click", () => { infoTab = "facts"; renderInfoBody(); });
  tabObsBtn.addEventListener("click", () => { infoTab = "obs"; renderInfoBody(); });
  function setObsSite(lat, lon) {
    obsLat = lat; obsLon = lon;
    localStorage.setItem("ssLat", String(lat));
    localStorage.setItem("ssLon", String(lon));
    lastObsStr = "";
    refreshObsSiteUI();
    if (infoTab === "obs" && currentInfoBody) renderInfoBody();
    refreshSkyCal(true);   // 食が見えるかどうかは観測地で変わる
  }
  function applyObsInputs() {
    const la = Math.min(90, Math.abs(parseFloat(obsLatInput.value) || 0));
    const lo = Math.min(180, Math.abs(parseFloat(obsLonInput.value) || 0));
    setObsSite(la * (obsNSBtn.dataset.h === "S" ? -1 : 1), lo * (obsEWBtn.dataset.h === "W" ? -1 : 1));
  }
  obsLatInput.addEventListener("change", applyObsInputs);
  obsLonInput.addEventListener("change", applyObsInputs);
  obsNSBtn.addEventListener("click", () => { obsNSBtn.dataset.h = obsNSBtn.dataset.h === "N" ? "S" : "N"; applyObsInputs(); });
  obsEWBtn.addEventListener("click", () => { obsEWBtn.dataset.h = obsEWBtn.dataset.h === "E" ? "W" : "E"; applyObsInputs(); });
  obsCity.addEventListener("change", () => {
    const i = parseInt(obsCity.value, 10);
    if (i >= 0) setObsSite(CITIES[i].lat, CITIES[i].lon);
  });
  obsGeoBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    obsGeoBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (p) => { obsGeoBtn.disabled = false; setObsSite(+p.coords.latitude.toFixed(3), +p.coords.longitude.toFixed(3)); },
      () => { obsGeoBtn.disabled = false; },
      { timeout: 8000, maximumAge: 600000 }
    );
  });

  // ---------- 観測地 (ハンバーガーメニュー内。タップでエディタを展開) ----------
  const obsSiteChip = document.getElementById("obsSiteChip");
  const obsSitePop = document.getElementById("obsSitePop");
  // 横持ちでは観測地チップをタイトルの右横へ並べる (縦を空けて天体リストを上げる)。
  // 置く位置はタイトルの右端で決まるが、その幅はアプリ名と言語で変わるので、
  // 決め打ちにせず実測して CSS へ渡す
  const titleEl = document.getElementById("title");
  function placeObsSite() {
    document.documentElement.style.setProperty(
      "--titleR", Math.round(titleEl.getBoundingClientRect().right) + "px");
  }
  window.addEventListener("resize", placeObsSite);
  placeObsSite();
  function siteLabel() {
    const o = T().obs;
    for (const c of CITIES) {
      if (Math.abs(c.lat - obsLat) < 0.02 && Math.abs(c.lon - obsLon) < 0.02) return lang === "ja" ? c.ja : c.en;
    }
    return Math.abs(obsLat).toFixed(1) + "°" + (obsLat >= 0 ? o.N : o.S) + " " +
           Math.abs(obsLon).toFixed(1) + "°" + (obsLon >= 0 ? o.E : o.W);
  }
  function moonSiteLabel() {
    const s = MOON_SITES[+moonSiteEl.value] || MOON_SITES[0];
    return lang === "ja" ? s.ja : s.en;
  }
  function refreshObsSiteUI() {
    const t = T();
    obsSiteChip.textContent = surfaceBody === "moon"
      ? "🌙 " + t.obs.loc + ": " + moonSiteLabel()
      : "📍 " + t.obs.loc + ": " + siteLabel();
    obsGeoBtn.textContent = t.obs.geo;
    obsLatInput.value = Math.abs(obsLat).toFixed(2);
    obsLonInput.value = Math.abs(obsLon).toFixed(2);
    obsNSBtn.textContent = obsLat >= 0 ? t.obs.N : t.obs.S;
    obsNSBtn.dataset.h = obsLat >= 0 ? "N" : "S";
    obsEWBtn.textContent = obsLon >= 0 ? t.obs.E : t.obs.W;
    obsEWBtn.dataset.h = obsLon >= 0 ? "E" : "W";
    rebuildCitySelect();
    drawMoonMap();   // 方位ラベルの言語・ピン位置を反映
  }
  function setSitePop(open) {
    obsSitePop.hidden = !open;
    obsSiteChip.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) refreshObsSiteUI();
  }
  obsSiteChip.addEventListener("click", (e) => { e.stopPropagation(); setSitePop(obsSitePop.hidden); });
  // 観測地バーの外をクリックしたらエディタを閉じる
  document.addEventListener("pointerdown", (e) => {
    if (!obsSitePop.hidden && !document.getElementById("obsSiteBar").contains(e.target)) setSitePop(false);
  });
  // ✕ はパネルを閉じるだけで、選択 (カメラ追尾) は維持する
  document.getElementById("closeInfo").addEventListener("click", () => {
    infoPanel.classList.remove("open");
  });

  // ナビ (惑星の衛星、小惑星帯・彗星カテゴリは展開式)
  const NAV_BODIES = [SUN, ...PLANETS];
  const ALL_BODIES = [...NAV_BODIES, ...SATELLITES];
  // 探査機は天体リストや表示トグルの対象ではないが、ツアーの sel / spot /
  // sight から引けるようにキー表には入れる
  const BODY_BY_KEY = new Map([...ALL_BODIES, ...PROBES].map((b) => [b.key, b]));
  const SAT_BY_PARENT = new Map();
  for (const s of SATELLITES) {
    if (!SAT_BY_PARENT.has(s.parent)) SAT_BY_PARENT.set(s.parent, []);
    SAT_BY_PARENT.get(s.parent).push(s);
  }
  // 軌道・名前のトグルの絵。操作パネルの ctlIcon と同じ線画で揃える。
  // 記号 (◌ / N) では何のボタンか読み取れず、読み上げも記号のままになる
  const ICON_ORBIT =
    '<svg class="tglIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" ' +
    'stroke-width="1.15" aria-hidden="true"><ellipse cx="6" cy="6" rx="4.6" ry="2.7"/>' +
    '<circle cx="9.5" cy="4.3" r="1.15" fill="currentColor" stroke="none"/></svg>';
  const ICON_NAME =
    '<svg class="tglIcon" viewBox="0 0 12 12" fill="none" stroke="currentColor" ' +
    'stroke-width="1.15" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10.7 1.3H6.9L1.6 6.6 5.4 10.4 10.7 5.1V1.3Z"/>' +
    '<circle cx="8.75" cy="3.25" r="1" fill="currentColor" stroke="none"/></svg>';

  // 絵だけのボタンは、読み上げ名 (aria-label) とツールチップ (title) を言語が
  // 変わるたびに入れ直す。その名前の作り方をボタンと一緒に控えておく
  const ARIA_BTNS = [];            // { el, text() }
  function makeTglBtn(icon, ariaText, onClick) {
    const el = document.createElement("button");
    el.className = "tgl on";
    el.innerHTML = icon;
    el.setAttribute("aria-pressed", "true");
    el.addEventListener("click", onClick);
    ARIA_BTNS.push({ el, text: ariaText });
    return el;
  }

  // 一覧の上のまとめ切替。各行と同じ絵を語の左に添えて、絵の意味を結びつける
  function setMasterTgl(btn, icon, text) {
    btn.querySelector(".mtIcon").innerHTML = icon;
    btn.querySelector(".mtText").textContent = text;
  }

  const TOGGLE_BTNS = [];          // [body, 軌道トグル, 名前トグル]
  function makeNavRow(b, sub) {
    b.showOrbit = true;
    b.showLabel = true;
    const row = document.createElement("div");
    row.className = sub ? "row sub" : "row";
    const btn = document.createElement("button");
    btn.className = "body";
    btn.textContent = bName(b);
    btn.dataset.key = b.key;
    btn.addEventListener("click", () => {
      // ツアー中は選択を促しているステップだけ、しかもそのステップが選ばせる
      // 天体だけ通す (画面のタップと同じ扱い)
      if (tourActive && (!tourAllowsSelect() || !tourAllowsBody(b))) return;
      if (selected === b) toggleSelChrome(b);
      else { showSelMark = true; select(b, true); }
    });
    const ob = makeTglBtn(ICON_ORBIT, () => T().ariaOrbit(bName(b)),
                          () => { b.showOrbit = !b.showOrbit; syncToggleUI(); });
    const lb = makeTglBtn(ICON_NAME, () => T().ariaName(bName(b)),
                          () => { b.showLabel = !b.showLabel; syncToggleUI(); });
    row.appendChild(btn);
    row.appendChild(ob);
    row.appendChild(lb);
    TOGGLE_BTNS.push([b, ob, lb]);
    return row;
  }
  // カテゴリ (小惑星帯・彗星) — 衛星と同様の展開式グループにまとめる
  const NAV_CATS = [
    { ja: "小惑星帯", en: "Asteroid belt", after: "mars", match: (b) => b.ast },
    { ja: "彗星", en: "Comets", after: "pluto", match: (b) => b.comet },
  ];
  const CAT_BTNS = [];             // { btn, cat } — 言語切替用
  const CAT_TGLS = [];             // [children, 軌道トグル, 名前トグル]
  const EXPAND_BY_CHILD = new Map();  // 子天体キー → 親グループを展開する関数
  function makeCatGroup(cat, children) {
    const row = document.createElement("div");
    row.className = "row";
    const btn = document.createElement("button");
    btn.className = "body cat";
    btn.textContent = lang === "ja" ? cat.ja : cat.en;
    const catName = () => (lang === "ja" ? cat.ja : cat.en);
    const ex = document.createElement("button");
    ex.className = "tgl exp";
    ex.textContent = "▸";
    ex.setAttribute("aria-expanded", "false");
    ARIA_BTNS.push({ el: ex, text: () => T().ariaMembers(catName()) });
    // カテゴリの ◌/N は子をまとめて切り替える
    const ob = makeTglBtn(ICON_ORBIT, () => T().ariaOrbit(catName()), () => {
      const on = children.some((c) => c.showOrbit);
      for (const c of children) c.showOrbit = !on;
      syncToggleUI();
    });
    const lb = makeTglBtn(ICON_NAME, () => T().ariaName(catName()), () => {
      const on = children.some((c) => c.showLabel);
      for (const c of children) c.showLabel = !on;
      syncToggleUI();
    });
    row.appendChild(btn);
    row.appendChild(ex);
    row.appendChild(ob);
    row.appendChild(lb);
    navEl.appendChild(row);
    const childRows = children.map((s) => {
      const r2 = makeNavRow(s, true);
      r2.style.display = "none";
      navEl.appendChild(r2);
      return r2;
    });
    let expanded = false;
    const setExp = (v) => {
      expanded = v;
      ex.textContent = v ? "▾" : "▸";
      ex.setAttribute("aria-expanded", v ? "true" : "false");
      for (const r2 of childRows) r2.style.display = v ? "flex" : "none";
    };
    for (const c of children) EXPAND_BY_CHILD.set(c.key, () => setExp(true));
    ex.addEventListener("click", () => setExp(!expanded));
    btn.addEventListener("click", () => setExp(!expanded));
    CAT_BTNS.push({ btn, cat });
    CAT_TGLS.push([children, ob, lb]);
  }
  for (const b of NAV_BODIES) {
    if (b.ast || b.comet) continue;              // カテゴリ側にまとめる
    const row = makeNavRow(b, false);
    const sats = SAT_BY_PARENT.get(b.key);
    if (sats) {
      b.expanded = b.key === "earth";            // 地球のみ初期展開
      const ex = document.createElement("button");
      ex.className = "tgl exp";
      ex.textContent = b.expanded ? "▾" : "▸";
      ex.setAttribute("aria-expanded", b.expanded ? "true" : "false");
      ARIA_BTNS.push({ el: ex, text: () => T().ariaSats(bName(b)) });
      row.insertBefore(ex, row.children[1]);
      navEl.appendChild(row);
      const satRows = sats.map((s) => {
        const r2 = makeNavRow(s, true);
        r2.style.display = b.expanded ? "flex" : "none";
        navEl.appendChild(r2);
        return r2;
      });
      const setSatExp = (v) => {
        b.expanded = v;
        ex.textContent = v ? "▾" : "▸";
        ex.setAttribute("aria-expanded", v ? "true" : "false");
        for (const r2 of satRows) r2.style.display = v ? "flex" : "none";
      };
      ex.addEventListener("click", () => setSatExp(!b.expanded));
      for (const s of sats) EXPAND_BY_CHILD.set(s.key, () => setSatExp(true));
    } else {
      navEl.appendChild(row);
    }
    const cat = NAV_CATS.find((c) => c.after === b.key);
    if (cat) makeCatGroup(cat, NAV_BODIES.filter(cat.match));
  }
  // 絵だけのボタンの読み上げ名とツールチップ。天体名が言語で変わるので、
  // applyLang から呼び直す (作った時点では言語が確定していない行もある)
  function refreshNavAria() {
    for (const { el, text } of ARIA_BTNS) {
      const t = text();
      el.setAttribute("aria-label", t);
      el.title = t;
    }
  }
  // 見た目の on/off は色で、状態そのものは aria-pressed で伝える
  function setTgl(el, on) {
    el.classList.toggle("on", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
  }
  function syncToggleUI() {
    for (const [b, ob, lb] of TOGGLE_BTNS) {
      setTgl(ob, b.showOrbit);
      setTgl(lb, b.showLabel);
    }
    for (const [cs, ob, lb] of CAT_TGLS) {
      setTgl(ob, cs.some((c) => c.showOrbit));
      setTgl(lb, cs.some((c) => c.showLabel));
    }
    orbitsBtn.classList.toggle("on", ALL_BODIES.some((b) => b.showOrbit));
    labelsBtn.classList.toggle("on", ALL_BODIES.some((b) => b.showLabel));
  }
  function updateNavSel() {
    for (const el of navEl.querySelectorAll("button.body")) {
      el.classList.toggle("sel", !!selected && el.dataset.key === selected.key);
    }
  }

