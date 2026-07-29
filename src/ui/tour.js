  // ---------- ガイドツアー ----------
  // TOURS のステップを順に適用する。カメラは Tgt 側だけを設定し、実際の移動は
  // メインループの緩和に任せるので、通常の操作と同じ動きで次のシーンへ繋がる。
  const tourBar = document.getElementById("tourBar");
  const tourListEl = document.getElementById("tourList");
  const tourTitleEl = document.getElementById("tourTitle");
  const tourStepEl = document.getElementById("tourStep");
  const tourTextEl = document.getElementById("tourText");
  const tourDotsEl = document.getElementById("tourDots");
  const tourProgEl = document.getElementById("tourProg");
  const tourPrevBtn = document.getElementById("tourPrev");
  const tourNextBtn = document.getElementById("tourNext");
  const tourAutoBtn = document.getElementById("tourAuto");
  const tourResumeBtn = document.getElementById("tourResume");
  const tourCloseBtn = document.getElementById("tourClose");
  const menuTourBtn = document.getElementById("menuTour");
  const tourApp = document.getElementById("app");

  let tour = null;            // 実行中のツアー (null = 非実行)
  let tourIdx = 0;
  let tourAuto = false;       // 自動送り
  let tourTimer = 0;
  let tourTouched = false;    // このシーンで手動操作したか
  let tourSaved = null;       // ツアーが一時的に変える表示設定の退避先

  const tourText = (o) => (o ? (lang === "ja" ? o.ja : o.en) : "");

  // 「この軌道半径 [au] が画面に収まる」カメラ距離。
  // 軌道面は俯角ぶん縦に潰れて見えるので、横 (半径そのもの) と縦 (半径×sin俯角)
  // の必要量を別々に出し、両方を満たす距離を採る。縦横比によらず同じ見え方になる
  function tourFitDist(au, mag, pitch) {
    const half = Math.tan(FOV / Math.max(1, mag) / 2);
    const r = au * K_REAL * 1.10;                       // 10% の余白込み
    const wide = r / (half * Math.max(0.2, (W / H) || 1));
    // ナレーションバーが画面下部を覆う。描画は画面中央基準なので、バーの高さの
    // 半分ぶんだけ縦に使える範囲が狭いものとして距離を出す (横は影響なし)
    const vis = Math.max(0.5, 1 - ((tourBar.offsetHeight || 0) + 24) * 0.55 / (H / 2));
    // 真横 (俯角0) では軌道が線に潰れるため、下限を入れて 0 除算相当を避ける
    const tall = r * Math.max(0.15, Math.abs(Math.sin(pitch))) / (half * vis);
    return Math.max(wide, tall);
  }

  // 0..i のステップを畳み込んだ状態 (書かれていない項目は前のステップを引き継ぐ)
  function tourStateAt(i) {
    const st = {};
    for (let k = 0; k <= i; k++) Object.assign(st, tour.steps[k]);
    return st;
  }

  function applyTourStep(i) {
    const s = tourStateAt(i);
    if (s.view === "ground") enterGround();
    else if (s.view === "moon") enterMoon();
    else exitGround();
    if (s.d) {
      const t = Date.parse(/[zZ]$/.test(s.d) ? s.d : s.d + "Z");
      if (isFinite(t)) simDays = (t - J2000) / DAY_MS;
    }
    if (isFinite(s.spd) && s.spd > 0) {
      daysPerSec = s.spd;
      speedInput.value = Math.max(0, Math.min(100,
        Math.round(18 * Math.log(s.spd * 86400) / Math.log(60))));
      speedVal.textContent = T().ratePrefix + fmtDays(daysPerSec);
    }
    setPlaying(!!s.play);
    // 星座 (連動して黄道も) の一時的な出し分け。localStorage は書き換えない
    if (s.constel !== undefined) {
      showConst = !!s.constel;
      constBtn.classList.toggle("on", showConst);
    }
    // selected はカメラの注視先として使うだけなので、既定では選択マークを出さない
    showSelMark = !!s.mark;
    // 選択はするが情報パネルは開かない (ナレーションと重なるため)
    const b = s.sel ? BODY_BY_KEY.get(s.sel) : null;
    select(b, false);
    infoPanel.classList.remove("open");
    updatePositions();
    if (b) {
      const w = posW.get(b.key);
      cam.focusTgt[0] = w[0]; cam.focusTgt[1] = w[1]; cam.focusTgt[2] = w[2];
    } else {
      cam.focusTgt[0] = 0; cam.focusTgt[1] = 0; cam.focusTgt[2] = 0;
      lastCenter = null;             // 注視点が太陽へ戻るのでズーム下限も太陽サイズに
    }
    // fit は俯角を使って距離を出すので、角度を先に確定させる
    if (isFinite(s.a)) cam.pitchTgt = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, s.a));
    if (isFinite(s.y)) cam.yawTgt = s.y;
    // lit: 太陽光の当たる側へ回り込む (select(fly) と同じ計算)。日時によって
    // 天体が影側を向いてしまうのを防ぐので、接近して見せるシーンでは必須
    if (s.lit && b && b !== SUN) {
      const w = posW.get(b.key);
      const l = Math.hypot(w[0], w[1], w[2]) || 1;
      cam.yawTgt = Math.atan2(-w[2] / l, -w[0] / l) + 0.5;
      cam.pitchTgt = Math.asin(Math.max(-1, Math.min(1, -w[1] / l))) + 0.22;
    }
    const mag = isFinite(s.mag) ? Math.max(1, Math.min(MAG_MAX, s.mag)) : 1;
    camZoomTgt = mag;
    let dist = cam.distTgt;
    if (isFinite(s.km) && b) dist = s.km * KM2W;
    else if (isFinite(s.fit)) dist = tourFitDist(s.fit, mag, cam.pitchTgt);
    else if (isFinite(s.z)) dist = s.z;
    cam.distTgt = Math.min(1400, dist);
    resetPan();
    tourTouched = false;
    tourResumeBtn.hidden = true;
  }

  function clearTourTimer() {
    clearTimeout(tourTimer);
    tourTimer = 0;
    tourProgEl.style.transition = "none";
    tourProgEl.style.width = "0%";
  }
  function armTourTimer() {
    clearTourTimer();
    if (!tour || !tourAuto || tourIdx >= tour.steps.length - 1) return;
    const sec = tourStateAt(tourIdx).hold || 12;
    void tourProgEl.offsetWidth;     // 直前の width:0 を確定させ、遷移を必ず走らせる
    tourProgEl.style.transition = "width " + sec + "s linear";
    tourProgEl.style.width = "100%";
    tourTimer = setTimeout(() => tourGo(tourIdx + 1), sec * 1000);
  }

  function renderTourUI() {
    if (!tour) return;
    const t = T();
    tourTitleEl.textContent = tourText(tour.title);
    tourStepEl.textContent = (tourIdx + 1) + " / " + tour.steps.length;
    tourTextEl.textContent = tourText(tourStateAt(tourIdx).text);
    tourDotsEl.innerHTML = tour.steps
      .map((_, i) => '<i class="' + (i === tourIdx ? "on" : "") + '"></i>').join("");
    tourPrevBtn.disabled = tourIdx === 0;
    tourNextBtn.textContent = tourIdx === tour.steps.length - 1 ? t.tourDone : t.tourNext;
    tourAutoBtn.textContent = t.tourAuto;
    tourAutoBtn.classList.toggle("on", tourAuto);
    tourResumeBtn.textContent = t.tourResume;
    tourCloseBtn.title = t.tourExit;
  }

  function tourGo(i) {
    if (!tour) return;
    if (i >= tour.steps.length) { endTour(); return; }
    tourIdx = Math.max(0, i);
    applyTourStep(tourIdx);
    renderTourUI();
    armTourTimer();
  }
  function startTour(t, step) {
    if (!t) return;
    // ツアーが一時的に変える設定を退避 (再入時に上書きしない)
    if (!tourSaved) tourSaved = { showConst, showSelMark };
    tour = t;
    hideModals();
    setMenu(false);
    if (welcomeEl.classList.contains("open")) closeWelcome();
    tourApp.classList.add("tourMode");
    tourBar.classList.add("open");
    tourGo(Math.max(0, Math.min(t.steps.length - 1, step | 0)));
  }
  function endTour() {
    clearTourTimer();
    tour = null;
    if (tourSaved) {
      showConst = tourSaved.showConst;
      constBtn.classList.toggle("on", showConst);
      showSelMark = tourSaved.showSelMark;
      tourSaved = null;
    }
    tourApp.classList.remove("tourMode");
    tourBar.classList.remove("open");
    updateHint();
  }

  // 手動でカメラを動かしたら自動送りを止め、「シーンに戻す」を出す
  function tourTouch() {
    if (!tour || tourTouched) return;
    tourTouched = true;
    tourResumeBtn.hidden = false;
    clearTourTimer();
  }
  glc.addEventListener("pointerdown", tourTouch);
  glc.addEventListener("wheel", tourTouch, { passive: true });

  tourPrevBtn.addEventListener("click", () => tourGo(tourIdx - 1));
  tourNextBtn.addEventListener("click", () => tourGo(tourIdx + 1));
  tourCloseBtn.addEventListener("click", endTour);
  tourResumeBtn.addEventListener("click", () => { applyTourStep(tourIdx); armTourTimer(); });
  tourAutoBtn.addEventListener("click", () => {
    tourAuto = !tourAuto;
    renderTourUI();
    armTourTimer();
  });

  // ---------- ツアー一覧 (モーダル) ----------
  function buildTourList() {
    const t = T();
    tourListEl.innerHTML =
      '<button id="tourListClose" aria-label="close">✕</button>' +
      "<h2>" + t.menuTour + "</h2>" +
      TOURS.map((tr, i) =>
        '<div class="tourCard">' +
          "<h3>" + tourText(tr.title) + "</h3>" +
          "<p>" + tourText(tr.lead) + "</p>" +
          '<div class="tourMeta"><span>' + tr.steps.length + t.tourSteps + "</span>" +
          '<button class="tourStart" data-i="' + i + '">' + t.tourStart + "</button></div>" +
        "</div>").join("");
  }
  function openTourList() {
    buildTourList();
    tourListEl.classList.add("open");
    modalScrim.classList.add("on");
  }
  tourListEl.addEventListener("click", (e) => {
    if (e.target.id === "tourListClose") { hideModals(); return; }
    const btn = e.target.closest(".tourStart");
    if (btn) startTour(TOURS[+btn.dataset.i], 0);
  });
  menuTourBtn.addEventListener("click", () => { setMenu(false); openTourList(); });

  // 言語切替時に開いているものだけ作り直す (applyLang の末尾から呼ばれる)
  function refreshTourUI() {
    if (tour) {
      renderTourUI();
      // applyLang は選択天体の情報パネルを開き直すが、ツアー中は開かせない
      infoPanel.classList.remove("open");
    }
    if (tourListEl.classList.contains("open")) buildTourList();
  }

  window.addEventListener("keydown", (e) => {
    if (!tour || e.target !== document.body) return;
    if (e.code === "ArrowRight") { e.preventDefault(); tourGo(tourIdx + 1); }
    else if (e.code === "ArrowLeft") { e.preventDefault(); tourGo(tourIdx - 1); }
  });

  // ?tour=<id>&step=<n> で途中から開ける
  function applyTourURL() {
    const q = new URLSearchParams(location.search);
    const id = q.get("tour");
    if (!id) return false;
    const t = TOURS.find((x) => x.id === id);
    if (!t) return false;
    const n = parseInt(q.get("step"), 10);
    startTour(t, isFinite(n) ? n - 1 : 0);
    return true;
  }

