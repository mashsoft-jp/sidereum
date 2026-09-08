  // 構図はカメラのパンとは独立。HUD の開閉で追尾先や手動のパンを動かさない。
  const frameLayout = { x: 0, y: 0, rect: null, dirty: true, fit: null, mode: "close" };
  const frameApp = document.getElementById("app");
  const frameCloseBtn = document.getElementById("frameClose");
  const frameContextBtn = document.getElementById("frameContext");
  const frameEnjoyBtn = document.getElementById("frameEnjoy");
  const immersiveBar = document.getElementById("immersiveBar");
  const immersiveExitBtn = document.getElementById("immersiveExit");
  const immersiveSaveBtn = document.getElementById("immersiveSave");

  function syncFramingUI() {
    const ja = lang === "ja";
    frameCloseBtn.textContent = ja ? "接近" : "Close-up";
    frameContextBtn.textContent = ja ? "周辺" : "Surroundings";
    frameContextBtn.title = ja ? "天体の周囲を見渡す" : "See the surrounding system";
    frameEnjoyBtn.textContent = ja ? "鑑賞" : "Enjoy";
    frameEnjoyBtn.title = ja ? "見やすい方向へ移動し、パネルとガイドを隠して鑑賞" : "Find a scenic angle and hide panels and guides";
    immersiveExitBtn.textContent = ja ? "戻る · Esc" : "Return · Esc";
    immersiveSaveBtn.textContent = ja ? "画像を保存" : "Save image";
    document.getElementById("frameActions").setAttribute("aria-label", ja ? "天体の見せ方" : "Frame the body");
    const available = !!selected && !selected.mesh && !tourActive;
    frameCloseBtn.disabled = frameContextBtn.disabled = frameEnjoyBtn.disabled = !available;
  }

  // 長方形から常設の操作帯を引き、残る最大の領域を使う。
  // コンパクト表示では情報カードも避ける。入力は画面上の CSS px。
  function emptyFrameRect(bounds, obstacles) {
    let candidates = [bounds];
    for (const o of obstacles) {
      const next = [];
      for (const r of candidates) {
        if (o.x1 <= r.x0 || o.x0 >= r.x1 || o.y1 <= r.y0 || o.y0 >= r.y1) {
          next.push(r); continue;
        }
        next.push(
          { ...r, x1: Math.min(r.x1, o.x0) }, { ...r, x0: Math.max(r.x0, o.x1) },
          { ...r, y1: Math.min(r.y1, o.y0) }, { ...r, y0: Math.max(r.y0, o.y1) });
      }
      candidates = next.filter(r => r.x1 - r.x0 >= 48 && r.y1 - r.y0 >= 48);
    }
    // 毎回同じ順なので、同面積の候補どうしでちらつかない。
    candidates.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
    return candidates[0] || bounds;
  }

  function measureFrameRect() {
    const appRect = frameApp.getBoundingClientRect();
    const bounds = { x0: 20, y0: 20, x1: W - 20, y1: H - 20 };
    if (immersiveView) { bounds.y1 -= 54; return bounds; }
    const box = id => {
      const el = document.getElementById(id);
      if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden") return null;
      const r = el.getBoundingClientRect();
      return { x0: r.left - appRect.left - 18, y0: r.top - appRect.top - 18,
               x1: r.right - appRect.left + 18, y1: r.bottom - appRect.top + 18 };
    };
    // 上下の操作帯は全幅を空ける。残りで左右のパネルを避ける。
    for (const id of ["title", "clock", "viewMode"]) {
      const r = box(id); if (r) bounds.y0 = Math.max(bounds.y0, r.y1);
    }
    if (!frameApp.classList.contains("ctrlHidden")) {
      const r = box("controls"); if (r) bounds.y1 = Math.min(bounds.y1, r.y0);
    }
    const obstacles = [];
    // PC の情報カードと天体リストは重ねる。スマホの縦・横表示では
    // 情報カードを避け、天体がその下に隠れない位置と倍率に合わせる。
    if ((W <= 720 || H <= 480) && infoPanel.classList.contains("open")) {
      const r = box("info"); if (r) obstacles.push(r);
    }
    for (const id of ["angleCell"]) {
      const r = box(id); if (r) obstacles.push(r);
    }
    return emptyFrameRect(bounds, obstacles);
  }

  function frameRadius(body, mode) {
    let radius = bodyR(body) * (body.obl ? Math.max(...body.obl) : 1);
    if (body.ring) radius = Math.max(radius, bodyR(body) * RING_OUT);
    if (mode === "context") {
      if (body === SUN) return PLANETS[3].a * (1 + PLANETS[3].e) * K_REAL;
      if (body.parent) {
        const parent = BODY_BY_KEY.get(body.parent);
        return body.aKm * KM2W * 1.1 + bodyR(parent);
      }
      // 月だけの地球は月まで。多数の衛星を持つ惑星は主要な近傍を収める。
      // 最遠衛星だけを基準にすると主役が点になるので半径の30倍を上限にする。
      const moons = SATELLITES.filter(s => s.parent === body.key);
      const limit = moons.length === 1 ? Infinity : radius * 30;
      radius = Math.max(radius * 3, ...moons.map(s => Math.min(s.aKm * KM2W * 1.1 + bodyR(s), limit)));
    }
    return radius;
  }

  function fitFrameDistance(body) {
    const r = frameLayout.rect;
    if (!r) return;
    const pixels = Math.max(24, Math.min(r.x1 - r.x0, r.y1 - r.y0) * 0.36);
    const focal = H / (2 * Math.tan(FOV / 2));
    // 球の見かけの半径は asin(R/d)。極端な横長画面でも輪郭まで収まる。
    cam.distTgt = frameRadius(body, frameLayout.mode) / Math.sin(Math.atan(pixels / focal));
    cam.distTgt = Math.max(bodyR(body) * 1.15, Math.min(1400, cam.distTgt));
  }

  // 手動の接近だけ、注視点と距離を同じ時間軸で動かす。ツアーは専用の進行を使う。
  let cameraFlight = null;
  const flightEase = t => { const u = Math.max(0, Math.min(1, t)); return u * u * u * (u * (u * 6 - 15) + 10); };
  function beginCameraFlight(body) {
    if (!body || groundView || tourActive || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = posW.get(body.key);
    cameraFlight = { body, elapsed: 0, duration: 2.8,
      offset: cam.focus.map((v, i) => v - target[i]), pan: cam.panOff.slice(),
      dist: Math.max(cam.dist, 1e-12), yaw: cam.yaw, pitch: cam.pitch, zoom: camZoom };
  }
  function stepCameraFlight(dt) {
    const f = cameraFlight;
    if (!f) return;
    if (groundView || tourActive || selected !== f.body) { cameraFlight = null; return; }
    f.elapsed += dt;
    const t = Math.min(1, f.elapsed / f.duration);
    const e = flightEase(t), target = posW.get(f.body.key);
    // 回転・中心合わせ・接近を同時に進める。距離の逆数で見かけの拡大を均す。
    cam.dist = 1 / ((1 - e) / f.dist + e / Math.max(cam.distTgt, 1e-12));
    // 中心のずれもワールド距離ではなく角度で減らす。接近で残差が拡大されて
    // 終盤に天体が横へ走ることを防ぎ、遠くの別天体からでも連続して向き直る。
    const offset = Math.hypot(...f.offset.map((v, i) => v + f.pan[i]));
    const residual = offset > 1e-12
      ? cam.dist * Math.tan(Math.atan2(offset, f.dist) * (1 - e)) / offset
      : (1 - e) * cam.dist / f.dist;
    for (let i = 0; i < 3; i++) {
      cam.focus[i] = target[i] + f.offset[i] * residual;
      cam.panOff[i] = f.pan[i] * residual;
    }
    let yaw = (cam.yawTgt - f.yaw) % (2 * Math.PI);
    if (yaw > Math.PI) yaw -= 2 * Math.PI;
    if (yaw < -Math.PI) yaw += 2 * Math.PI;
    cam.yaw = f.yaw + yaw * e;
    cam.pitch = f.pitch + (cam.pitchTgt - f.pitch) * e;
    camZoom = f.zoom + (camZoomTgt - f.zoom) * e;
    if (t >= 1) cameraFlight = null;
  }
  function cancelCameraFlight() {
    if (!cameraFlight) return;
    cameraFlight = null; frameLayout.fit = null;
    cam.distTgt = cam.dist; cam.yawTgt = cam.yaw; cam.pitchTgt = cam.pitch; camZoomTgt = camZoom;
  }
  // 次の操作を先に受け付ける。選択ボタンの処理より前に前回の移動を止める。
  for (const event of ["pointerdown", "wheel", "keydown"]) {
    window.addEventListener(event, cancelCameraFlight, { capture: true, passive: true });
  }

  function frameBody(body, mode) {
    if (!body || body.mesh || groundView || tourActive) return;
    if (W <= 720 && navVisible) { navVisible = false; applyNavVisible(); }
    frameLayout.mode = mode;
    frameLayout.fit = body;
    camZoomTgt = 1;
    resetPan();
    positionInfoPanel();
    frameLayout.rect = measureFrameRect();
    fitFrameDistance(body);
    beginCameraFlight(body);
    frameLayout.dirty = true;
  }

  // 太陽から約40度ずれた方向なら、明るい面と明暗の境目を一緒に見せられる。
  // 同じ照明条件の候補から現在の視点に近いものを選び、無駄な大回りを避ける。
  function enjoymentDirection(body) {
    const current = [Math.cos(cam.pitch) * Math.cos(cam.yaw), Math.sin(cam.pitch),
      Math.cos(cam.pitch) * Math.sin(cam.yaw)];
    if (body === SUN) return current;
    const w = posW.get(body.key), sun = posW.get(SUN.key);
    const light = sun.map((v, i) => v - w[i]);
    const length = Math.hypot(...light);
    if (length < 1e-12) return current;
    for (let i = 0; i < 3; i++) light[i] /= length;
    const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
    const ref = Math.abs(light[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const side = [light[1] * ref[2] - light[2] * ref[1],
      light[2] * ref[0] - light[0] * ref[2], light[0] * ref[1] - light[1] * ref[0]];
    const sideLength = Math.hypot(...side);
    for (let i = 0; i < 3; i++) side[i] /= sideLength;
    const up = [side[1] * light[2] - side[2] * light[1],
      side[2] * light[0] - side[0] * light[2], side[0] * light[1] - side[1] * light[0]];
    let best = current, bestScore = -Infinity;
    const phase = 40 * Math.PI / 180;
    for (let n = 0; n < 72; n++) {
      const angle = n * Math.PI / 36;
      const d = light.map((v, i) => v * Math.cos(phase) +
        (side[i] * Math.cos(angle) + up[i] * Math.sin(angle)) * Math.sin(phase));
      let score = dot(d, current);
      if (body.key === "saturn") {
        const opening = dot(d, SATURN_POLE_W), litSide = dot(light, SATURN_POLE_W);
        // 環が線にならず、できるだけ太陽に照らされた側が見える候補を優先。
        score -= Math.max(0, .45 - Math.abs(opening)) * 12;
        if (Math.abs(litSide) > .05 && opening * litSide < 0) score -= 3;
      }
      // 真上付近は操作時の方位が不安定になるため避ける。
      if (Math.abs(d[1]) > .94) score -= 4;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function stepFraming(k) {
    if (frameLayout.dirty) {
      frameLayout.rect = measureFrameRect();
      frameLayout.dirty = false;
      if (frameLayout.fit && selected === frameLayout.fit && !groundView && !tourActive) fitFrameDistance(frameLayout.fit);
    }
    const enabled = !groundView && !tourActive && (selected || lastCenter);
    const r = frameLayout.rect;
    const x = enabled && r ? (r.x0 + r.x1) / W - 1 : 0;
    const y = enabled && r ? 1 - (r.y0 + r.y1) / H : 0;
    frameLayout.x += (x - frameLayout.x) * k;
    frameLayout.y += (y - frameLayout.y) * k;
  }

  function setImmersive(v) {
    if (v && (groundView || tourActive)) return;
    immersiveView = v;
    frameApp.classList.toggle("immersive", v);
    immersiveBar.hidden = !v;
    frameLayout.dirty = true;
    if (v) {
      setMenu(false);
      if (selected && !selected.mesh) {
        const direction = enjoymentDirection(selected);
        frameBody(selected, "close");
        cam.yawTgt = Math.atan2(direction[2], direction[0]);
        cam.pitchTgt = Math.asin(Math.max(-1, Math.min(1, direction[1])));
      }
      immersiveExitBtn.focus({ preventScroll: true });
    }
    else {
      const back = infoPanel.classList.contains("open") ? frameEnjoyBtn : menuBtn;
      back.focus({ preventScroll: true });
    }
  }
  frameCloseBtn.addEventListener("click", () => frameBody(selected, "close"));
  frameContextBtn.addEventListener("click", () => frameBody(selected, "context"));
  frameEnjoyBtn.addEventListener("click", () => setImmersive(true));
  immersiveExitBtn.addEventListener("click", () => setImmersive(false));
  immersiveSaveBtn.addEventListener("click", () => { snapPending = true; });
  window.addEventListener("keydown", e => {
    if (immersiveView && e.key === "/") { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key === "Escape" && immersiveView && !snapDlgEl.classList.contains("open")) {
      e.preventDefault(); setImmersive(false);
    }
  }, true);
  // 手動で距離・倍率を変えた後は、その選択を優先。次の「接近/周辺」で再フィット。
  frameApp.addEventListener("pointerdown", e => {
    if (e.target === glc || e.target === ovl || e.target.closest("#zoomIn,#zoomOut,#magIn,#magOut,#zoom,#mag")) frameLayout.fit = null;
  }, true);
  frameApp.addEventListener("wheel", () => { frameLayout.fit = null; }, { passive: true });
  for (const id of ["zoom", "mag"]) document.getElementById(id).addEventListener("input", () => { frameLayout.fit = null; });
  const dirtyFrame = () => { frameLayout.dirty = true; };
  window.addEventListener("resize", dirtyFrame);
  frameApp.addEventListener("transitionend", dirtyFrame);
  const frameMutation = new MutationObserver(dirtyFrame);
  for (const el of [frameApp, infoPanel]) frameMutation.observe(el, { attributes: true, attributeFilter: ["class"] });
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(dirtyFrame);
    for (const id of ["info", "controls", "title", "clock"]) observer.observe(document.getElementById(id));
  }
