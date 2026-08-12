  // 宇宙/地上のビュー切替 (画面上部のトグル)
  const vmSelect = document.getElementById("vmSelect");
  const vmSpaceBtn = document.getElementById("vmSpace");
  const vmGroundBtn = document.getElementById("vmGround");
  const vmMoonBtn = document.getElementById("vmMoon");
  // 指定天体の方向へ地上カメラを向ける (地平線下なら下向きにして必ず視野へ)。
  // 通常は目標値だけ更新して緩和で滑らかに回す。instant=true で即時ジャンプ
  const _aa = [0, 0, 0];
  // 現在の観測地 (地球/月) から見た天体の方位・高度 [度]
  function surfaceAltAz(body) {
    if (surfaceBody === "moon") {
      bodySky(body, _aa);
      return { az: (Math.atan2(_aa[0], -_aa[2]) / DEG + 360) % 360,
               alt: Math.asin(Math.max(-1, Math.min(1, _aa[1]))) / DEG };
    }
    const c = computeObs(body);
    return { az: c.az, alt: c.alt };
  }
  function aimGroundAt(body, instant) {
    if (!body || body.key === surfaceBody) return false;   // 立っている天体自身は見られない
    gTrack = true;
    const c = surfaceAltAz(body);
    // 現在の向きから最短方向で回るよう、目標方位は現在値の近傍に取る
    let d = (c.az * DEG - gAz) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    gAzTgt = gAz + d;
    gAltTgt = Math.max(-1.3, Math.min(GALT_MAX, c.alt * DEG));
    if (instant) { gAz = gAzTgt; gAlt = gAltTgt; }
    return true;
  }
  // 狭い画面のビュー切替は select なので、選択中の項目を合わせ直す
  function updateVmSelect() {
    vmSelect.value = !groundView ? "space" : surfaceBody === "moon" ? "moon" : "ground";
  }
  function syncViewModeUI() {
    vmSpaceBtn.classList.toggle("on", !groundView);
    vmGroundBtn.classList.toggle("on", groundView && surfaceBody === "earth");
    vmMoonBtn.classList.toggle("on", groundView && surfaceBody === "moon");
    updateVmSelect();
    updateHint();          // ビューに応じてヒントを差し替え・再表示
    refreshObsSiteUI();    // 観測地チップを地球/月で切り替え
  }
  // 地球/月の地表ビューへ。body = "earth" | "moon"
  function enterSurface(body) {
    const changed = !groundView || surfaceBody !== body;
    surfaceBody = body;
    groundView = true;
    const app = document.getElementById("app");
    app.classList.add("groundMode");
    app.classList.toggle("moonMode", body === "moon");
    if (changed) {
      buildObsFrame();   // 新しい観測者基底を確定してから照準を合わせる
      // 月面では既定で地球へ、地上では選択天体 (なければ南) を向く
      const aim = body === "moon" ? BODY_BY_KEY.get("earth") : (selected || currentInfoBody);
      if (!aimGroundAt(aim, true)) { gAz = gAzTgt = Math.PI; gAlt = gAltTgt = 0.4; }
    }
    syncViewModeUI();
    infoPanel.classList.remove("open");
  }
  function enterGround() { enterSurface("earth"); }
  function enterMoon() { enterSurface("moon"); }
  function exitGround() {
    groundView = false;
    const app = document.getElementById("app");
    app.classList.remove("groundMode", "moonMode");
    syncViewModeUI();
  }
  vmGroundBtn.addEventListener("click", enterGround);
  vmMoonBtn.addEventListener("click", enterMoon);
  vmSpaceBtn.addEventListener("click", exitGround);
  vmSelect.addEventListener("change", () => {
    const v = vmSelect.value;
    if (v === "ground") enterGround();
    else if (v === "moon") enterMoon();
    else exitGround();
  });

  // 月面の観測地点プリセット (selenographic lat, lon)
  const MOON_SITES = [
    { ja: "表側の中央 (地球直下)", en: "Sub-Earth point", lat: 0, lon: 0 },
    { ja: "アポロ11号 (静かの海)", en: "Apollo 11 (Tranquillitatis)", lat: 0.67, lon: 23.47 },
    { ja: "アポロ15号 (ハドリー)", en: "Apollo 15 (Hadley)", lat: 26.13, lon: 3.63 },
    { ja: "雨の海", en: "Mare Imbrium", lat: 35, lon: -16 },
    { ja: "危難の海", en: "Mare Crisium", lat: 17, lon: 59 },
    { ja: "北極", en: "North pole", lat: 85, lon: 0 },
    { ja: "南極", en: "South pole", lat: -85, lon: 0 },
  ];
  const moonSiteEl = document.getElementById("moonSite");
  function rebuildMoonSites() {
    const cur = moonSiteEl.value || "0";
    moonSiteEl.innerHTML = MOON_SITES.map((s, i) =>
      '<option value="' + i + '">' + (lang === "ja" ? s.ja : s.en) + "</option>").join("");
    moonSiteEl.value = cur;
  }
  {
    const mi = parseInt(localStorage.getItem("ssMoonSite"), 10);
    const idx = (mi >= 0 && mi < MOON_SITES.length) ? mi : 0;
    moonLat = MOON_SITES[idx].lat; moonLon = MOON_SITES[idx].lon;
    rebuildMoonSites();
    moonSiteEl.value = String(idx);
  }
  moonSiteEl.addEventListener("change", () => {
    const s = MOON_SITES[+moonSiteEl.value] || MOON_SITES[0];
    moonLat = s.lat; moonLon = s.lon;
    localStorage.setItem("ssMoonSite", moonSiteEl.value);
    if (surfaceBody === "moon") { buildObsFrame(); aimGroundAt(BODY_BY_KEY.get("earth"), true); }
    refreshObsSiteUI();   // チップ表示を新しい地点名に更新
    drawMoonMap();
  });

  // ---------- 月の表側マップ (観測地点が月のどのあたりかを視覚的に示す) ----------
  // 埋め込み済みの全球モザイク (正距円筒図法) を正射投影して表側の見た目に変換し、
  // 地球から見たときと同じ「月の顔」の上に現在地のピンを打つ
  const moonMapCv = document.getElementById("moonMap");
  const MOON_MAP_CSS = 150;
  let moonDisc = null;                 // 生成済みディスク (使い回す)
  function buildMoonDisc(img) {
    const sw = img.naturalWidth, sh = img.naturalHeight;
    if (!sw || !sh) return;
    const src = document.createElement("canvas");
    src.width = sw; src.height = sh;
    src.getContext("2d").drawImage(img, 0, 0);
    let sd;
    try { sd = src.getContext("2d").getImageData(0, 0, sw, sh).data; }
    catch (e) { return; }              // 取得できない環境ではマップ無しで続行
    const N = 300;
    const out = document.createElement("canvas");
    out.width = N; out.height = N;
    const oc = out.getContext("2d");
    const id = oc.createImageData(N, N), d = id.data;
    for (let py = 0; py < N; py++) {
      const ny = 1 - (py + 0.5) / N * 2;
      for (let px = 0; px < N; px++) {
        const nx = (px + 0.5) / N * 2 - 1;
        const r2 = nx * nx + ny * ny, o = (py * N + px) * 4;
        if (r2 > 1) { d[o + 3] = 0; continue; }
        const z = Math.sqrt(1 - r2);                       // 手前向き成分
        const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
        const lon = Math.atan2(nx, z);                     // 東経が右
        const u = (lon / DEG + 180) / 360, v = (90 - lat / DEG) / 180;
        const sx = Math.min(sw - 1, Math.max(0, Math.round(u * sw)));
        const sy = Math.min(sh - 1, Math.max(0, Math.round(v * sh)));
        const so = (sy * sw + sx) * 4;
        const k = 0.5 + 0.5 * z;                           // 縁を暗くして球らしく
        d[o] = sd[so] * k; d[o + 1] = sd[so + 1] * k; d[o + 2] = sd[so + 2] * k; d[o + 3] = 255;
      }
    }
    oc.putImageData(id, 0, 0);
    moonDisc = out;
    drawMoonMap();
  }
  function drawMoonMap() {
    if (!moonMapCv) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), S = MOON_MAP_CSS;
    if (moonMapCv.width !== S * dpr) { moonMapCv.width = S * dpr; moonMapCv.height = S * dpr; }
    const c = moonMapCv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = S / 2 - 11;
    if (moonDisc) c.drawImage(moonDisc, cx - R, cy - R, R * 2, R * 2);
    else {
      c.fillStyle = "rgba(150,178,224,0.10)";
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = "rgba(150,178,224,0.35)"; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    // 方位ラベル (北が上、東が右 = 地球から見た向き)
    const o = T().obs;
    c.fillStyle = "rgba(150,178,224,0.6)";
    c.font = '9px "Avenir Next","Hiragino Sans",sans-serif';
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(o.N, cx, cy - R - 5);
    c.fillText(o.S, cx, cy + R + 6);
    c.fillText(o.E, cx + R + 6, cy);
    c.fillText(o.W, cx - R - 6, cy);
    // 現在地のピン
    const la = moonLat * DEG, lo = moonLon * DEG;
    const x = cx + R * Math.cos(la) * Math.sin(lo), y = cy - R * Math.sin(la);
    const front = Math.cos(la) * Math.cos(lo);
    c.strokeStyle = "#f2b23e"; c.lineWidth = 1.6;
    c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(x - 9, y); c.lineTo(x - 6.5, y); c.moveTo(x + 6.5, y); c.lineTo(x + 9, y);
    c.moveTo(x, y - 9); c.lineTo(x, y - 6.5); c.moveTo(x, y + 6.5); c.lineTo(x, y + 9);
    c.stroke();
    c.fillStyle = "#f2b23e";
    c.beginPath(); c.arc(x, y, 1.7, 0, Math.PI * 2); c.fill();
    if (front < -0.02) {           // 裏側の地点 (現状のプリセットには無いが将来用)
      c.fillStyle = "rgba(226,178,110,0.85)";
      c.fillText(lang === "ja" ? "裏側" : "far side", cx, cy + R - 8);
    }
  }
  {
    const mimg = new Image();
    mimg.onload = () => buildMoonDisc(mimg);
    mimg.src = texURL("moon");
  }

