  // ---------- 操作方法 (モーダル) ----------
  const menuHelpBtn = document.getElementById("menuHelp");
  const howtoEl = document.getElementById("howto");
  const modalScrim = document.getElementById("modalScrim");
  // モーダル(操作方法/ライセンス)を閉じる。背景スクリムのクリックでも閉じられる
  function hideModals() {
    aboutEl.classList.remove("open");
    howtoEl.classList.remove("open");
    tourListEl.classList.remove("open");
    skyCalEl.classList.remove("open");
    todayEvEl.classList.remove("open");
    closeSnapDlg();
    modalScrim.classList.remove("on");
  }
  modalScrim.addEventListener("click", hideModals);
  function buildHowto() {
    const c = lang === "ja" ? {
      title: "操作方法", space: "宇宙ビュー", ground: "地上・月面ビュー", common: "共通",
      space_rows: [
        ["回転", "ドラッグ (1本指ドラッグ)"],
        ["ズーム", "ホイール / ピンチ"],
        ["距離", "Shift+ホイール / 3本指の上下ドラッグ (上で接近)、またはパネルの {dist} の行"],
        ["平行移動", "右ドラッグ / 2本指ドラッグ"],
        ["天体", "クリック / タップで選択・接近 (再度で枠と説明を隠す・何もない所で解除)"],
        ["視点", "パネルの {cam} プルダウン・右端の縦のスライダー"],
      ],
      ground_rows: [
        ["見回し", "ドラッグ"],
        ["ズーム", "ホイール / ピンチ"],
        ["方位・高度", "パネルのスライダー"],
        ["天体", "タップで選択・追尾"],
        ["観測地", "メニュー「観測地」(地上) / パネルの地点選択 (月面)"],
        ["AR", "上部の「AR」(スマホ・タブレット)。端末を空へ向けると、その向きの空が出る。星を実際の位置へドラッグして方位を補正"],
      ],
      common_rows: [
        ["ビュー切替", "上部の 宇宙 / 地上 / 月面"],
        ["検索", "タイトル横の 🔍 (または / キー)。天体・星座・星雲・流星群を名前で探して飛ぶ"],
        ["ガイドツアー", "メニュー「ガイドツアー」(← → で移動・自動送りあり)"],
        ["天文カレンダー", "メニュー「天文カレンダー」(上の年をタップで切替・「見る」でその場面へ)。できごとの日に開くと、その日のぶんを最初に案内"],
        ["日時", "右上の日付・時刻をタップ・「現在時刻に合わせる」"],
        ["時刻の基準", "時計の右端 (JST など) をタップ → 端末 / LMT (観測地の地方時) / UTC"],
        ["再生・速度", "下部パネル"],
        ["表示切替", "左上の 軌道 / 名前 (天体リストの上)"],
        ["星座", "メニュー「星座」(星座線・星座名。黄道も連動)"],
        ["経緯線", "メニュー「経緯線」(天球の赤経・赤緯)"],
        ["星雲・星団", "メニュー「星雲・星団」(メシエ天体)"],
        ["風景", "メニュー「風景を表示」(地面の質感・地平の稜線・空の色)"],
        ["共有", "メニュー「共有…」(いまの画面を画像に。保存・共有シート・場面のリンクをコピー)"],
        ["設定", "メニュー (画質・単位・言語)"],
      ],
    } : {
      title: "Controls", space: "Space view", ground: "Ground / Moon view", common: "General",
      space_rows: [
        ["Rotate", "Drag (one-finger drag)"],
        ["Zoom", "Wheel / pinch"],
        ["Distance", "Shift+wheel / three-finger drag (up to approach), or the {dist} row in the panel"],
        ["Pan", "Right-drag / two-finger drag"],
        ["Bodies", "Click / tap to select & approach (again hides the ring & panel · empty space deselects)"],
        ["Viewpoint", "The {cam} dropdown & the vertical slider at the right edge"],
      ],
      ground_rows: [
        ["Look around", "Drag"],
        ["Zoom", "Wheel / pinch"],
        ["Azimuth / Alt.", "Sliders in the panel"],
        ["Bodies", "Tap to select & track"],
        ["Location", "Menu “Location” (ground) / site picker (Moon)"],
        ["AR", "“AR” at the top (phones & tablets). Point the device at the sky to see that part of it. Drag a star onto its real position to correct the heading"],
      ],
      common_rows: [
        ["Switch view", "Space / Ground / Moon at the top"],
        ["Search", "🔍 next to the title (or the / key). Find bodies, constellations, deep-sky objects and showers by name"],
        ["Guided tour", "Menu “Guided tour” (← → to move · auto-advance available)"],
        ["Sky calendar", "Menu “Sky calendar” (tap the year to switch · “Show” jumps to the scene). On an event day it opens with that day first"],
        ["Date & time", "Tap the date or time top-right · “Set to current time”"],
        ["Time base", "Tap the zone label on the clock → device / LMT (local mean time at the site) / UTC"],
        ["Play & speed", "Bottom panel"],
        ["Toggles", "Orbits / Labels (above the body list, top-left)"],
        ["Constellations", "Menu → “Constellations” (lines and names; the ecliptic follows)"],
        ["Coordinate grid", "Menu “Coordinate grid” (RA & Dec on the sky)"],
        ["Deep-sky", "Menu “Deep-sky objects” (Messier catalog)"],
        ["Scenery", "Menu “Show scenery” (ground texture, ridgeline, sky color)"],
        ["Share", "Menu “Share…” (capture the screen as an image · save · share sheet · copy a link to this scene)"],
        ["Settings", "Menu (quality · units · language)"],
      ],
    };
    // {dist} などは操作パネルの行見出しアイコンに展開する (ツアーと同じ仕組み)
    const tbl = (rows) => `<table><tbody>` +
      rows.map((r) => `<tr><td>${r[0]}</td><td>${tourTextHTML(r[1])}</td></tr>`).join("") + `</tbody></table>`;
    howtoEl.innerHTML =
      `<button id="howtoClose" aria-label="close">✕</button>` +
      `<h2>${c.title}</h2>` +
      `<h3>${c.space}</h3>${tbl(c.space_rows)}` +
      `<h3>${c.ground}</h3>${tbl(c.ground_rows)}` +
      `<h3>${c.common}</h3>${tbl(c.common_rows)}`;
  }
  function openHowto() { buildHowto(); howtoEl.classList.add("open"); modalScrim.classList.add("on"); }
  menuHelpBtn.addEventListener("click", () => { setMenu(false); openHowto(); });
  howtoEl.addEventListener("click", (e) => {
    if (e.target.id === "howtoClose") hideModals();
  });

  // ---------- 初回ガイド (welcome overlay) ----------
  const welcomeEl = document.getElementById("welcome");
  function buildWelcome() {
    const c = lang === "ja" ? {
      yomi: "(シデレウム)",
      lead: "太陽系を自由に見てまわれる Web プラネタリウムです。",
      rows: ["ドラッグで回転", "ホイール / ピンチでズーム", "天体をタップで選択・接近", "画面上部で 宇宙 / 地上 / 月面 を切替"],
      start: "とりあえず動かす",
    } : {
      yomi: "",
      lead: "A web planetarium for exploring the Solar System.",
      rows: ["Drag to rotate", "Wheel / pinch to zoom", "Tap a body to select & approach", "Switch Space / Ground / Moon at the top"],
      start: "Just explore",
    };
    welcomeEl.innerHTML =
      `<div id="welcomeCard">` +
        `<h2 class="logo">SIDEREUM<span class="yomi">${c.yomi}</span></h2>` +
        `<p class="lead">${c.lead}</p>` +
        `<ul>${c.rows.map((r) => `<li>${r}</li>`).join("")}</ul>` +
        // 操作方法の一覧はメニューからいつでも開けるので、ここには出さない。
        // 初めての人にはガイドツアーの方が近道なので、そちらを主役にする
        `<div id="welcomeBtns">` +
          `<button id="welcomeStart">${c.start}</button>` +
          `<button id="welcomeTour">${T().welcomeTour}</button>` +
        `</div>` +
      `</div>`;
  }
  function closeWelcome() {
    welcomeEl.classList.remove("open");
    try { localStorage.setItem("ssGuideSeen", "1"); } catch (e) { /* プライベートモード等 */ }
  }
  welcomeEl.addEventListener("click", (e) => {
    if (e.target.id === "welcomeStart" || e.target === welcomeEl) closeWelcome();
    // 端末に合うチュートリアルを開始 (startTour が closeWelcome も行う)
    else if (e.target.id === "welcomeTour") startTour(tutorialTour(), 0);
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      hideModals();
      if (welcomeEl.classList.contains("open")) closeWelcome();
      setMenu(false);
    }
  });

  // ---------- 言語切替 ----------
  // 操作パネルの行見出しはアイコンなので、語はホバーの title と読み上げ用の
  // 隠しテキストに入れる (textContent で置くとアイコンごと消える)
  function setCtlLabel(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.title = text;
    const vh = el.querySelector(".vh");
    if (vh) vh.textContent = text;
  }
  function applyLang() {
    const t = T();
    document.documentElement.lang = lang;
    document.title = t.title;
    document.getElementById("hint").textContent = hintText();
    document.getElementById("noGL").innerHTML = t.noGL;
    setCtlLabel("speedLabel", t.speed);
    setCtlLabel("zoomLabel", t.distance);
    setCtlLabel("magLabel", t.gFovLabel);
    setCtlLabel("angleLabel", t.angle);
    setCtlLabel("camIcon", t.camera);
    setMasterTgl(orbitsBtn, ICON_ORBIT, t.orbits);
    setMasterTgl(labelsBtn, ICON_NAME, t.labels);
    const camOpts = camSelect.options;
    camOpts[0].textContent = t.camera;
    camOpts[1].textContent = t.viewTop;
    camOpts[2].textContent = t.viewDef;
    camOpts[3].textContent = t.viewSide;
    camOpts[4].textContent = t.reset;
    vmSpaceBtn.textContent = t.viewSpace;
    vmGroundBtn.textContent = t.viewGround;
    vmMoonBtn.textContent = t.viewMoon;
    vmARBtn.textContent = t.viewAR;
    const vmOpts = vmSelect.options;
    vmOpts[0].textContent = t.viewSpace;
    vmOpts[1].textContent = t.viewGround;
    vmOpts[2].textContent = t.viewMoon;
    if (vmOpts[3]) vmOpts[3].textContent = t.viewAR;   // 非対応の端末では取り除かれている
    updateVmSelect();
    rebuildMoonSites();
    setCtlLabel("gFovLabel", t.gFovLabel);
    setCtlLabel("gAzLabel", t.gAzLabel);
    setCtlLabel("gAltLabelTop", t.gAltLabel);
    ctrlCollapseBtn.title = t.ctrlHide;
    ctrlExpandBtn.title = t.ctrlShow;
    refreshObsSiteUI();
    lastGAz = "";   // 方位テープの方角ラベルを言語に合わせて再描画
    document.getElementById("nowBtn").textContent = t.nowBtn;
    document.querySelector("#title h1 .beta").textContent = t.betaTag;
    menuLangBtn.textContent = t.menuLang;
    menuShareBtn.textContent = t.menuShare;
    refreshSearchLang();
    updateFsLabel();
    updateMenuHeads();
    menuHelpBtn.textContent = t.menuHelp;
    menuTourBtn.textContent = t.menuTour;
    menuCalBtn.textContent = t.menuCal;
    menuAboutBtn.textContent = t.menuAbout;
    updateGridLabel();
    updateConstLabel();
    updateDsoLabel();
    updateTerrainLabel();
    updateMeteorLabel();
    updateBloomLabel();
    updateHiResLabel();
    updateUnitLabel();
    applyNavVisible();
    for (const el of navEl.querySelectorAll("button.body")) {
      const b = BODY_BY_KEY.get(el.dataset.key);
      if (b) el.textContent = bName(b);
    }
    for (const { btn, cat } of CAT_BTNS) btn.textContent = lang === "ja" ? cat.ja : cat.en;
    refreshNavAria();   // 天体リストの絵だけのボタン (軌道・名前・展開)
    setPlaying(playing);
    speedFromSlider();
    positionInfoPanel();
    placeObsSite();   // タイトルの幅が言語で変わる (観測地チップの位置がずれる)
    if (selected) openInfo(selected);
    if (aboutEl.classList.contains("open")) buildAbout();
    if (howtoEl.classList.contains("open")) buildHowto();
    if (welcomeEl.classList.contains("open")) buildWelcome();
    refreshTourUI();
    refreshSkyCal(false);
  }
  menuLangBtn.addEventListener("click", () => {
    lang = lang === "ja" ? "en" : "ja";
    localStorage.setItem("ssLang", lang);
    applyLang();
    setMenu(false);
  });

  // ---------- ヒント (ビューに応じて出し分け・切替時に再表示) ----------
  const hint = document.getElementById("hint");
  let hintTimer = setTimeout(hideHint, 9000);
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.add("fade");
  }
  function hintText() {
    if (arActive) return arRel ? T().hintARRel : T().hintAR;
    return groundView ? T().hintGround : T().hint;
  }
  function updateHint() {
    hint.textContent = hintText();
    hint.classList.remove("fade");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 9000);
  }

