  // ---------- 入力 ----------
  const pointers = new Map();
  let dragMoved = 0, pinchDist = 0, pinchMidX = 0, pinchMidY = 0;
  let dollyY = 0, dollyN = 0;   // 3本指ドラッグ (距離)。dollyN は本数が変わった回を捨てるため

  // 3本指の重心の縦位置。指の本数が変わると飛ぶので、変わった回は使わない
  function ptrAvgY() {
    let s = 0;
    for (const p of pointers.values()) { s += p.y; }
    return s / pointers.size;
  }

  // 平行移動 (パン): 注視点を画面平行にずらす。宇宙ビューのみ。
  // PC: 右ドラッグ or Shift+ドラッグ、スマホ: 2本指スワイプ
  function panCamera(dx, dy) {
    const wpp = 2 * cam.dist * Math.tan(eFov() / 2) / (H || 1);   // 注視点距離での 1px あたりのワールド長
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch);
    // 画面の右方向・上方向のワールドベクトル (視線に直交)
    const rx = sy, rz = -cy;
    const ux = -sp * cy, uy = cp, uz = -sp * sy;
    // 内容が指に付いてくる向き: 右ドラッグで注視点は左へ
    cam.panOff[0] += (-dx * rx + dy * ux) * wpp;
    cam.panOff[1] += (dy * uy) * wpp;
    cam.panOff[2] += (-dx * rz + dy * uz) * wpp;
    cam.panOffTgt[0] = cam.panOff[0];
    cam.panOffTgt[1] = cam.panOff[1];
    cam.panOffTgt[2] = cam.panOff[2];
  }
  function resetPan() {
    cam.panOffTgt[0] = 0; cam.panOffTgt[1] = 0; cam.panOffTgt[2] = 0;
  }

  glc.addEventListener("contextmenu", (e) => e.preventDefault());   // 右ドラッグパン用
  glc.addEventListener("pointerdown", (e) => {
    try { glc.setPointerCapture(e.pointerId); } catch (_) {}   // 解放済みポインタ等で失敗しても続行
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey });
    dragMoved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchMidX = (a.x + b.x) / 2;
      pinchMidY = (a.y + b.y) / 2;
    }
    if (pointers.size >= 3) {
      dollyY = ptrAvgY();
      dollyN = pointers.size;
    }
    glc.classList.add("dragging");
  });

  glc.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) {
      glc.classList.toggle("hover", !!hitTest(e.clientX, e.clientY));
      return;
    }
    const prev = pointers.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: prev.pan });
    dragMoved += Math.abs(dx) + Math.abs(dy);

    if (pointers.size === 1) {
      if (groundView && arActive) {
        // AR: 向きはセンサーが決めるので、ドラッグは方位の補正に充てる。星が指に
        // 付いてくる向き (見えている星を実際の位置へ引いて合わせる)
        arAdjustAz(-dx * 0.004 * (gFov / (60 * DEG)));
      } else if (groundView) {
        const s = 0.004 * (gFov / (60 * DEG));   // 拡大時ほど細かく
        gTrack = false;                          // 手動で見回したら追尾解除
        gAz += dx * s;
        gAlt = Math.max(-1.4, Math.min(GALT_MAX, gAlt - dy * s));
        gAzTgt = gAz;
        gAltTgt = gAlt;
      } else if (prev.pan) {
        panCamera(dx, dy);
      } else {
        const s = 0.005 / camZoom;               // 拡大時ほど細かく回す
        cam.yaw += dx * s;
        cam.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, cam.pitch + dy * s));
        cam.yawTgt = cam.yaw;
        cam.pitchTgt = cam.pitch;
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (groundView) {
        if (pinchDist > 0) gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, gFovTgt * pinchDist / d));
      } else if (pinchDist > 0) {
        camZoomTgt = Math.max(1, Math.min(MAG_MAX, camZoomTgt * d / pinchDist));   // ピンチで拡大率
        panCamera(mx - pinchMidX, my - pinchMidY);   // 2本指スワイプで平行移動
      }
      pinchDist = d;
      pinchMidX = mx;
      pinchMidY = my;
    } else if (pointers.size >= 3) {
      // 3本指の上下ドラッグで注視点との距離。ピンチ (拡大率) と2本指スワイプ
      // (平行移動) が埋まっているので、距離だけスライダーへ手を伸ばす必要が
      // あった。向きは「上 = 近づく」— スライダー右 = 接近、＋ = 近づくと揃える。
      // 係数は Shift+ホイール (0.0016/delta) の5ノッチぶんが 150px に当たる量
      const y = ptrAvgY();
      if (dollyN === pointers.size && !groundView) {
        cam.distTgt = Math.max(minDist(), Math.min(1400, cam.distTgt * Math.exp((y - dollyY) * 0.006)));
      }
      dollyY = y;
      dollyN = pointers.size;
    }
    if (dragMoved > 3) hideHint();
  });

  function endPointer(e) {
    // ツアー中は見回し・ズームだけ許し、天体の選択はさせない (シーンの注視先が
    // 変わるため)。ただし選択を促しているチュートリアルのステップだけは通す
    if ((!tourActive || tourAllowsSelect()) &&
        pointers.has(e.pointerId) && dragMoved < 5 && pointers.size === 1 && e.button === 0) {
      // 同じ天体を再度押したら選択の飾りだけを消す (注視先は動かさない)。
      // リストのボタンと同じ扱い
      if (groundView) {
        // 選択 + その方向へカメラを向けて追尾 (以後のズームでも中央に保つ)
        const hit = hitTestGround(e.clientX, e.clientY);
        if (hit && !tourAllowsBody(hit)) return;
        if (hit === selected && hit) toggleSelChrome(hit);
        else if (hit) { showSelMark = true; select(hit, true); }
      } else {
        const hit = hitTest(e.clientX, e.clientY);
        if (hit && !tourAllowsBody(hit)) return;
        if (hit === selected && hit) {
          toggleSelChrome(hit);
        } else if (hit) {
          showSelMark = true;
          select(hit, true);
        } else {
          select(null, false);
        }
      }
    }
    pointers.delete(e.pointerId);
    pinchDist = 0;
    dollyN = 0;
    if (!pointers.size) glc.classList.remove("dragging");
  }
  glc.addEventListener("pointerup", endPointer);
  glc.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); pinchDist = 0; dollyN = 0; });

  glc.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (groundView) {
      gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, gFovTgt * Math.exp(e.deltaY * 0.0012)));
    } else if (e.shiftKey) {
      const dl = e.deltaY || e.deltaX;   // Shift押下時は環境により横スクロール (deltaX) に載る
      cam.distTgt = Math.max(minDist(), Math.min(1400, cam.distTgt * Math.exp(dl * 0.0016)));   // Shift+ホイールで距離
    } else {
      camZoomTgt = Math.max(1, Math.min(MAG_MAX, camZoomTgt * Math.exp(-e.deltaY * 0.0015)));   // ホイールで拡大率
    }
    hideHint();
  }, { passive: false });

  function hitTest(px, py) {
    let best = null, bestD = 1e9;
    for (const b of [SUN, ...PLANETS, ...SATELLITES]) {
      const s = screenPos.get(b.key);
      if (!s) continue;
      const d = Math.hypot(px - s.x, py - s.y);
      if (d < Math.max(s.r + 8, 14) && d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  // ---------- コントロール ----------
  const playBtn = document.getElementById("play");
  const speedInput = document.getElementById("speed");
  const speedVal = document.getElementById("speedVal");

  const playIconEl = document.getElementById("playIcon");
  const playLabelEl = document.getElementById("playLabel");
  // 文字グリフ (▶/⏸) は Android が異体字セレクタを無視して絵文字描画する
  // ことがあるため、アイコンは SVG で描く
  const ICON_PAUSE = '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2.4" y="1.8" width="2.6" height="8.4" rx="0.7"/><rect x="7" y="1.8" width="2.6" height="8.4" rx="0.7"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3.2 1.6 L10.8 6 L3.2 10.4 Z"/></svg>';
  function setPlaying(v) {
    playing = v;
    playIconEl.innerHTML = v ? ICON_PAUSE : ICON_PLAY;
    playLabelEl.textContent = v ? T().pause : T().play;
  }
  playBtn.addEventListener("click", () => setPlaying(!playing));

  function speedFromSlider() {
    // v=0: 1秒/秒 (実時間), v=18: 1分/秒, v=36: 1時間/秒 (既定), v=100: 約240年/秒
    daysPerSec = Math.pow(60, speedInput.value / 18) / 86400;
    speedVal.textContent = fmtRate(daysPerSec);
  }
  speedInput.addEventListener("input", speedFromSlider);

  // −/＋ ボタン (クリックで1段階、長押しで連続)。キリのいい値の階段にスナップする
  //   [秒/秒]: 1秒 10秒 30秒 1分 5分 15分 30分 1h 3h 6h 12h 1日 3日 7日 14日
  //           30日 90日 180日 1年 3年 10年 30年 100年 240年
  const SPEED_STEPS_SEC = [
    1, 10, 30, 60, 300, 900, 1800, 3600, 10800, 21600, 43200,
    86400, 259200, 604800, 1209600, 2592000, 7776000, 15552000,
    31557600, 94672800, 315576000, 946728000, 3155760000, 7573824000,
  ];
  function stepSpeed(dir) {
    const cur = daysPerSec * 86400;
    const next = dir > 0
      ? SPEED_STEPS_SEC.find((s) => s > cur * 1.001)
      : [...SPEED_STEPS_SEC].reverse().find((s) => s < cur * 0.999);
    if (next === undefined) return;
    daysPerSec = next / 86400;
    speedInput.value = Math.max(0, Math.min(100, Math.round(18 * Math.log(next) / Math.log(60))));
    speedVal.textContent = fmtRate(daysPerSec);
  }
  function bindHold(btn, fire) {
    let delay = null, rep = null;
    const stop = () => { clearTimeout(delay); clearInterval(rep); delay = rep = null; };
    btn.addEventListener("pointerdown", () => {
      fire();
      delay = setTimeout(() => { rep = setInterval(fire, 120); }, 400);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) btn.addEventListener(ev, stop);
    // キーボード操作 (Enter/Space) は click の detail=0 で拾う
    btn.addEventListener("click", (e) => { if (e.detail === 0) fire(); });
  }
  bindHold(document.getElementById("speedDown"), () => stepSpeed(-1));
  bindHold(document.getElementById("speedUp"), () => stepSpeed(1));

  // ---------- ズーム (カメラ距離。ピンチ/ホイールと双方向同期) ----------
  const zoomInput = document.getElementById("zoom");
  const zoomVal = document.getElementById("zoomVal");
  const ZD_MIN = 1e-6, ZD_MAX = 1400;
  const ZLOG = Math.log(ZD_MAX / ZD_MIN);
  let zoomActive = false;
  let lastZoomStr = "", lastZoomSlider = "";
  // 距離単位 (km / マイル)。au 表示はそのまま
  let distUnit = localStorage.getItem("ssUnit") === "mi" ? "mi" : "km";
  const KM_PER_MI = 1.609344;
  function fmtDist(d) {
    const au = d / K_REAL;
    if (au >= 1) return au.toFixed(2) + " au";
    if (au >= 0.01) return au.toFixed(3) + " au";
    const km = au * AU_KM;
    if (distUnit === "mi") return Math.round(km / KM_PER_MI).toLocaleString("en-US") + " mi";
    return Math.round(km).toLocaleString("en-US") + " km";
  }
  // スライダー右 = 接近 (ズームイン)
  function zoomFromSlider() {
    const t = zoomInput.value / 100;
    cam.distTgt = Math.max(minDist(), Math.min(ZD_MAX, ZD_MAX * Math.exp(-ZLOG * t)));
    hideHint();
  }
  zoomInput.addEventListener("input", zoomFromSlider);
  zoomInput.addEventListener("pointerdown", () => { zoomActive = true; });
  window.addEventListener("pointerup", () => { zoomActive = false; });
  // キリのいい距離の階段にスナップ (km帯は単位設定に応じて km / マイル基準)
  function stepZoom(dir) {
    const steps = [];
    const kmU = distUnit === "mi" ? KM_PER_MI : 1;
    for (const n of [100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000]) {
      steps.push(n * kmU * KM2W);
    }
    for (const a of [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]) steps.push(a * K_REAL);
    const cur = cam.distTgt;
    const next = dir > 0
      ? [...steps].reverse().find((s) => s < cur * 0.999)   // ＋ = 近づく
      : steps.find((s) => s > cur * 1.001);                 // − = 離れる
    if (next === undefined) return;
    cam.distTgt = Math.max(minDist(), Math.min(ZD_MAX, next));
    hideHint();
  }
  bindHold(document.getElementById("zoomOut"), () => stepZoom(-1));
  bindHold(document.getElementById("zoomIn"), () => stepZoom(1));

  // ---------- 宇宙ビューのズーム (拡大率。「距離」とは別に画角を狭めて望遠する) ----------
  const magInput = document.getElementById("mag");
  const magVal = document.getElementById("magVal");
  const MAG_LOG = Math.log(MAG_MAX);            // スライダー t=0→1倍, t=1→MAG_MAX倍 (対数)
  const MAG_STEPS = [1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100];
  let magActive = false;
  let lastMagStr = "", lastMagSlider = "";
  function magFromSlider() {
    camZoomTgt = Math.max(1, Math.min(MAG_MAX, Math.exp(MAG_LOG * (magInput.value / 100))));
    hideHint();
  }
  magInput.addEventListener("input", magFromSlider);
  magInput.addEventListener("pointerdown", () => { magActive = true; });
  window.addEventListener("pointerup", () => { magActive = false; });
  function stepMag(dir) {
    const cur = camZoomTgt;
    const next = dir > 0
      ? MAG_STEPS.find((s) => s > cur * 1.001)                  // ＋ = 拡大
      : [...MAG_STEPS].reverse().find((s) => s < cur * 0.999);  // − = 縮小
    if (next === undefined) return;
    camZoomTgt = Math.max(1, Math.min(MAG_MAX, next));
    hideHint();
  }
  bindHold(document.getElementById("magOut"), () => stepMag(-1));
  bindHold(document.getElementById("magIn"), () => stepMag(1));
  const fmtMag = (z) => "×" + (z < 9.95 ? z.toFixed(1) : String(Math.round(z)));
  function updateMagUI() {
    if (!magActive) {
      const t = Math.log(Math.max(1, camZoom)) / MAG_LOG;
      const v = String(Math.round(Math.min(100, Math.max(0, t * 100))));
      if (v !== lastMagSlider) { magInput.value = v; lastMagSlider = v; }
    }
    const s = fmtMag(camZoom);
    if (s !== lastMagStr) { magVal.textContent = s; lastMagStr = s; }
  }

  // ---------- カメラ角度 (仰角。ドラッグと双方向同期) ----------
  const angleInput = document.getElementById("angle");
  const angleVal = document.getElementById("angleVal");
  const ANGLE_STEPS = [-89.99, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 89.99];
  let angleActive = false;
  let lastAngleStr = "", lastAngleSlider = "";
  function angleFromSlider() {
    cam.pitchTgt = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, angleInput.value * DEG));
    hideHint();
  }
  angleInput.addEventListener("input", angleFromSlider);
  angleInput.addEventListener("pointerdown", () => { angleActive = true; });
  window.addEventListener("pointerup", () => { angleActive = false; });
  // −/＋ はキリのいい角度 (15°刻み + 両端87°) にスナップ
  function stepAngle(dir) {
    const cur = cam.pitchTgt / DEG;
    const next = dir > 0
      ? ANGLE_STEPS.find((a) => a > cur + 0.5)
      : [...ANGLE_STEPS].reverse().find((a) => a < cur - 0.5);
    if (next === undefined) return;
    cam.pitchTgt = next * DEG;
    hideHint();
  }
  bindHold(document.getElementById("angleDown"), () => stepAngle(-1));
  bindHold(document.getElementById("angleUp"), () => stepAngle(1));

  // ---------- 地上ビュー用コントロール (画角・方位・高度。ドラッグと双方向同期) ----------
  const gFovInput = document.getElementById("gFov");
  const gFovVal = document.getElementById("gFovVal");
  const gAzTape = document.getElementById("gAzTape");
  const gAzDir = document.getElementById("gAzDir");
  // 方位の目盛りテープ (中央 = 現在の向き。15°刻み、45°ごとに方角ラベル)
  function buildAzTape(az) {
    const dirs = T().obs.dirs;
    const half = 50, px = 88 / half;               // 表示範囲 ±50° → viewBox 半幅 88
    let s = '<line x1="-88" y1="0" x2="88" y2="0" stroke="rgba(150,178,224,0.25)" stroke-width="1"/>';
    for (let k = Math.ceil((az - half) / 15) * 15; k <= az + half; k += 15) {
      const x = ((k - az) * px).toFixed(1);
      const major = ((k % 45) + 45) % 45 === 0;
      s += '<line x1="' + x + '" y1="' + (major ? -9 : -5) + '" x2="' + x +
           '" y2="0" stroke="rgba(150,178,224,' + (major ? "0.6" : "0.35") + ')" stroke-width="1"/>';
      if (major) {
        const idx = (((k % 360) + 360) % 360) / 45;
        s += '<text x="' + x + '" y="12" class="tapetxt' + (idx === 0 ? " tapen" : "") + '">' + dirs[idx] + "</text>";
      }
    }
    s += '<polygon points="0,-12 -3.5,-19 3.5,-19" fill="var(--accent)"/>';   // 中央マーカー
    return s;
  }
  const gAltInput = document.getElementById("gAlt");
  const gAltVal = document.getElementById("gAltVal");
  let gFovActive = false, gAltActive = false;
  let lastGFov = "", lastGAz = "", lastGAlt = "";
  // スライダーは直接操作なので即時 (目標値も同期)。ボタン/ホイールは目標値へ寄せて滑らかに。
  // マッピングは MAX_FOV 〜 天体別の動的下限 gMinFov() の指数スケール
  gFovInput.addEventListener("input", () => {
    gFov = gFovTgt = MAX_FOV * Math.exp(Math.log(gMinFov() / MAX_FOV) * gFovInput.value / 100);
  });
  gFovInput.addEventListener("pointerdown", () => { gFovActive = true; });
  gAltInput.addEventListener("input", () => {
    if (arActive) return;   // AR では高度はセンサーが決める (表示だけ)
    gTrack = false; gAlt = gAltTgt = Math.max(-1.4, Math.min(GALT_MAX, gAltInput.value * DEG));
  });
  gAltInput.addEventListener("pointerdown", () => { gAltActive = true; });
  window.addEventListener("pointerup", () => { gFovActive = false; gAltActive = false; });
  const stepFov = (dir) => { gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, gFovTgt * (dir > 0 ? 1.3 : 1 / 1.3))); };
  bindHold(document.getElementById("gFovOut"), () => stepFov(1));    // − = 広げる
  bindHold(document.getElementById("gFovIn"), () => stepFov(-1));    // ＋ = 狭める (ズームイン)
  // AR 中はテープと ◀▶ も方位の補正 (向きそのものはセンサーが決める)
  bindHold(document.getElementById("gAzLeft"), () => { if (arActive) arAdjustAz(-gFov * 0.4); else { gTrack = false; gAzTgt -= gFov * 0.4; } });
  bindHold(document.getElementById("gAzRight"), () => { if (arActive) arAdjustAz(gFov * 0.4); else { gTrack = false; gAzTgt += gFov * 0.4; } });
  // 目盛りテープのドラッグ/スワイプでも方位を回せる (テープが指に追従する向き)
  let tapeDragX = null;
  gAzTape.addEventListener("pointerdown", (e) => {
    tapeDragX = e.clientX;
    gAzTape.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  gAzTape.addEventListener("pointermove", (e) => {
    if (tapeDragX === null) return;
    const w = gAzTape.getBoundingClientRect().width || 1;
    const d = (e.clientX - tapeDragX) * (100 / w) * DEG;   // テープの表示範囲は ±50°
    tapeDragX = e.clientX;
    if (arActive) { arAdjustAz(-d); return; }
    gTrack = false;
    gAz -= d;
    gAzTgt = gAz;
  });
  gAzTape.addEventListener("pointerup", () => { tapeDragX = null; });
  gAzTape.addEventListener("pointercancel", () => { tapeDragX = null; });
  const stepAlt = (dir) => {
    if (arActive) return;
    gTrack = false;
    gAltTgt = Math.max(-1.4, Math.min(GALT_MAX, gAltTgt + dir * gFov * 0.4));
  };
  bindHold(document.getElementById("gAltUp"), () => stepAlt(1));
  bindHold(document.getElementById("gAltDown"), () => stepAlt(-1));
  function updateGroundUI() {
    if (!groundView) return;
    if (!gFovActive) {
      const v = String(Math.round(100 * Math.log(gFov / MAX_FOV) / Math.log(gMinFov() / MAX_FOV)));
      if (gFovInput.value !== v) gFovInput.value = v;
    }
    const z = 1 / Math.tan(gFov / 2);
    const fv = "×" + (z < 10 ? z.toFixed(1) : Math.round(z).toLocaleString("en-US"));
    if (fv !== lastGFov) { gFovVal.textContent = fv; lastGFov = fv; }
    const azn = ((gAz / DEG) % 360 + 360) % 360;
    const as = Math.round(azn) + "°";
    if (as !== lastGAz) {
      gAzTape.innerHTML = buildAzTape(azn);
      gAzDir.textContent = as + " " + T().obs.dirs[Math.round(azn / 45) % 8];
      lastGAz = as;
    }
    if (!gAltActive) {
      const v = String(Math.round(gAlt / DEG));
      if (gAltInput.value !== v) gAltInput.value = v;
    }
    const av = Math.round(gAlt / DEG) + "°";
    if (av !== lastGAlt) { gAltVal.textContent = av; lastGAlt = av; }
  }

  // ---------- 操作パネル設定の保存 (速度・ズーム・角度) ----------
  function saveSettings() {
    // 導入のあいだは保存しない。演出のためにカメラをヘリオポーズまで引いて
    // いるので、そのまま書くと次に開いたときの「既定」が 124au になる
    if (introActive()) return;
    try {
      localStorage.setItem("ssSpeed", String(daysPerSec));
      localStorage.setItem("ssZoom", String(cam.distTgt));
      localStorage.setItem("ssMag", String(camZoomTgt));
      localStorage.setItem("ssAngle", String(cam.pitchTgt));
    } catch (e) { /* プライベートモード等では保存しない */ }
  }
  // 現在の仰角をスライダーと数値表示へ反映 (毎フレーム呼ばれる)
  function updateAngleUI() {
    const deg = cam.pitch / DEG;
    if (!angleActive) {
      const v = String(Math.round(Math.max(-90, Math.min(90, deg))));
      if (v !== lastAngleSlider) {
        angleInput.value = v;
        lastAngleSlider = v;
      }
    }
    const s = Math.round(deg) + "°";
    if (s !== lastAngleStr) {
      angleVal.textContent = s;
      lastAngleStr = s;
    }
  }
  // 現在のカメラ距離をスライダーと数値表示へ反映 (毎フレーム呼ばれる)
  function updateZoomUI() {
    if (!zoomActive) {
      const t = Math.log(ZD_MAX / Math.max(cam.dist, ZD_MIN)) / ZLOG;
      const v = String(Math.round(Math.min(100, Math.max(0, t * 100))));
      if (v !== lastZoomSlider) {
        zoomInput.value = v;
        lastZoomSlider = v;
      }
    }
    const s = fmtDist(cam.dist);
    if (s !== lastZoomStr) {
      zoomVal.textContent = s;
      lastZoomStr = s;
    }
  }

  // まとめて ON/OFF (1つでも ON なら全 OFF、全 OFF なら全 ON)
  const orbitsBtn = document.getElementById("orbitsBtn");
  orbitsBtn.addEventListener("click", () => {
    const on = !ORBIT_BODIES.some((b) => b.showOrbit);
    for (const b of ORBIT_BODIES) b.showOrbit = on;
    syncToggleUI();
  });

  const labelsBtn = document.getElementById("labelsBtn");
  labelsBtn.addEventListener("click", () => {
    const on = !ALL_BODIES.some((b) => b.showLabel);
    for (const b of ALL_BODIES) b.showLabel = on;
    syncToggleUI();
  });

  // 視点アングル (ピッチのみ変更。ズーム・注視対象は保持、平行移動はリセット)
  function setPitch(p) {
    cam.pitchTgt = p;
    resetPan();
    hideHint();
  }
  // 他のカメラ視点を選んだら地上ビューを抜けて宇宙ビューへ
  function goTopView() { exitGround(); setPitch(PITCH_MAX); }   // 真上 (表示上 90°)
  function goSideView() { exitGround(); setPitch(0); }          // 真横 (0°)

  // デフォルト: 太陽中心に内惑星 (火星軌道まで) がちょうど収まる俯瞰
  function goDefaultView() {
    exitGround();
    select(null, false);
    lastCenter = null;                             // 太陽中心へ戻るので下限も太陽サイズに
    cam.focusTgt[0] = 0; cam.focusTgt[1] = 0; cam.focusTgt[2] = 0;
    const R = 19;                                  // 火星軌道 (遠日点) + 余白 [world]
    const aspect = Math.min(1, (W / H) || 1);
    cam.distTgt = R / (Math.tan(FOV / 2) * aspect) * 1.15;
    if (!isFinite(cam.distTgt)) cam.distTgt = 55;
    camZoomTgt = 1;
    setPitch(0.35);
  }
  // 全体表示: 太陽系を俯瞰する初期状態へ
  function goOverview() {
    exitGround();
    select(null, false);
    lastCenter = null;
    cam.focusTgt[0] = 0; cam.focusTgt[1] = 0; cam.focusTgt[2] = 0;
    cam.distTgt = 1150;
    cam.yawTgt = 0.9; cam.pitchTgt = 0.35;
    camZoomTgt = 1;
    resetPan();
  }

  // カメラ視点プルダウン。アクション実行後はラベル「カメラ」表示に戻す
  const camSelect = document.getElementById("camSelect");
  camSelect.addEventListener("change", () => {
    const v = camSelect.value;
    camSelect.selectedIndex = 0;
    if (v === "top") goTopView();
    else if (v === "def") goDefaultView();
    else if (v === "side") goSideView();
    else if (v === "reset") goOverview();
  });

  window.addEventListener("keydown", (e) => {
    // ツアー中は操作パネルを隠しているので、ショートカットだけ効くのは筋が悪い
    if (e.code === "Space" && e.target === document.body && !tourActive) {
      e.preventDefault();
      setPlaying(!playing);
    }
  });

