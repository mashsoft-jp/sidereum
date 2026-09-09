  // 鑑賞をランダムに巡る。設定保存やツアーの進捗とは独立した、一時的な表示。
  let saverState = null;
  const saverBar = document.getElementById("saverBar"), saverFade = document.getElementById("saverFade");
  const saverHint = document.getElementById("saverHint");
  const SAVER_KINDS = ["body", "cometSpace", "cometGround", "cometMoon", "overview", "earthSky", "moonSky"];
  const SAVER_COMETS = [
    { key: "hyakutake", d: "1996-03-24T18:30", fit: .35, gfov: 90 },
    { key: "halebopp", d: "1997-03-30T10:30", fit: 1.2, gfov: 65 },
    { key: "halley", d: "1910-05-05T19:00", fit: .25, gfov: 85 },
  ];
  const SAVER_PLACES = [
    { ja: "東京", en: "Tokyo", lat: 35.68, lon: 139.69, d: "2026-09-08T22:00" },
    { ja: "シドニー", en: "Sydney", lat: -33.87, lon: 151.21, d: "2026-07-15T22:00" },
    { ja: "アタカマ", en: "Atacama", lat: -23.86, lon: -69.13, d: "2026-07-15T22:00" },
    { ja: "レイキャビク", en: "Reykjavík", lat: 64.15, lon: -21.94, d: "2026-12-15T22:00" },
    { ja: "ハワイ", en: "Hawaii", lat: 19.82, lon: -155.47, d: "2026-09-08T22:00" },
  ];
  function screensaverRunning() { return !!saverState; }
  function screensaverOverview() { return saverState?.kind === "overview"; }
  function shuffledSaverKinds(random = Math.random) {
    const bag = SAVER_KINDS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }
  function syncScreensaverUI() {
    const ja = lang === "ja";
    document.getElementById("menuSaver").textContent = ja ? "スクリーンセーバー" : "Screensaver";
    const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
    saverHint.textContent = ja ? (touch ? "画面をタップすると終了します" : "画面をクリック、または Esc キーで終了します")
      : (touch ? "Tap the screen to exit" : "Click the screen or press Esc to exit");
    if (saverState?.title) document.getElementById("saverTitle").textContent = saverState.title[ja ? "ja" : "en"];
  }
  function saverMoonPlace(index) {
    const site = MOON_SITES[index]; moonLat = site.lat; moonLon = site.lon; moonSiteEl.value = String(index);
  }
  // 月面の星空は各地点の夜を選ぶ。彗星は見頃の日時を保ち、夜側の観測地点を探す。
  function findSaverMoonNight(comet) {
    const sky = [0, 0, 0], base = simDays;
    let best = -Infinity, choice = null;
    for (let i = 0; i < (comet ? 12 : 30); i++) {
      if (comet) { moonLat = 0; moonLon = i * 30 - 180; }
      else { simDays = base + i; updatePositions(); }
      buildObsFrame(); bodySky(SUN, sky); const sunAlt = sky[1];
      let score = -sunAlt;
      if (comet) { bodySky(comet, sky); score = Math.min(-sunAlt, sky[1]); }
      if (score > best) { best = score; choice = { days: simDays, lat: moonLat, lon: moonLon }; }
    }
    simDays = choice.days; moonLat = choice.lat; moonLon = choice.lon;
    updatePositions(); buildObsFrame();
  }
  function applySaverScene(kind) {
    const state = saverState, pick = a => a[Math.floor(Math.random() * a.length)];
    const base = { view: "space", sel: null, d: "2026-09-08T12:00", play: true, spd: 1 / 86400, mag: 1, cut: true };
    let s = { ...base }, title, orbit = false;
    if (kind === "body") {
      const b = BODY_BY_KEY.get(pick(["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]));
      s.sel = b.key; s.lit = true; orbit = true;
      title = { ja: b.name + "を巡る", en: b.en + " · orbit" };
    } else if (kind.startsWith("comet")) {
      const c = pick(SAVER_COMETS), b = BODY_BY_KEY.get(c.key);
      s = { ...s, d: c.d, sel: c.key, fit: c.fit, side: true, a: .4, aim: true, gfov: c.gfov * .84 };
      if (kind === "cometGround") { s.view = "ground"; obsLat = 35.68; obsLon = 139.69; }
      if (kind === "cometMoon") s.view = "moon";
      const ja = kind === "cometSpace" ? "宇宙" : kind === "cometGround" ? "東京の空" : "月面";
      const en = kind === "cometSpace" ? "Space" : kind === "cometGround" ? "Tokyo sky" : "Moon surface";
      title = { ja: b.name + " · " + ja, en: b.en + " · " + en };
    } else if (kind === "overview") {
      s.fit = pick([2.2, 34]); s.a = Math.PI / 2 - .01; s.y = -.6; s.spd = .4;
      title = { ja: s.fit < 3 ? "真上から見る内惑星" : "真上から見る太陽系", en: s.fit < 3 ? "Inner planets · from above" : "Solar System · from above" };
    } else if (kind === "earthSky") {
      const site = pick(SAVER_PLACES); obsLat = site.lat; obsLon = site.lon;
      s.view = "ground"; delete s.d; s.dLocal = site.d; s.gfov = 90; s.spd = 30 / 86400;
      title = { ja: site.ja + "の星空", en: "Night sky · " + site.en };
    } else {
      const index = Math.floor(Math.random() * MOON_SITES.length); saverMoonPlace(index);
      s.view = "moon"; s.gfov = 85; s.spd = 30 / 86400;
      title = { ja: "月面の星空 · " + MOON_SITES[index].ja, en: "Lunar sky · " + MOON_SITES[index].en };
    }
    // setObsSite を通さず、スクリーンセーバー中の観測地を永続設定に書かない。
    geoZone = null; frameLayout.fit = null; cameraFlight = null;
    gTrack = false; gRadTrack = "";
    showConst = false; showGrid = false; showTerrain = true; showSelMark = false;
    for (const b of ORBIT_BODIES) b.showOrbit = kind === "overview" && !b.parent && !b.ast && !b.comet && (!b.tno || b.key === "pluto");
    applyTourScene(s);
    if (s.view === "moon") {
      findSaverMoonNight(kind === "cometMoon" ? selected : null);
      if (kind === "cometMoon") {
        aimGroundAt(selected, true);
        title.ja += " (緯度0°・経度" + moonLon + "°)";
        title.en += " (0°, " + moonLon + "°)";
      }
    }
    if (kind === "earthSky" || kind === "moonSky") {
      gTrack = false; gRadTrack = "";
      gAz = gAzTgt = Math.random() * Math.PI * 2; gAlt = gAltTgt = 35 * DEG;
    }
    if (orbit) {
      const d = enjoymentDirection(selected);
      cam.yaw = cam.yawTgt = Math.atan2(d[2], d[0]);
      cam.pitch = cam.pitchTgt = Math.asin(d[1]);
      frameLayout.mode = selected === SUN ? "saverSun" : "close";
      frameLayout.rect = measureFrameRect(); frameLayout.fit = selected;
      fitFrameDistance(selected); cam.dist = cam.distTgt;
    }
    state.kind = kind; state.orbit = orbit; state.title = title;
    state.elapsed = 0; state.duration = 35 + Math.random() * 15;
    // 地点や日付が変わったことを、短い場面名と実際の表示日時で伝える。
    syncSaverDate();
    refreshObsSiteUI(); syncScreensaverUI(); frameLayout.dirty = true;
  }
  function nextSaverKind() {
    if (!saverState.bag.length) {
      saverState.bag = shuffledSaverKinds();
      if (saverState.bag.at(-1) === saverState.kind) saverState.bag.reverse();
    }
    return saverState.bag.pop();
  }
  function syncSaverDate() {
    const minute = Math.floor(simDays * 1440);
    if (saverState.minute === minute) return;
    saverState.minute = minute;
    document.getElementById("saverDate").textContent = new Date(J2000 + simDays * DAY_MS).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
  function startScreensaver() {
    if (saverState || tourActive) return;
    const saved = captureTourState();
    const extra = { moonLat, moonLon, moonSite: moonSiteEl.value, geoZone, infoTall, infoTab,
      frame: { ...frameLayout }, currentInfoBody, gRadTrack, immersiveView, enjoymentPaused, navVisible };
    exitAR(); hideModals(); setMenu(false);
    saverState = { saved, extra, bag: [], kind: null, elapsed: 0, phase: "in", fade: 0, age: 0 };
    immersiveView = true; frameApp.classList.add("immersive", "screensaverMode");
    immersiveBar.hidden = true; saverBar.hidden = false; saverFade.hidden = false;
    saverFade.style.opacity = "1";
    applySaverScene("body");
    saverHint.hidden = false;
    saverBar.style.opacity = saverHint.style.opacity = "1";
    saverBar.focus({ preventScroll: true });
  }
  function stopScreensaver() {
    if (!saverState) return;
    const { saved, extra } = saverState;
    hideModals();
    obsLat = saved.obsLat; obsLon = saved.obsLon; geoZone = extra.geoZone;
    moonLat = extra.moonLat; moonLon = extra.moonLon; moonSiteEl.value = extra.moonSite;
    infoTab = extra.infoTab; immersiveView = extra.immersiveView;
    frameApp.classList.remove("screensaverMode"); frameApp.classList.toggle("immersive", immersiveView);
    frameLayout.fit = null; cameraFlight = null;
    restoreTourState(saved, false);
    infoTall = extra.infoTall; currentInfoBody = extra.currentInfoBody; syncInfoMore();
    gRadTrack = extra.gRadTrack; enjoymentPaused = extra.enjoymentPaused;
    Object.assign(frameLayout, extra.frame, { dirty: true });
    navVisible = extra.navVisible; applyNavVisible(); refreshObsSiteUI();
    saverState = null; saverHint.hidden = true; saverBar.hidden = true; saverFade.hidden = true; immersiveBar.hidden = !immersiveView;
    syncFramingUI(); menuBtn.focus({ preventScroll: true });
  }
  function moveSaverCamera(dt) {
    const s = saverState;
    if (!s || document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (s.orbit) cam.yawTgt += dt * Math.PI / 120;
    else if (s.kind === "overview") cam.yawTgt += dt * .006;
    else if (s.kind === "cometSpace") {
      // 尾を横から見た構図を保ち、少し回り込みながら引いていく。
      cam.yawTgt += dt * .004;
      cam.distTgt *= Math.exp(dt * .003);
    } else if (s.kind === "cometGround" || s.kind === "cometMoon") {
      // 方位は既存の天体追尾に任せ、広角へゆっくり引く。尾を画面外へ追いやらない。
      gFovTgt = Math.min(MAX_FOV, gFovTgt * Math.exp(dt * .003));
    } else if (s.kind === "earthSky" || s.kind === "moonSky") gAzTgt += dt * .004;
  }
  function stepScreensaver(dt) {
    const s = saverState;
    if (!s || document.hidden) return;
    syncSaverDate();
    moveSaverCamera(dt);
    s.age += dt;
    // 終了案内は開始時の一度だけ。場面名は切り替えごとに約10秒で消す。
    saverHint.style.opacity = String(Math.max(0, Math.min(1, 10 - s.age)));
    saverBar.style.opacity = String(s.phase === "out" ? 0 : Math.max(0, Math.min(1, 10 - s.elapsed)));
    if (s.phase === "out") {
      s.fade += dt; saverFade.style.opacity = String(Math.min(1, s.fade / .8));
      if (s.fade >= .8) { applySaverScene(nextSaverKind()); s.phase = "in"; s.fade = 0; }
      return;
    }
    if (s.phase === "in") {
      s.fade += dt; saverFade.style.opacity = String(Math.max(0, 1 - s.fade));
      if (s.fade >= 1) s.phase = "show";
      return;
    }
    s.elapsed += dt;
    if (s.elapsed >= s.duration) { s.phase = "out"; s.fade = 0; }
  }
  document.getElementById("menuSaver").addEventListener("click", startScreensaver);
  // 終了操作が復元後の天体選択やカメラ操作に伝わらないよう、手前で受け取る。
  for (const type of ["pointerdown", "pointerup"]) window.addEventListener(type, e => {
    if (saverState) e.stopImmediatePropagation();
  }, true);
  window.addEventListener("click", e => {
    if (!saverState) return;
    e.preventDefault(); e.stopImmediatePropagation(); stopScreensaver();
  }, true);
  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && saverState) { e.preventDefault(); stopScreensaver(); }
  });
