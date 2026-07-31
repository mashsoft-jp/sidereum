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
  const tourDoneEl = document.getElementById("tourDone");
  const menuTourBtn = document.getElementById("menuTour");
  const tourApp = document.getElementById("app");
  // ステップの ui: [...] で一時的に出す UI (既定ではツアー中は隠している)
  const TOUR_UI_EL = {
    controls: document.getElementById("controls"),
    nav: document.getElementById("navPanel"),
    menu: document.getElementById("menuBtn"),
    view: document.getElementById("viewMode"),
    clock: document.getElementById("clock"),
  };

  let tour = null;            // 実行中のツアー (null = 非実行)
  let tourIdx = 0;
  let tourAuto = false;       // 自動送り
  let tourTimer = 0;
  let tourTouched = false;    // このシーンで手動操作したか
  let tourSaved = null;       // ツアーが一時的に変える表示設定の退避先
  let tourAwaitTest = null;   // 現在のステップの達成判定 (null = 待っていない)
  let tourDoneTimer = 0;
  let tourHiEl = null;        // ハイライト中の要素
  let tourSceneDone = false;  // このツアーでシーンを一度でも適用したか
  let tourUntil = null;       // 早送りステップの停止日時 (simDays)

  const tourText = (o) => (o ? (lang === "ja" ? o.ja : o.en) : "");

  // 端末の出し分け。UI の位置はレイアウトで、操作方法は入力方式で変わるので
  // 「狭い画面」と「タッチ (ホバーできない粗いポインタ)」のどちらかで判定する
  const mqTouch = matchMedia("(hover: none) and (pointer: coarse)");
  const mqNarrow = matchMedia("(max-width: 720px), (max-height: 480px)");
  const isTouchUI = () => mqTouch.matches || mqNarrow.matches;
  const tourVisible = (t) => !t.platform || (t.platform === "touch") === isTouchUI();
  // 初回ガイドから開くチュートリアル (端末に合う方)
  function tutorialTour() {
    return TOURS.find((t) => t.id.indexOf("basics") === 0 && tourVisible(t)) || null;
  }

  // ステップ開始時にスナップショットを取り、毎フレーム「操作されたか」を見る述語を返す。
  // 入力ハンドラ側には手を入れない (操作の経路が増えたときに拾い漏らすため)
  const wrapPi = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const TOUR_AWAIT = {
    rotate: () => {
      const y = cam.yawTgt, p = cam.pitchTgt;
      return () => Math.abs(wrapPi(cam.yawTgt - y)) + Math.abs(cam.pitchTgt - p) > 0.18;
    },
    zoom: () => {
      const v = camZoomTgt;
      return () => Math.abs(Math.log(camZoomTgt / v)) > 0.2;
    },
    dist: () => {
      const v = cam.distTgt;
      return () => Math.abs(Math.log(cam.distTgt / v)) > 0.2;
    },
    pan: () => {
      const p = cam.panOffTgt.slice();
      return () => Math.hypot(cam.panOffTgt[0] - p[0], cam.panOffTgt[1] - p[1],
                              cam.panOffTgt[2] - p[2]) > cam.dist * 0.05;
    },
    select: () => {
      const b = selected;
      return () => !!selected && selected !== b;
    },
    play: () => {
      const p = playing;
      return () => playing !== p;
    },
    view: () => {
      const g = groundView, s = surfaceBody;
      return () => groundView !== g || surfaceBody !== s;
    },
    menu: () => () => menuEl.classList.contains("open"),
  };

  // 「この軌道半径 [au] が画面に収まる」カメラ距離。
  // 軌道面は俯角ぶん縦に潰れて見えるので、横 (半径そのもの) と縦 (半径×sin俯角)
  // の必要量を別々に出し、両方を満たす距離を採る。縦横比によらず同じ見え方になる
  function tourFitDist(au, mag, pitch) {
    const half = Math.tan(FOV / Math.max(1, mag) / 2);
    const r = au * K_REAL * 1.10;                       // 10% の余白込み
    const wide = r / (half * Math.max(0.2, (W / H) || 1));
    // 画面下部はナレーションバー (操作パネルを出すステップではその上まで) で隠れる。
    // 描画は画面中央基準なので、隠れる高さの半分ぶん縦が狭いものとして距離を出す
    const cover = tourBar.classList.contains("open")
      ? Math.max(0, H - tourBar.getBoundingClientRect().top) + 12 : 0;
    const vis = Math.max(0.5, 1 - cover * 0.55 / (H / 2));
    // 真横 (俯角0) では軌道が線に潰れるため、下限を入れて 0 除算相当を避ける
    const tall = r * Math.max(0.15, Math.abs(Math.sin(pitch))) / (half * vis);
    return Math.max(wide, tall);
  }

  // ステップが要求する UI の出し分け・ハイライト・ナレーションバーの位置
  function applyTourChrome(s) {
    for (const k in TOUR_UI_EL) {
      TOUR_UI_EL[k].classList.toggle("tourShow", !!s.ui && s.ui.indexOf(k) >= 0);
    }
    if (tourHiEl) tourHiEl.classList.remove("tourHi");
    tourHiEl = s.hi ? document.querySelector(s.hi) : null;
    if (tourHiEl) tourHiEl.classList.add("tourHi");
    // 操作パネルを出すステップはナレーションバーと重なるので、実高さぶん持ち上げる。
    // パネルの高さはビュー (宇宙/地上) で変わり、クラスを付けた直後はまだ確定して
    // いないことがあるので、次のフレームで測り直す
    liftTourBar();
    requestAnimationFrame(liftTourBar);
  }
  function liftTourBar() {
    const c = TOUR_UI_EL.controls;
    const up = c.classList.contains("tourShow") ? c.offsetHeight + 18 : 0;
    tourBar.style.bottom = up
      ? "calc(" + (18 + up) + "px + env(safe-area-inset-bottom, 0px))" : "";
  }

  // 操作の検知。達成したら「できました」を出し、少し置いてから次のステップへ
  function armTourAwait(s) {
    clearTimeout(tourDoneTimer);
    tourDoneTimer = 0;
    tourBar.classList.remove("done");
    const f = s.await && TOUR_AWAIT[s.await];
    tourAwaitTest = f ? f() : null;
    // until は再生するステップでだけ効かせる。停止中のステップにも効くと、
    // 畳み込みで引き継がれた until を開始時点で満たして即座に進んでしまう
    const t = s.play && s.until ? Date.parse(s.until + "Z") : NaN;
    tourUntil = isFinite(t) ? (t - J2000) / DAY_MS : null;
  }
  // 少し置いてから次のステップへ。「できました」は操作を検知したときの合図
  // なので、until で時間が来ただけの早送りステップでは出さない
  function tourAdvance(showDone) {
    if (showDone) tourBar.classList.add("done");
    tourDoneTimer = setTimeout(() => tourGo(tourIdx + 1), 900);
  }
  function tourWatch() {
    // 早送りのステップ: 指定日時に達したら止める。rAF が止まっていた時間は
    // 復帰フレームで一気に進むので、行き過ぎないよう日時も丸める
    if (tourUntil !== null && simDays >= tourUntil) {
      simDays = tourUntil;
      setPlaying(false);
      tourUntil = null;
      if (tourIdx < tour.steps.length - 1) tourAdvance(false);
      return;
    }
    if (!tourAwaitTest || !tourAwaitTest()) return;
    tourAwaitTest = null;
    tourAdvance(true);
  }
  // ツアー中でも、天体の選択を促しているステップだけはキャンバスのクリックを通す
  function tourAllowsSelect() {
    return !!tour && tourStateAt(tourIdx).await === "select";
  }

  // 0..i のステップを畳み込んだ状態 (書かれていない項目は前のステップを引き継ぐ)
  function tourStateAt(i) {
    const st = {};
    for (let k = 0; k <= i; k++) {
      const s = tour.steps[k];
      // 同じものを別々の書き方で指定する項目は、後から書いた方だけを残す。
      // 両方が畳み込まれると、適用側の優先順で先に書いた方が勝ってしまう
      if (s.d) delete st.dLocal;                                  // 日時
      if (s.dLocal) delete st.d;
      if (s.km !== undefined) { delete st.fit; delete st.z; }     // カメラ距離
      if (s.fit !== undefined) { delete st.km; delete st.z; }
      if (s.z !== undefined) { delete st.km; delete st.fit; }
      Object.assign(st, s);
    }
    return st;
  }

  function applyTourStep(i) {
    const s = tourStateAt(i);
    applyTourChrome(s);
    // 星座 (連動して黄道も) の一時的な出し分け。localStorage は書き換えない
    if (s.constel !== undefined) {
      showConst = !!s.constel;
      constBtn.classList.toggle("on", showConst);
    }
    // selected はカメラの注視先として使うだけなので、既定では選択マークを出さない
    showSelMark = !!s.mark;
    tourSight = s.sight || null;
    tourSpot = s.spot || null;
    tourTouched = false;
    tourResumeBtn.hidden = true;
    // 情報パネルはナレーションと重なるので、ステップが変わったら必ず閉じる
    // (チュートリアルで天体を選ばせたときも、次へ進む時点で畳む)
    infoPanel.classList.remove("open");
    // scene: false はナレーションと UI だけのステップ。畳み込みで前のシーン設定が
    // 毎回再適用されると、利用者が動かしたカメラが巻き戻ってしまうため必要。
    // ただしツアーの最初の1回だけは必ず適用する (?step=N で scene: false の
    // 途中から開いたときに、シーンが設定されないまま始まってしまうため)
    if (s.scene === false && tourSceneDone) { armTourAwait(s); return; }
    applyTourScene(s);
    tourSceneDone = true;
    armTourAwait(s);   // 検知のスナップショットはシーン適用の後に取る
  }

  function applyTourScene(s) {
    // 観測地はビューを開く前に決める (enterSurface が観測者基底を作り直すため)
    if (s.site) setObsSite(s.site[0], s.site[1]);
    if (s.view === "ground") enterGround();
    else if (s.view === "moon") enterMoon();
    else exitGround();
    if (s.d) {
      const t = Date.parse(/[zZ]$/.test(s.d) ? s.d : s.d + "Z");
      if (isFinite(t)) simDays = (t - J2000) / DAY_MS;
    } else if (s.dLocal) {
      // 観測地の平均太陽時での指定。地上ビューで「現地の何時の空か」を揃えたい
      // ステップに使う (UTC 固定だと観測地の経度によっては昼になってしまう)
      const t = Date.parse(s.dLocal + "Z");
      if (isFinite(t)) simDays = (t - J2000) / DAY_MS - obsLon / 360;
    }
    if (isFinite(s.spd) && s.spd > 0) {
      daysPerSec = s.spd;
      speedInput.value = Math.max(0, Math.min(100,
        Math.round(18 * Math.log(s.spd * 86400) / Math.log(60))));
      speedVal.textContent = T().ratePrefix + fmtDays(daysPerSec);
    }
    setPlaying(!!s.play);
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
    // 地上・月面ビュー: 今の日時で観測者基底を作り直してから照準を合わせる。
    // aimGroundAt は gTrack を立てるので、時間を進めても天体が中央に留まる
    if (groundView) {
      buildObsFrame();
      if (s.aim && b) aimGroundAt(b, true);
      if (isFinite(s.gfov)) {
        gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, s.gfov * DEG));
        gFov = gFovTgt;
      }
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
    // side: 彗星の尾を横から見る向きへ回り込む。尾は反太陽方向 (= 太陽から見た
    // 天体の方向) に伸びるリボンなので、軸を正面から見ると潰れて消えてしまう
    if (s.side && b) {
      const w = posW.get(b.key);
      cam.yawTgt = Math.atan2(w[2], w[0]) + Math.PI / 2;
    }
    const mag = isFinite(s.mag) ? Math.max(1, Math.min(MAG_MAX, s.mag)) : 1;
    camZoomTgt = mag;
    let dist = cam.distTgt;
    if (isFinite(s.km) && b) dist = s.km * KM2W;
    else if (isFinite(s.fit)) dist = tourFitDist(s.fit, mag, cam.pitchTgt);
    else if (isFinite(s.z)) dist = s.z;
    cam.distTgt = Math.min(1400, dist);
    resetPan();
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
    // 操作の検知で進むツアーでは自動送りに意味がないので出さない
    tourAutoBtn.hidden = !!tour.manual;
    tourAutoBtn.textContent = t.tourAuto;
    tourAutoBtn.classList.toggle("on", tourAuto);
    tourResumeBtn.textContent = t.tourResume;
    tourCloseBtn.title = t.tourExit;
    tourDoneEl.textContent = t.tourGood;
  }

  function tourGo(i) {
    if (!tour) return;
    if (i >= tour.steps.length) { endTour(); return; }
    tourIdx = Math.max(0, i);
    // 最後のシーンまで来たら視聴済みに (✕ で閉じても「見終えた」と扱う)
    if (tourIdx === tour.steps.length - 1) markTourSeen(tour);
    applyTourStep(tourIdx);
    renderTourUI();
    armTourTimer();
  }
  // ツアーは日時・ビュー・カメラ・速度・選択を書き換えるので、開始前の状態を
  // まるごと控えておき、終了時に戻す (tour.keep が真のツアーだけ戻さない)
  function captureTourState() {
    return {
      showConst, showSelMark,
      simDays, daysPerSec, playing,
      groundView, surfaceBody,
      selected, lastCenter,
      infoOpen: infoPanel.classList.contains("open"),
      yaw: cam.yawTgt, pitch: cam.pitchTgt, dist: cam.distTgt, mag: camZoomTgt,
      focus: cam.focusTgt.slice(), pan: cam.panOffTgt.slice(),
      gAz: gAzTgt, gAlt: gAltTgt, gFov: gFovTgt, gTrack,
      obsLat, obsLon,
    };
  }
  function restoreTourState(v, keepScene) {
    // 表示設定 (星座・選択マーク) はツアー中だけの一時変更なので必ず戻す
    showConst = v.showConst;
    constBtn.classList.toggle("on", showConst);
    showSelMark = v.showSelMark;
    if (keepScene) return;
    simDays = v.simDays;
    daysPerSec = v.daysPerSec;
    speedInput.value = Math.max(0, Math.min(100,
      Math.round(18 * Math.log(v.daysPerSec * 86400) / Math.log(60))));
    speedVal.textContent = T().ratePrefix + fmtDays(daysPerSec);
    setPlaying(v.playing);
    // 観測地はビューを開く前に戻す (setObsSite が localStorage も書き戻す)
    if (obsLat !== v.obsLat || obsLon !== v.obsLon) setObsSite(v.obsLat, v.obsLon);
    // ビューを戻してから地上の照準を書き戻す (enterSurface が再照準するため)
    if (v.groundView) enterSurface(v.surfaceBody);
    else exitGround();
    select(v.selected, false);
    lastCenter = v.lastCenter;
    if (!v.infoOpen) infoPanel.classList.remove("open");
    updatePositions();
    cam.yaw = cam.yawTgt = v.yaw;
    cam.pitch = cam.pitchTgt = v.pitch;
    cam.dist = cam.distTgt = v.dist;
    camZoom = camZoomTgt = v.mag;
    for (let i = 0; i < 3; i++) {
      cam.focus[i] = cam.focusTgt[i] = v.focus[i];
      cam.panOff[i] = cam.panOffTgt[i] = v.pan[i];
    }
    gAz = gAzTgt = v.gAz; gAlt = gAltTgt = v.gAlt; gFov = gFovTgt = v.gFov;
    gTrack = v.gTrack;   // ツアーの aim で立てた追尾を持ち越さない
  }

  function startTour(t, step) {
    if (!t) return;
    if (!tourSaved) tourSaved = captureTourState();   // 再入時は最初の状態を保つ
    tour = t;
    tourActive = true;
    tourSceneDone = false;
    if (t.manual) tourAuto = false;   // ボタンを隠すので、前のツアーの ON を持ち込まない
    hideModals();
    setMenu(false);
    if (welcomeEl.classList.contains("open")) closeWelcome();
    tourApp.classList.add("tourMode");
    tourBar.classList.add("open");
    tourGo(Math.max(0, Math.min(t.steps.length - 1, step | 0)));
  }
  function endTour() {
    clearTourTimer();
    clearTimeout(tourDoneTimer);
    tourDoneTimer = 0;
    tourAwaitTest = null;
    tourUntil = null;
    tourSight = null;
    tourSpot = null;
    const keepScene = !!(tour && tour.keep);
    tour = null;
    tourActive = false;
    if (tourSaved) { restoreTourState(tourSaved, keepScene); tourSaved = null; }
    for (const k in TOUR_UI_EL) TOUR_UI_EL[k].classList.remove("tourShow");
    if (tourHiEl) { tourHiEl.classList.remove("tourHi"); tourHiEl = null; }
    tourBar.style.bottom = "";
    tourBar.classList.remove("done", "open");
    tourApp.classList.remove("tourMode");
    updateHint();
  }

  // 手動でカメラを動かしたら自動送りを止め、「シーンに戻す」を出す
  function tourTouch() {
    if (!tour || tourTouched) return;
    // 操作を促しているステップは動かすのが目的なので、戻す導線を出さない
    if (tourStateAt(tourIdx).await) return;
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

  // ---------- 視聴済みの記録 ----------
  // { ツアーID: 最後に見終えた版 }。ツアー側の ver を上げると「更新あり」に戻る
  const TOUR_SEEN_KEY = "ssTourSeen";
  function loadTourSeen() {
    try { return JSON.parse(localStorage.getItem(TOUR_SEEN_KEY)) || {}; }
    catch (e) { return {}; }        // 壊れた値・プライベートモード
  }
  // 0 = 未視聴  1 = 更新あり (前の版は見終えた)  2 = 視聴済み
  function tourSeenState(tr, seen) {
    const v = seen[tr.id];
    return v === undefined ? 0 : (v >= (tr.ver || 1) ? 2 : 1);
  }
  function markTourSeen(tr) {
    const seen = loadTourSeen();
    if (seen[tr.id] === (tr.ver || 1)) return;
    seen[tr.id] = tr.ver || 1;
    try { localStorage.setItem(TOUR_SEEN_KEY, JSON.stringify(seen)); }
    catch (e) { /* プライベートモード等 */ }
  }

  // ハンバーガーメニューの「ガイドツアー」に付ける印を決める。
  // 0 = なし  1 = New (未視聴のツアーがある)  2 = Update (見た版より新しいものがある)
  function tourBadgeState() {
    const seen = loadTourSeen();
    let st = 0;
    for (const t of TOURS) {
      if (!tourVisible(t)) continue;
      const s = tourSeenState(t, seen);
      if (s === 0) return 1;
      if (s === 1) st = 2;
    }
    return st;
  }

  // ---------- ツアー一覧 (モーダル) ----------
  // 端末に合うものだけ並べる (URL 指定は絞らないので、他端末向けも確認できる)。
  // 番号は「その端末で見えるツアーの追加順」。並びは 未視聴・更新あり → 視聴済み で、
  // それぞれ番号順にする
  function buildTourList() {
    const t = T();
    const seen = loadTourSeen();
    const rows = TOURS
      .map((tr, i) => ({ tr, i }))
      .filter((r) => tourVisible(r.tr));
    rows.forEach((r, n) => { r.no = n + 1; r.st = tourSeenState(r.tr, seen); });
    rows.sort((a, b) => (a.st === 2) - (b.st === 2) || a.no - b.no);
    tourListEl.innerHTML =
      '<button id="tourListClose" aria-label="close">✕</button>' +
      "<h2>" + t.menuTour + "</h2>" +
      rows.map((r) =>
        '<div class="tourCard' + (r.st === 2 ? " done" : "") + '">' +
          '<h3><span class="tourNo">' + r.no + "</span>" + tourText(r.tr.title) +
          (r.st === 1 ? '<span class="tourNew">' + t.tourUpdated + "</span>" : "") +
          "</h3>" +
          "<p>" + tourText(r.tr.lead) + "</p>" +
          '<div class="tourMeta"><span>' + r.tr.steps.length + t.tourSteps + "</span>" +
          '<button class="tourStart" data-i="' + r.i + '">' +
          (r.st === 2 ? t.tourAgain : t.tourStart) + "</button></div>" +
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
  // 画面サイズや入力方式が変わったら一覧の出し分けを追従させる
  for (const mq of [mqTouch, mqNarrow]) {
    mq.addEventListener("change", () => {
      if (tourListEl.classList.contains("open")) buildTourList();
    });
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

