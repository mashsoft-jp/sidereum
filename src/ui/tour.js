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
  let tourHiEls = [];         // ハイライト中の要素 (hi は複数指定できる)
  let tourSceneDone = false;  // このツアーでシーンを一度でも適用したか
  let tourUntil = null;       // 早送りステップの停止日時 (simDays)
  let tourUntil0 = 0;         // 同じく開始日時 (どこまで進んだかを帯で出すため)
  let tourDoneKind = "";      // 合図の中身: "good" (操作を検知) / "played" (早送りが終わった)
  // 探査機視点の寄り (既定の倍率)。機体は記号として一定の画素数で描くので、
  // 寄せたぶんだけ天体だけが大きくなり、機体との大小の差が実物の比に近づく。
  // ステップの mag はこれに掛かる — 最接近距離は天体ごとに全く違うので
  // (タイタンは半径の 2.5倍、木星は 5倍)、寄りも回ごとに決められるようにする
  const RIDE_ZOOM = 2;
  // stay の頭打ちの滑らかさ (stay に対する割合)。大きいほど手前から緩む
  const STAY_SOFT = 0.6;

  const tourText = (o) => (o ? (lang === "ja" ? o.ja : o.en) : "");

  // ナレーション中の {mag} などを、操作パネルの行見出しアイコンそのものに置き換える。
  // 見出しを語からアイコンにしたので、文章側も「虫めがねの行」のような言い換えでは
  // なく現物を指す。複製元はパネルの要素そのもの — 別に持つと、アイコンを描き直した
  // ときに文章側だけ古いままになる。読み上げ用の隠しテキストも一緒に付いてくるので、
  // 音声では「ズームの行」と読まれる (言語切替にも自動で追従する)
  const TOUR_ICON = {
    speed: "speedLabel", mag: "magLabel", dist: "zoomLabel",
    angle: "angleLabel", az: "gAzLabel", alt: "gAltLabelTop", cam: "camIcon",
  };
  const escHTML = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  // トークンの前後の空白ごと拾う。アイコンにはその空白が要るが、日本語で語に
  // 戻したときは「パネルの 「カメラ」 プルダウン」と間延びするので落とす
  function tourTextHTML(s) {
    return escHTML(s).replace(/( ?)\{(\w+)\}( ?)/g, (m, pre, k, post) => {
      const el = TOUR_ICON[k] && document.getElementById(TOUR_ICON[k]);
      if (!el) return m;
      // 画面に出ていないアイコンを文章に出すと、探しても見つからないものを
      // 指すことになる (カメラは PC では文字のまま)。そのときは語で書く
      if (getComputedStyle(el).display === "none") {
        const w = el.querySelector(".vh");
        const t = w ? w.textContent : "";
        return lang === "ja" ? "「" + t + "」" : pre + "“" + t + "”" + post;
      }
      return pre + '<span class="inlIcon">' + el.innerHTML + "</span>" + post;
    });
  }

  // ナレーションの差し替え。iOS Safari は前の回の文字を残して描くことがあるので、
  // 1フレームだけ不透明度をずらして塗り直しを促す (0.999 は見た目に出ない)。
  // レイヤを作る指定は #tourBar 側から落としてあり、これはその上での保険
  function setTourText(html) {
    tourTextEl.innerHTML = html;
    tourTextEl.style.opacity = "0.999";
    requestAnimationFrame(() => { tourTextEl.style.opacity = ""; });
  }

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
  // 原則として入力ハンドラ側には手を入れない (操作の経路が増えたときに拾い漏らすため)。
  // 日時だけは結果の値から操作を見分けられないので、例外的に入力側で数えている
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
    // 「カメラ」の視点プリセットと「角度」スライダー。前者は俯角と距離の
    // 両方を動かすものがあるので、どちらかが変われば達成とする
    angle: () => {
      const p = cam.pitchTgt, d = cam.distTgt;
      return () => Math.abs(cam.pitchTgt - p) > 0.06 ||
                   Math.abs(Math.log(cam.distTgt / d)) > 0.2;
    },
    pan: () => {
      const p = cam.panOffTgt.slice();
      return () => Math.hypot(cam.panOffTgt[0] - p[0], cam.panOffTgt[1] - p[1],
                              cam.panOffTgt[2] - p[2]) > cam.dist * 0.05;
    },
    // pick が書いてあれば、その天体を選ぶまで達成にしない
    select: (s) => {
      const b = selected;
      if (s && s.pick) return () => !!selected && selected.key === s.pick;
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
    // 日時だけはスナップショットで見分けられない (再生でも simDays は動く)。
    // 入力欄・現在時刻ボタンで数えている編集回数を見る
    date: () => {
      const n = clockEdits;
      return () => clockEdits !== n;
    },
    // 時刻の基準 (端末 / 観測地 / UTC) の切替。観測地が端末と同じ時間帯だと
    // 観測地は飛ばされるが、どちらにせよ押せば clockMode は動く
    clocktz: () => {
      const m = clockMode;
      return () => clockMode !== m;
    },
    // 開いた瞬間を捉える。開いたまま次のステップへ来ることがあるので、
    // 現在の状態ではなく「閉じている状態から開いた」を条件にする
    menu: () => {
      let closed = !menuEl.classList.contains("open");
      return () => {
        if (!menuEl.classList.contains("open")) {
          closed = true;
          return false;
        }
        return closed;
      };
    },
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
  const vSliderEls = [document.getElementById("angleCell"), document.getElementById("gAltCell")];
  function applyTourChrome(s) {
    for (const k in TOUR_UI_EL) {
      TOUR_UI_EL[k].classList.toggle("tourShow", !!s.ui && s.ui.indexOf(k) >= 0);
    }
    // 右端の縦スライダーは操作パネルから独立した要素だが、出し入れは一組で扱う
    const ctl = !!s.ui && s.ui.indexOf("controls") >= 0;
    for (const el of vSliderEls) el.classList.toggle("tourShow", ctl);
    for (const el of tourHiEls) el.classList.remove("tourHi");
    tourHiEls = s.hi ? [...document.querySelectorAll(s.hi)] : [];
    for (const el of tourHiEls) el.classList.add("tourHi");
    // 操作パネルを出すステップはナレーションバーと重なるので、実高さぶん持ち上げる。
    // パネルの高さはビュー (宇宙/地上) で変わり、クラスを付けた直後はまだ確定して
    // いないことがあるので、次のフレームで測り直す
    liftTourBar();
    requestAnimationFrame(liftTourBar);
  }
  function liftTourBar() {
    const c = TOUR_UI_EL.controls;
    if (!c.classList.contains("tourShow")) {
      tourBar.style.bottom = "";
      return;
    }
    // パネルの実測位置から求める。パネル自身の下端はブレークポイントごとに違い
    // (セーフエリアも含む)、それを再計算すると必ずずれるので、画面下端から
    // パネル上端までの距離をそのまま使い、隙間だけ足す
    const up = Math.max(0, innerHeight - c.getBoundingClientRect().top) + 8;
    tourBar.style.bottom = up + "px";
  }
  // 端末を回すと操作パネルの高さ (レイアウトごと) が変わる。ステップを進めるまで
  // 測り直していなかったので、回転した瞬間からバーがパネルに重なったままだった
  addEventListener("resize", () => {
    if (tour) liftTourBar();
  });

  // 操作の検知。達成したら「できました」を出し、少し置いてから次のステップへ
  function armTourAwait(s) {
    clearTimeout(tourDoneTimer);
    tourDoneTimer = 0;
    tourBar.classList.remove("done", "ready");
    const f = s.await && TOUR_AWAIT[s.await];
    tourAwaitTest = f ? f(s) : null;
    // until は再生するステップでだけ効かせる。停止中のステップにも効くと、
    // 畳み込みで引き継がれた until を開始時点で満たして即座に進んでしまう
    const t = s.play && s.until ? Date.parse(s.until + "Z") : NaN;
    tourUntil = isFinite(t) ? (t - J2000) / DAY_MS : null;
    tourUntil0 = simDays;
    // このステップに「終わりを待つもの」があるかを見た目に出す。早送りの
    // 途中や操作待ちのあいだは 次へ を控えめにしておく — ナレーションを
    // 読んだだけでは、まだ何か起きるのか終わったのかが分からないため
    tourBar.classList.toggle("pending", !!tourAwaitTest || tourUntil !== null);
  }
  // 待っていたものが済んだときの合図。操作を検知したときと、早送りが終わった
  // ときとで言い方を変える (後者は利用者が何かしたわけではない)。
  // 次へ進むのは自動送りが ON のときだけ — OFF なら着いた場面のまま待つ。
  // 最後のステップでは進めない (自動送りでツアーが勝手に終わってしまう)
  function tourAdvance(showDone) {
    tourDoneKind = showDone ? "good" : "played";
    tourDoneEl.textContent = showDone ? T().tourGood : T().tourPlayed;
    tourBar.classList.remove("pending");
    tourBar.classList.add("done", "ready");
    if (!tourAuto || tourIdx >= tour.steps.length - 1) return;
    tourDoneTimer = setTimeout(() => tourGo(tourIdx + 1), 900);
  }
  function tourWatch() {
    // probeIn のステップ: カメラが目標に落ち着いてから探査機を出す
    // (寄っている最中に画面の真ん中で待たれていると、寄る動きが台無しになる)
    if (tourProbeHold &&
        Math.abs(Math.log(cam.dist / (cam.distTgt || cam.dist))) < 0.03 &&
        Math.abs(wrapPi(cam.yaw - cam.yawTgt)) < 0.03) {
      tourProbeHold = false;
    }
    // 早送りのステップ: どこまで進んだかを帯で出しつつ、指定日時に達したら
    // 止める。止まる時刻は画面に出ていないので、帯が無いと「まだ動くのか、
    // もう終わったのか」が分からない。
    // rAF が止まっていた時間は復帰フレームで一気に進むので、行き過ぎない
    // よう日時も丸める
    if (tourUntil !== null) {
      const span = tourUntil - tourUntil0;
      tourProgEl.style.transition = "none";
      tourProgEl.style.width =
        (span > 0 ? Math.max(0, Math.min(1, (simDays - tourUntil0) / span)) : 1) * 100 + "%";
      if (simDays >= tourUntil) {
        simDays = tourUntil;
        setPlaying(false);
        tourUntil = null;
        tourAdvance(false);
        return;
      }
    }
    if (!tourAwaitTest || !tourAwaitTest()) return;
    tourAwaitTest = null;
    tourAdvance(true);
  }
  // ツアー中でも、天体の選択を促しているステップだけはキャンバスのクリックを通す
  function tourAllowsSelect() {
    return !!tour && tourStateAt(tourIdx).await === "select";
  }
  // 選ばせる天体を1つに絞っているステップ (pick) では、それ以外は選ばせない
  function tourAllowsBody(b) {
    if (!tour) return true;
    const pick = tourStateAt(tourIdx).pick;
    return !pick || (!!b && b.key === pick);
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
      // ビュー切替などが画面上に出ている端末 (タブレット等) 向けの差し替え。
      // 狭い画面ではハンバーガーメニューの中に入るので、案内する場所が変わる
      if (!mqNarrow.matches && s.wide) Object.assign(st, s.wide);
    }
    return st;
  }

  function applyTourStep(i) {
    const s = tourStateAt(i);
    applyTourChrome(s);
    // 星座 (連動して黄道も) の一時的な出し分け。localStorage は書き換えない
    if (s.constel !== undefined) {
      showConst = !!s.constel;
      updateConstLabel();
    }
    // 軌道線の一時的な出し分け。探査機視点のように「写真」として見せる場面では、
    // 画面を横切る線が邪魔になる。localStorage は書き換えない
    if (s.orbits !== undefined) {
      for (const b of ORBIT_BODIES) b.showOrbit = !!s.orbits;
      syncToggleUI();   // 一覧の行のトグルもここで合わせる (まとめ切替だけでは食い違う)
    }
    // 風景 (地面の質感・空の色) は、書いた回だけ触る。経緯線のように既定 OFF を
    // 毎回押しつけると、風景を出して使っている人の見え方をツアーが勝手に変えて
    // しまう。localStorage は書き換えず、開始前の状態は終了時に戻す
    if (s.sky !== undefined) {
      showTerrain = !!s.sky;
      updateTerrainLabel();
    }
    // 天球の経緯線は、書いた回だけ出す (既定は消す — 星座や軌道と違い、ツアーで
    // 見せたい天体の前を格子が横切るだけになる回がほとんど)。localStorage は
    // 書き換えず、開始前の状態は終了時に戻す
    showGrid = !!s.grid;
    updateGridLabel();
    // selected はカメラの注視先として使うだけなので、既定では選択マークを出さない
    showSelMark = !!s.mark;
    tourSight = s.sight || null;
    tourSpot = s.spot || null;
    // 引きの画から乗り移るときだけ、寄り切るまで時間を止める。探査機視点の
    // まま次の天体へ向き直る回 (タイタン → 土星) は止めずに飛び続けさせる
    tourProbeHold = !!s.probeIn;
    tourRide = s.ride || null;
    tourRideOn = s.on || tourProbe;      // その回に乗る機体 (既定は主役)
    tourRideStay = isFinite(s.stay) ? s.stay * KM2W : 0;
    tourProbeDot = !!s.dot;
    tourRideSlow = isFinite(s.slow) ? s.slow : 0.06;
    tourRideWarm = isFinite(s.warm) ? s.warm : 0;
    tourRideT0 = simDays;
    tourPath = !!s.path;
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
      speedVal.textContent = fmtRate(daysPerSec);
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
    // 探査機視点の減速に使う基準距離 (このステップの開始時点の距離)
    tourRideSpd = 0;
    tourRideRef = 0;
    if (s.ride && tourRideOn && isFinite(s.spd)) {
      const e = posW.get(tourRideOn), f = posW.get(s.ride);
      tourRideRef = Math.hypot(e[0] - f[0], e[1] - f[1], e[2] - f[2]);
      tourRideSpd = s.spd;
    }
    // 地上・月面ビュー: 今の日時で観測者基底を作り直してから照準を合わせる。
    // aimGroundAt は gTrack を立てるので、時間を進めても天体が中央に留まる
    if (groundView) {
      buildObsFrame();
      if (s.aim && b) aimGroundAt(b, true);
      else if (s.radiant) aimGroundAtRadiant(s.radiant, true);
      if (isFinite(s.gfov)) {
        gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, s.gfov * DEG));
        gFov = gFovTgt;
      }
    }
    // ride のステップはカメラを tourRideCam が毎フレーム決める。ここで目標を
    // 書き換えると、次のフレームの緩和が先に効いてカメラが一瞬飛んでしまう。
    // 倍率だけは決めておく (mag × RIDE_ZOOM)
    if (s.ride) {
      tourRideZoom = Math.max(1, Math.min(MAG_MAX,
        (isFinite(s.mag) ? s.mag : 1) * RIDE_ZOOM));
      camZoom = camZoomTgt = tourRideZoom;
      return;
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
    // apart: 中心天体と指定天体を画面上で離して見せる。探査機のフライバイでは
    // 両者が視線方向に重なることがあるので、結ぶ線と視線が直交する向きへ回り込む。
    // 直交する向きは無数にあるので、いまの向き (lit や a・y で決めたもの) を
    // その平面へ落とした方向 — つまり最も近い直交方向 — を採る
    if (s.apart && b) {
      const o = posW.get(s.apart), w = posW.get(b.key);
      let ux = o[0] - w[0], uy = o[1] - w[1], uz = o[2] - w[2];
      const ul = Math.hypot(ux, uy, uz);
      if (ul > 1e-12) {
        ux /= ul; uy /= ul; uz /= ul;
        const cp = Math.cos(cam.pitchTgt);
        let vx = cp * Math.cos(cam.yawTgt), vy = Math.sin(cam.pitchTgt), vz = cp * Math.sin(cam.yawTgt);
        const d = vx * ux + vy * uy + vz * uz;
        vx -= d * ux; vy -= d * uy; vz -= d * uz;
        const vl = Math.hypot(vx, vy, vz);
        if (vl > 1e-6) {
          cam.yawTgt = Math.atan2(vz / vl, vx / vl);
          cam.pitchTgt = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, Math.asin(vy / vl)));
        }
      }
    }
    // front: 指定天体が中心天体の手前に重なる向きへ回り込む (apart の逆)。
    // 中心天体から見た指定天体の方向にカメラを置くので、km を指定天体までの
    // 距離より大きくすれば、指定天体が中心天体の円盤を背にして写る
    if (s.front && b) {
      const o = posW.get(s.front), w = posW.get(b.key);
      const dx = o[0] - w[0], dy = o[1] - w[1], dz = o[2] - w[2];
      const l = Math.hypot(dx, dy, dz);
      if (l > 1e-12) {
        cam.yawTgt = Math.atan2(dz, dx);
        cam.pitchTgt = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, Math.asin(dy / l)));
      }
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
    // cut: 緩和を挟まず、その場でカメラを置く (カット割り)。食のように「同じ
    // 構図で日時だけ違う」回が続くところでは、行きつ戻りつするたびに寄り引きが
    // 大きく振られて酔う。ズームは緩和させず一致させる
    if (s.cut) {
      cam.yaw = cam.yawTgt;
      cam.pitch = cam.pitchTgt;
      cam.dist = cam.distTgt;
      cam.focus[0] = cam.focusTgt[0];
      cam.focus[1] = cam.focusTgt[1];
      cam.focus[2] = cam.focusTgt[2];
      camZoom = camZoomTgt;
    }
  }

  // ride: 探査機の位置にカメラを置き、指定天体を見続ける (探査機視点)。
  //
  // カメラは (注視点 + 距離 + 角度) で持っているが、ここで緩和させるのは
  // 「カメラの位置」と「向き・距離」で、注視点はそこから逆算する。
  // 探査機視点のカメラ。機体そのものではなく、機体の少し後方に置く (機体が
  // 前景に入り、どこから何を見ているのかが画で分かる)。
  //
  // 位置も向きも、その瞬間の機体と目標の関係だけから決める (緩和を挟まない)。
  // 挟むと、目標が変わる回で前の構図から繋ごうとして機体が画面上を滑るうえ、
  // 早送りが終わって時計が止まったあともカメラだけが動き続ける。回の切り替えは
  // カメラの乗り換え = カットとして扱う。
  // 目標に対する機体の進行方向 (world)。フライバイで軌道が曲がる向きを知るために、
  // 前後の時刻の位置差から求める (再生が止まっていても値は決まる)
  const RIDE_H = 0.002;      // 差分に使う時間幅 [日] ≒ 3分
  const _rv = [[0,0,0],[0,0,0],[0,0,0],[0,0,0]];
  function rideVel(pr, tb, out) {
    for (let i = 0; i < 2; i++) {
      const t = simDays + (i ? RIDE_H : -RIDE_H);
      if (!probeAU(pr, t, _rv[0])) return null;
      toWorld(_rv[0], _rv[i * 2]);
      toWorld(wayAU(tb.key, t, _rv[1]), _rv[i * 2 + 1]);
      _rv[i * 2][0] -= _rv[i * 2 + 1][0];
      _rv[i * 2][1] -= _rv[i * 2 + 1][1];
      _rv[i * 2][2] -= _rv[i * 2 + 1][2];
    }
    out[0] = _rv[2][0] - _rv[0][0];
    out[1] = _rv[2][1] - _rv[0][1];
    out[2] = _rv[2][2] - _rv[0][2];
    const l = Math.hypot(out[0], out[1], out[2]);
    if (l < 1e-18) return null;
    out[0] /= l; out[1] /= l; out[2] /= l;
    return out;
  }
  const _rq = [0, 0, 0];

  function tourRideCam() {
    if (!tourRide || groundView) { tourRideMag = 1; return; }
    const pr = tourRideOn ? BODY_BY_KEY.get(tourRideOn) : null;
    const tb = BODY_BY_KEY.get(tourRide);
    if (!pr || !tb || !pr.live) return;
    const p = posW.get(pr.key), f = posW.get(tb.key);
    let bx = p[0] - f[0], by = p[1] - f[1], bz = p[2] - f[2];
    const bd = Math.hypot(bx, by, bz);
    if (bd < 1e-12) return;
    bx /= bd; by /= bd; bz /= bd;          // 目標 → 機体 の向き
    // 機体の少し後方、やや右上へ引いた視点。機体が前景に入り、目標は中央に残る。
    // 引く量は目標までの距離に比例させるので、どの場面でも同じ構図になる。
    // 6% は近クリップ面 (カメラ距離の 2%) より手前に機体が来ないための下限も
    // 兼ねている — 2%前後だと機体がクリップされて消える。
    // 横と上へのずらしは実効画角に対する割合で決める — 望遠 (mag) の回で
    // 機体が画面の外へ出ないようにするため
    let rx = -bz, ry = 0, rz = bx;         // b × 上 (画面の右方向)
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    const ux = ry * bz - rz * by, uy = rz * bx - rx * bz, uz = rx * by - ry * bx;
    // 画面上で機体をどこに置くか (視線からのずらし)。基準は少し左上 — 下は
    // ナレーションバーで隠れる。そこへ「進行方向」ぶんを足すと、軌道が曲がる
    // フライバイでは機体が惑星の脇へ回り込んでいく動きが画に出る (遠くを直進
    // しているうちは進行方向が目標を向いていて、この項は効かない)。
    // 履歴ではなく現在の位置関係だけで決まるので、時計が止まればカメラも止まる
    const off = Math.tan(eFov() * 0.5 * 0.42);
    let lx = -off * 0.80 * rx + off * 0.55 * ux;
    let ly =                    off * 0.55 * uy;
    let lz = -off * 0.80 * rz + off * 0.55 * uz;
    if (rideVel(pr, tb, _rq)) {
      const vb = _rq[0] * bx + _rq[1] * by + _rq[2] * bz;
      lx += (_rq[0] - bx * vb) * off * 1.2;
      ly += (_rq[1] - by * vb) * off * 1.2;
      lz += (_rq[2] - bz * vb) * off * 1.2;
    }
    // 画面の外へ出ないよう頭打ち (実効画角の 2/3 まで)
    const ll = Math.hypot(lx, ly, lz), lim = off * 1.6;
    if (ll > lim) { const s2 = lim / ll; lx *= s2; ly *= s2; lz *= s2; }
    // 目標に近づくほど機体を大きく描く。物理的に正しい追走 (機体の見かけは一定で
    // 惑星だけが育つ) は、画としては動きが乏しい。開始時の距離を基準に、寄って
    // いくカメラのように機体を最大 3.2倍まで大きくする。離れ始めれば戻る
    // 寄りで割るのは、寄せたぶんまで機体が大きくならないようにするため
    // (機体の画素数は camZoom に比例する)。天体だけが寄りのぶん大きくなる
    tourRideMag = (tourRideRef > 0
      ? Math.min(3.2, Math.max(1, Math.sqrt(tourRideRef / bd))) : 1) / tourRideZoom;
    const back = bd * 0.06;
    const e = [p[0] + back * (bx - lx),
               p[1] + back * (by - ly),
               p[2] + back * (bz - lz)];
    // stay: 目標天体が画面を覆うところまで来たら、それ以上は寄らない。
    // そこから先も追走すると、画面が塗り潰されたまま何も動かない画になる。
    // 距離を頭打ちにするだけで、向きは機体を追い続ける。急に止めると不自然なので
    // stay の STAY_EASE 倍のあたりから緩めて漸近させる (g(1)=1, g'(1)=1 で
    // 手前と滑らかに繋がり、g'(0)=0 なので止まるところで速度が 0 になる)。
    // 置いていかれた機体は画素固定をやめて小さく描く — 落ちていくのが画に出る
    if (tourRideStay > 0) {
      const dc = Math.hypot(e[0] - f[0], e[1] - f[1], e[2] - f[2]) || 1;
      // 追走の距離 dc を stay で頭打ちにする。max(dc, stay) をそのまま使うと
      // 止まる瞬間に速度が跳ぶので、滑らかにした softplus を使う。これは常に
      // dc 以上になるのが効いていて、カメラが機体より内側へ入り込まない —
      // 内側へ入ると機体を追い越してしまい、機体が画面の外へ飛び出してから
      // 戻ってくる (単純に「stay へ寄せる」補間だとこれが起きた)
      const a = tourRideStay * STAY_SOFT;
      const x = (dc - tourRideStay) / a;
      const k = (tourRideStay + a * (x > 30 ? x : Math.log(1 + Math.exp(x)))) / dc;
      if (k > 1.0001) {
        e[0] = f[0] + (e[0] - f[0]) * k;
        e[1] = f[1] + (e[1] - f[1]) * k;
        e[2] = f[2] + (e[2] - f[2]) * k;
        // 置いていかれたぶん機体は小さく描く (画素固定をやめる)
        const pd = Math.hypot(e[0] - p[0], e[1] - p[1], e[2] - p[2]) || 1;
        tourRideMag *= Math.max(0.25, Math.min(1, back / pd));
      }
    }
    const dx = e[0] - f[0], dy = e[1] - f[1], dz = e[2] - f[2];
    const d = Math.hypot(dx, dy, dz);
    // カメラは緩和を通さず、その瞬間の位置関係から直接決める。目標が変わる回
    // (木星 → イオ) は視点も距離も別物なので、繋ごうとすると機体が画面上を
    // 大きく滑ってしまう。回では切り替え = カットとして扱う
    cam.focus[0] = f[0]; cam.focus[1] = f[1]; cam.focus[2] = f[2];
    cam.dist = d;
    cam.yaw = Math.atan2(dz, dx);
    cam.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, Math.asin(dy / d)));
    for (let i = 0; i < 3; i++) { cam.panOff[i] = 0; cam.panOffTgt[i] = 0; }
    // 次フレームの緩和 (frame) が二重に効かないよう、目標は現在値に揃える
    cam.focusTgt[0] = cam.focus[0];
    cam.focusTgt[1] = cam.focus[1];
    cam.focusTgt[2] = cam.focus[2];
    cam.distTgt = cam.dist;
    cam.yawTgt = cam.yaw;
    cam.pitchTgt = cam.pitch;
    // 近づくほど遅くする — 見かけの大きさは 1/距離 なので、一定速度だと
    // 遠くが長く、最接近が一瞬で終わってしまう
    if (tourRideSpd > 0 && tourRideRef > 0) {
      // 目標に近いほど遅く。加えて warm があれば出だしも遅くする — 距離だけで
      // 決めると、出発直後 (まだ遠い) が一番速くなり、分離の瞬間が一瞬で終わる
      let f = Math.min(1, d / tourRideRef);
      if (tourRideWarm > 0) f = Math.min(f, (simDays - tourRideT0) / tourRideWarm);
      daysPerSec = tourRideSpd * Math.max(tourRideSlow, f);
    }
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
    // 早送り中のステップは until が終点。滞留タイマーで途中で切らない
    if (tourUntil !== null) return;
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
    setTourText(tourTextHTML(tourText(tourStateAt(tourIdx).text)));
    tourDotsEl.innerHTML = tour.steps
      .map((_, i) => '<i class="' + (i === tourIdx ? "on" : "") + '"></i>').join("");
    tourPrevBtn.disabled = tourIdx === 0;
    tourNextBtn.textContent = tourIdx === tour.steps.length - 1 ? t.tourDone : t.tourNext;
    // 操作の検知で進むツアーでは自動送りに意味がないので出さない
    tourAutoBtn.textContent = t.tourAuto;
    tourAutoBtn.classList.toggle("on", tourAuto);
    tourResumeBtn.textContent = t.tourResume;
    tourCloseBtn.title = t.tourExit;
    tourDoneEl.textContent = tourDoneKind === "played" ? t.tourPlayed : t.tourGood;
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
      showConst, showSelMark, showGrid, showTerrain,
      orbits: ORBIT_BODIES.map((b) => b.showOrbit),
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
    // 表示設定 (星座・経緯線・選択マーク) はツアー中だけの一時変更なので必ず戻す
    showConst = v.showConst;
    updateConstLabel();
    showGrid = v.showGrid;
    updateGridLabel();
    showTerrain = v.showTerrain;
    updateTerrainLabel();
    ORBIT_BODIES.forEach((b, i) => { b.showOrbit = v.orbits[i]; });
    syncToggleUI();
    showSelMark = v.showSelMark;
    if (keepScene) return;
    simDays = v.simDays;
    daysPerSec = v.daysPerSec;
    speedInput.value = Math.max(0, Math.min(100,
      Math.round(18 * Math.log(v.daysPerSec * 86400) / Math.log(60))));
    speedVal.textContent = fmtRate(daysPerSec);
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
    gRadTrack = "";      // 放射点の追尾も同様
  }

  function startTour(t, step) {
    if (!t) return;
    exitAR();   // ツアーはカメラを自分で置くので、センサーに向きを取られては困る
    if (!tourSaved) tourSaved = captureTourState();   // 再入時は最初の状態を保つ
    // 自動送りはツアーごとに OFF から。前のツアーで入れたまま次を始めると、
    // 見るつもりで開いた場面が勝手に流れていってしまう。
    // (endTour ではなくここで落とす — ツアー一覧から別のツアーへ直接移ると
    //  endTour を通らない)
    tourAuto = false;
    tour = t;
    tourActive = true;
    tourProbes = t.probe ? (Array.isArray(t.probe) ? t.probe : [t.probe]) : null;
    tourProbe = tourProbes ? tourProbes[0] : null;
    tourRideOn = tourProbe;
    tourSceneDone = false;
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
    tourProbes = null;
    tourProbe = null;
    tourRideOn = null;
    tourRide = null;
    tourPath = false;
    tourRideMag = 1;
    tourRideStay = 0;
    tourProbeDot = false;
    tourRideSlow = 0.06;
    tourRideWarm = 0;
    tourProbeHold = false;
    const keepScene = !!(tour && tour.keep);
    tour = null;
    tourActive = false;
    if (tourSaved) { restoreTourState(tourSaved, keepScene); tourSaved = null; }
    for (const k in TOUR_UI_EL) TOUR_UI_EL[k].classList.remove("tourShow");
    for (const el of tourHiEls) el.classList.remove("tourHi");
    tourHiEls = [];
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






