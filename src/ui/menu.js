  // ---------- ハンバーガーメニュー & ライセンス表示 ----------
  const menuBtn = document.getElementById("menuBtn");
  const menuEl = document.getElementById("menu");
  const menuLangBtn = document.getElementById("menuLang");
  const menuUnitBtn = document.getElementById("menuUnit");
  const menuAboutBtn = document.getElementById("menuAbout");
  const aboutEl = document.getElementById("about");

  // 距離単位の切替 (km ⇔ マイル)
  function updateUnitLabel() {
    menuUnitBtn.textContent = distUnit === "km" ? T().menuUnitToMi : T().menuUnitToKm;
  }
  menuUnitBtn.addEventListener("click", () => {
    distUnit = distUnit === "km" ? "mi" : "km";
    localStorage.setItem("ssUnit", distUnit);
    updateUnitLabel();
    setMenu(false);
  });

  // ON/OFF を持つメニュー項目は、ラベルを状態で変えずチェックで表す。
  // 「押すとどうなるか」を出す方式だと、今どちらなのかが読み取れないため
  //(チェックの見た目は styles.css の menuitemcheckbox)
  //
  // この種の項目は押してもメニューを閉じない。切り替えは試して戻すことが多く、
  // 毎回閉じられると開き直しからやり直しになる。チェックがその場で変わるので
  // 効いたことも分かる (ARIA でも menuitemcheckbox は閉じないのが通例)。
  // 別の画面へ移る項目・ビュー切替は今までどおり閉じる
  function setMenuCheck(btn, label, on) {
    btn.textContent = label;
    btn.setAttribute("aria-checked", on ? "true" : "false");
  }

  // 項目のかたまりの見出し (案内 / 表示 / 画質 / 設定・情報)。page.html の group を
  // aria-labelledby で指しているので、ここを空にすると読み上げの見出しも消える
  function updateMenuHeads() {
    const t = T();
    document.getElementById("menuGrpGuide").textContent = t.menuGrpGuide;
    document.getElementById("menuGrpShow").textContent = t.menuGrpShow;
    document.getElementById("menuGrpQuality").textContent = t.menuGrpQuality;
    document.getElementById("menuGrpSet").textContent = t.menuGrpSet;
  }

  // 天球の経緯線 (赤経・赤緯)。星座線とは別の切替で、3ビューとも効く
  const menuGridBtn = document.getElementById("menuGrid");
  function updateGridLabel() {
    setMenuCheck(menuGridBtn, T().menuGrid, showGrid);
  }
  menuGridBtn.addEventListener("click", () => {
    showGrid = !showGrid;
    try { localStorage.setItem("ssGrid", showGrid ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
    updateGridLabel();
  });

  // 星座線と星座名 (黄道も連動)。以前は天体リストの上に置いていたが、あそこは
  // リストに載っている天体の話 (軌道・名前) をする場所で、背景の空の話である
  // 星座だけが浮いていた。経緯線・星雲・星団と並べる
  const menuConstBtn = document.getElementById("menuConst");
  function updateConstLabel() {
    setMenuCheck(menuConstBtn, T().menuConst, showConst);
  }
  menuConstBtn.addEventListener("click", () => {
    showConst = !showConst;
    try { localStorage.setItem("ssConst", showConst ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
    updateConstLabel();
  });

  // 星雲・星団・銀河 (メシエ天体)。恒星と同じく3ビューとも効く
  const menuDsoBtn = document.getElementById("menuDso");
  function updateDsoLabel() {
    setMenuCheck(menuDsoBtn, T().menuDso, dsoOn);
  }
  menuDsoBtn.addEventListener("click", () => {
    dsoOn = !dsoOn;
    try { localStorage.setItem("ssDso", dsoOn ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
    updateDsoLabel();
  });

  // 風景 (地面の質感・地平の稜線・空の色) の表示切替。地上・月面ビューのみ効く
  const menuTerrainBtn = document.getElementById("menuTerrain");
  function updateTerrainLabel() {
    setMenuCheck(menuTerrainBtn, T().menuTerrain, showTerrain);
  }
  function setTerrain(v) {
    showTerrain = v;
    try { localStorage.setItem("ssTerrain", showTerrain ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
    updateTerrainLabel();
  }
  menuTerrainBtn.addEventListener("click", () => setTerrain(!showTerrain));

  // 流星群。地上ビューでその日に降っている群の流星と放射点を出す
  const menuMeteorBtn = document.getElementById("menuMeteor");
  function updateMeteorLabel() {
    setMenuCheck(menuMeteorBtn, T().menuMeteor, showMeteor);
  }
  function setMeteor(v) {
    showMeteor = v;
    try { localStorage.setItem("ssMeteor", showMeteor ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
    updateMeteorLabel();
  }
  menuMeteorBtn.addEventListener("click", () => setMeteor(!showMeteor));

  // 明るいところの滲み (Bloom)。描画負荷が上がるので切れるようにしておく
  const menuBloomBtn = document.getElementById("menuBloom");
  function updateBloomLabel() {
    setMenuCheck(menuBloomBtn, T().menuBloom, bloomOn);
  }
  menuBloomBtn.addEventListener("click", () => {
    bloomOn = !bloomOn;
    try { localStorage.setItem("ssBloom", bloomOn ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
    updateBloomLabel();
  });

  // テクスチャの解像度 (2048×1024 / 4096×2048)。既定は端末によらず標準で、
  // 高解像度は選んだ人にだけ渡す。
  //
  // ON にするときだけ「先に適用してから保存の可否を聞く」。追加の画像を読み込み、
  // 常駐するテクスチャも4倍になるので、非力な端末では表示が重くなったり WebGL の
  // コンテキストが落ちたりしうる。保存前に落ちれば、次に開いたときは既定へ戻る。
  // OFF は安全な向きなので即座に保存する
  const menuHiResBtn = document.getElementById("menuHiRes");
  const hiResConfirmEl = document.getElementById("hiResConfirm");
  const hiResConfirmText = document.getElementById("hiResConfirmText");
  const hiResKeepBtn = document.getElementById("hiResKeep");
  const hiResRevertBtn = document.getElementById("hiResRevert");
  function updateHiResLabel() {
    setMenuCheck(menuHiResBtn, T().menuHiRes, texHiRes);
    hiResConfirmText.textContent = T().hiResConfirm;
    hiResKeepBtn.textContent = T().hiResKeep;
    hiResRevertBtn.textContent = T().hiResRevert;
  }
  function saveHiRes() {
    try { localStorage.setItem("ssHiRes", texHiRes ? "1" : "0"); } catch (e) { /* プライベートモード等 */ }
  }
  function setHiRes(on) {
    texHiRes = on;
    updateHiResLabel();
    reloadTextures();
  }
  menuHiResBtn.addEventListener("click", () => {
    if (texHiRes) {                       // ON → OFF は確認せず保存 (他の切替と同じ)
      hiResConfirmEl.classList.remove("open");
      setHiRes(false);
      saveHiRes();
      return;
    }
    // ON はここだけメニューを閉じる。他の切替と違って「見てから決めてもらう」
    // ので、天体が見えていないと答えようがない
    setMenu(false);
    setHiRes(true);                       // 先に効かせて、見てから決めてもらう
    hiResConfirmEl.classList.add("open");
    liftHiResConfirm();
  });
  // 操作パネルの上へ逃がす。パネルの高さはビュー (宇宙/地上) と折りたたみ状態で
  // 変わるので、出すたびに実測する (ツアーバーの liftTourBar と同じ考え方)
  function liftHiResConfirm() {
    const c = document.getElementById("controls");
    const r = c.getBoundingClientRect();
    const up = r.height > 0 ? Math.max(0, innerHeight - r.top) + 12 : 0;
    hiResConfirmEl.style.bottom = up
      ? "calc(" + (18 + up) + "px + env(safe-area-inset-bottom, 0px))" : "";
  }
  addEventListener("resize", () => {
    if (hiResConfirmEl.classList.contains("open")) liftHiResConfirm();
  });
  hiResKeepBtn.addEventListener("click", () => {
    hiResConfirmEl.classList.remove("open");
    saveHiRes();
  });
  hiResRevertBtn.addEventListener("click", () => {
    hiResConfirmEl.classList.remove("open");
    setHiRes(false);
    saveHiRes();
  });

  // 全画面表示 (Fullscreen API)。iPhone の Safari は非対応のためボタン自体を隠す
  const menuFsBtn = document.getElementById("menuFullscreen");
  const docEl = document.documentElement;
  const fsSupported = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  if (!fsSupported) menuFsBtn.style.display = "none";
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function updateFsLabel() {
    menuFsBtn.textContent = isFs() ? T().menuFsExit : T().menuFs;
  }
  menuFsBtn.addEventListener("click", () => {
    if (isFs()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
      if (p && p.catch) p.catch(() => {});   // ジェスチャ判定などで拒否されても静かに無視
    }
    setMenu(false);
  });
  document.addEventListener("fullscreenchange", updateFsLabel);
  document.addEventListener("webkitfullscreenchange", updateFsLabel);

  // 配信中ビルドの識別 (Last-Modified ヘッダ由来)。キャッシュで旧ビルドを
  // 見ていないかを実機で確認できるようにする
  (() => {
    const d = new Date(document.lastModified);
    if (isNaN(d)) return;
    const p2 = n => String(n).padStart(2, "0");
    document.getElementById("menuBuild").textContent =
      `build ${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  })();

  // 天体リストの表示/非表示 (« で左へ引っ込み、左端の » で出てくる。モバイルは初期非表示)
  let navVisible = !window.matchMedia("(max-width: 720px)").matches;
  const navCollapseBtn = document.getElementById("navCollapse");
  const navExpandBtn = document.getElementById("navExpand");
  function applyNavVisible() {
    document.getElementById("app").classList.toggle("navHidden", !navVisible);
    navCollapseBtn.title = T().menuNavHide;
    navExpandBtn.title = T().menuNavShow;
  }
  navCollapseBtn.addEventListener("click", () => { navVisible = false; applyNavVisible(); });
  navExpandBtn.addEventListener("click", () => { navVisible = true; applyNavVisible(); });

  // ---------- 共有 (画像とリンク) ----------
  // メニューの「共有…」は、いま見えている画を写してプレビューを出し、そこで
  // 画像を保存 / 共有 (OS の共有シート) / リンクをコピー を選んでもらう。
  // 以前は「共有リンクをコピー」と「画像を保存」の2項目だったが、1つにまとめた。
  // WebGL の描画バッファは次のフレームで消える (preserveDrawingBuffer: false) ので、
  // 押した瞬間ではなく次のフレームの描き終わりに写す (runtime/frame.js が呼ぶ)。
  // HUD は写さないので、いつ・どこの空かと、ロゴ・著作権表示を隅に書き込む。
  // SNS ごとのボタンは置かない (2026-09-04): X の intent には画像を渡せず、Instagram は
  // Web から投稿する入口が無く、Bluesky は利用者数が見合わない。共有シートなら画像ごと
  // どのアプリにも渡せる。共有シートが無い環境 (一部の PC) は 保存 と リンクだけ
  const menuShareBtn = document.getElementById("menuShare");
  const snapDlgEl = document.getElementById("snapDlg");
  let snapPending = false;
  let snapBlob = null, snapURL = null, snapName = "";
  menuShareBtn.addEventListener("click", () => { setMenu(false); snapPending = true; });
  function snapWhen() {
    return dateInput.value.replace(/-/g, "/") + " " + timeInput.value + " " + tzText.textContent;
  }
  function snapSite() {
    return groundView && surfaceBody === "earth" ? siteLabel() : "";
  }
  function snapshotIfPending() {
    if (!snapPending) return;
    snapPending = false;
    const c = document.createElement("canvas");
    c.width = glc.width; c.height = glc.height;
    const x = c.getContext("2d");
    x.drawImage(glc, 0, 0);
    x.drawImage(ovl, 0, 0);
    const fs = Math.round(12 * DPR), pad = Math.round(14 * DPR), lh = Math.round(16 * DPR);
    x.textBaseline = "bottom";
    x.shadowColor = "rgba(0,0,0,0.85)"; x.shadowBlur = 4 * DPR;
    x.font = fs + "px system-ui, -apple-system, sans-serif";
    x.fillStyle = "rgba(201,213,234,0.92)";
    const site = snapSite();
    x.fillText(snapWhen() + (site ? "   " + site : ""), pad, c.height - pad);
    // 右下: ロゴと著作権表示 (About と同じ表記)
    x.textAlign = "right";
    x.font = "300 " + fs + "px Jura, system-ui, sans-serif";
    x.fillStyle = "rgba(242,178,62,0.9)";
    x.fillText("S I D E R E U M", c.width - pad, c.height - pad - lh);
    x.font = Math.round(10 * DPR) + "px system-ui, -apple-system, sans-serif";
    x.fillStyle = "rgba(201,213,234,0.8)";
    x.fillText("\u00a9 2026 Mashsoft Inc.", c.width - pad, c.height - pad);
    snapName = "sidereum-" + dateInput.value.replace(/-/g, "") + "-" + timeInput.value.replace(":", "") + ".png";
    c.toBlob((blob) => {
      if (!blob) return;
      hideModals();   // 他のモーダルと、前回のプレビュー (closeSnapDlg) を先に片付ける
      snapBlob = blob;
      snapURL = URL.createObjectURL(blob);
      buildSnapDlg();
      snapDlgEl.classList.add("open");
      modalScrim.classList.add("on");
    }, "image/png");
  }
  // SNS へ渡す文とリンク。リンクは今の場面の共有URL (開けば同じ空になる)
  function snapShareText() {
    const t = T().snap;
    return t.text(snapWhen(), snapSite()) + " " + t.tag;
  }
  function buildSnapDlg() {
    const t = T().snap;
    const canShare = !!(navigator.canShare && snapBlob &&
      navigator.canShare({ files: [new File([snapBlob], snapName, { type: "image/png" })] }));
    snapDlgEl.innerHTML =
      '<button id="snapDlgClose" aria-label="close">\u2715</button>' +
      "<h2>" + t.title + "</h2>" +
      '<img id="snapImg" alt="">' +
      '<div class="snapBtns">' +
        '<button id="snapSave" class="primary">' + t.save + "</button>" +
        (canShare ? '<button id="snapShare">' + t.share + "</button>" : "") +
        '<button id="snapLink">' + t.link + "</button>" +
      "</div>";
    document.getElementById("snapImg").src = snapURL;
  }
  function closeSnapDlg() {
    if (!snapDlgEl.classList.contains("open") && !snapURL) return;
    snapDlgEl.classList.remove("open");
    if (snapURL) { URL.revokeObjectURL(snapURL); snapURL = null; }
    snapBlob = null;
    snapDlgEl.innerHTML = "";
  }
  snapDlgEl.addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "snapDlgClose") { hideModals(); return; }
    if (id === "snapSave") {
      const a = document.createElement("a");
      a.href = snapURL; a.download = snapName;
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (id === "snapLink") {
      const url = buildShareURL(), btn = e.target;
      const done = () => {
        btn.textContent = T().snap.linkDone;
        clearTimeout(shareResetTimer);
        shareResetTimer = setTimeout(() => { btn.textContent = T().snap.link; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, () => { prompt("URL", url); });
      } else {
        prompt("URL", url);
      }
      return;
    }
    if (id === "snapShare") {
      const file = new File([snapBlob], snapName, { type: "image/png" });
      navigator.share({ files: [file], text: snapShareText(), url: buildShareURL() }).catch(() => {});   // 取り消しは無視
      return;
    }
  });

  // ---------- シーン共有URL ----------
  // 日時・選択天体・カメラ (ズーム/角度/方位)・速度・再生状態を URL に載せる。
  // バックエンド不要。起動時に applyShareURL() で復元する。
  function buildShareURL() {
    const p = new URLSearchParams();
    p.set("d", new Date(J2000 + simDays * DAY_MS).toISOString().slice(0, 16));  // UTC 分精度
    if (selected) p.set("sel", selected.key);
    p.set("z", cam.distTgt.toPrecision(6));   // world単位は桁が小さいので有効桁で保持
    if (camZoomTgt > 1.001) p.set("mag", camZoomTgt.toPrecision(4));
    p.set("a", cam.pitchTgt.toFixed(4));
    p.set("y", cam.yawTgt.toFixed(4));
    p.set("spd", daysPerSec.toPrecision(6));
    p.set("play", playing ? "1" : "0");
    // ビューと、地上・月面のカメラ。これが無いと共有も再読み込みも必ず宇宙
    // ビューに戻り、「この空を見て」という共有が成り立たない。
    // 観測地も載せる — 日時と同じで「どこから見た空か」はシーンの一部
    // (地球は緯度経度、月面はプリセットの番号)
    if (groundView) {
      p.set("view", surfaceBody === "moon" ? "moon" : "ground");
      p.set("gaz", (((gAzTgt / DEG) % 360 + 360) % 360).toFixed(2));
      p.set("galt", (gAltTgt / DEG).toFixed(2));
      p.set("gfov", (gFovTgt / DEG).toFixed(2));
      if (surfaceBody === "moon") p.set("msite", moonSiteEl.value);
      else { p.set("lat", obsLat.toFixed(3)); p.set("lon", obsLon.toFixed(3)); }
    }
    return location.origin + location.pathname + "?" + p.toString();
  }
  function applyShareURL() {
    const q = new URLSearchParams(location.search);
    if (!q.has("d") && !q.has("sel") && !q.has("z") && !q.has("view")) return false;
    const d = q.get("d");
    if (d) {
      let iso = d;
      if (iso.length === 10) iso += "T00:00:00";
      else if (iso.length === 16) iso += ":00";
      if (!/[zZ]$/.test(iso)) iso += "Z";
      const t = Date.parse(iso);
      if (isFinite(t)) simDays = (t - J2000) / DAY_MS;
    }
    const spd = parseFloat(q.get("spd"));
    if (isFinite(spd) && spd > 0) {
      daysPerSec = spd;
      speedInput.value = Math.max(0, Math.min(100, Math.round(18 * Math.log(spd * 86400) / Math.log(60))));
      speedVal.textContent = fmtRate(daysPerSec);
    }
    if (q.get("play") === "0") setPlaying(false);
    else if (q.get("play") === "1") setPlaying(true);
    const selKey = q.get("sel");
    const selBody = selKey ? BODY_BY_KEY.get(selKey) : null;
    if (selBody) {
      select(selBody, false);           // fly させず、カメラは URL の値で直接復元
      updatePositions();
      const w = posW.get(selBody.key);
      cam.focusTgt[0] = w[0]; cam.focusTgt[1] = w[1]; cam.focusTgt[2] = w[2];
      cam.focus[0] = w[0]; cam.focus[1] = w[1]; cam.focus[2] = w[2];
    }
    const z = parseFloat(q.get("z")), a = parseFloat(q.get("a")), y = parseFloat(q.get("y"));
    if (isFinite(z)) { cam.distTgt = Math.min(1400, z); cam.dist = cam.distTgt; }
    const mg = parseFloat(q.get("mag"));
    if (isFinite(mg) && mg >= 1) { camZoomTgt = Math.min(MAG_MAX, mg); camZoom = camZoomTgt; }
    if (isFinite(a)) { cam.pitchTgt = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, a)); cam.pitch = cam.pitchTgt; }
    if (isFinite(y)) { cam.yawTgt = y; cam.yaw = y; }

    // 地上・月面ビューの復元。観測地は enterSurface が buildObsFrame で
    // 基底を固めるより先に入れる。
    // ★ localStorage へは書かない。受け取った人の「自分の観測地」を共有
    //   リンクで書き換えないため — このセッションだけ差し替える
    const view = q.get("view");
    if (view === "ground" || view === "moon") {
      if (view === "moon") {
        const mi = parseInt(q.get("msite"), 10);
        if (mi >= 0 && mi < MOON_SITES.length) {
          moonLat = MOON_SITES[mi].lat;
          moonLon = MOON_SITES[mi].lon;
          moonSiteEl.value = String(mi);
        }
      } else {
        const la = parseFloat(q.get("lat")), lo = parseFloat(q.get("lon"));
        if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
          obsLat = la;
          obsLon = lo;
          geoZone = null;   // 受け取った人が現在地から取った時間帯を引きずらせない
        }
      }
      enterSurface(view === "moon" ? "moon" : "earth");
      // enterSurface は選択天体の方へ向けて gTrack を立てるので、URL の向きで
      // 上書きしてから追尾を切る (切らないと次のフレームで向き直してしまう)
      const gz = parseFloat(q.get("gaz")), gl = parseFloat(q.get("galt")), gf = parseFloat(q.get("gfov"));
      if (isFinite(gz)) { gAz = gAzTgt = gz * DEG; gTrack = false; gRadTrack = ""; }
      if (isFinite(gl)) { gAlt = gAltTgt = Math.max(-1.3, Math.min(GALT_MAX, gl * DEG)); }
      if (isFinite(gf)) { gFov = gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, gf * DEG)); }
    }
    return true;
  }
  let shareResetTimer = 0;   // 「リンクをコピー」の表示戻し

  // ---------- メニューの New / Update タグ ----------
  // 中身が増えた・変わった項目に印を付ける。項目ごとに「今の版」を持ち、
  // 利用者がその項目を開いた時点の版を localStorage に控えて比べる。
  // 中身を直したら、その項目の版を +1 する
  const MENU_VER = { menuHelp: 1, menuCal: 2, menuShare: 1, menuAbout: 2 };
  const MENU_SEEN_KEY = "ssMenuSeen";
  function loadMenuSeen() {
    try { return JSON.parse(localStorage.getItem(MENU_SEEN_KEY)) || {}; }
    catch (e) { return {}; }
  }
  // 初回起動時に現在の版を全部書き込んでおく。こうすると「初めての人には
  // 何も New が付かず、その後に増えた・上がった項目だけに印が出る」
  if (!localStorage.getItem(MENU_SEEN_KEY)) {
    try { localStorage.setItem(MENU_SEEN_KEY, JSON.stringify(MENU_VER)); }
    catch (e) { /* プライベートモード等 */ }
  }
  // 0 = 印なし  1 = New (この項目自体が新しい)  2 = Update (中身が変わった)
  function menuBadgeState(id) {
    if (id === "menuTour") return tourBadgeState();   // ツアーは個々の視聴記録から
    const cur = MENU_VER[id];
    if (!cur) return 0;
    const seen = loadMenuSeen()[id];
    if (seen === undefined) return 1;                 // 初回記録より後に増えた項目
    return seen >= cur ? 0 : 2;
  }
  function markMenuSeen(id) {
    const cur = MENU_VER[id];
    if (!cur) return;
    const m = loadMenuSeen();
    if (m[id] === cur) return;
    m[id] = cur;
    try { localStorage.setItem(MENU_SEEN_KEY, JSON.stringify(m)); }
    catch (e) { /* プライベートモード等 */ }
  }
  // applyLang が textContent でラベルを書き換えるとタグも消えるので、
  // メニューを開くたびに付け直す
  function refreshMenuBadges() {
    for (const btn of menuEl.querySelectorAll('button[role="menuitem"]')) {
      const st = menuBadgeState(btn.id);
      let tag = btn.querySelector(".menuTag");
      if (!st) { if (tag) tag.remove(); continue; }
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "menuTag";
        btn.appendChild(tag);
      }
      tag.textContent = st === 1 ? T().tagNew : T().tourUpdated;
    }
  }
  menuEl.addEventListener("click", (e) => {
    const b = e.target.closest('button[role="menuitem"]');
    if (b) markMenuSeen(b.id);
  });

  function setMenu(open) {
    if (open) refreshMenuBadges();
    menuEl.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(!menuEl.classList.contains("open"));
  });
  // メニュー外クリックで閉じる
  document.addEventListener("pointerdown", (e) => {
    if (!menuEl.contains(e.target) && e.target !== menuBtn) setMenu(false);
  });

  const CREDIT_ORDER = ["mercury", "venus", "earth", "moon", "mars", "jupiter",
    "io", "europa", "ganymede", "callisto", "pluto", "ceres", "vesta"];
  function buildAbout() {
    const rows = CREDIT_ORDER
      .map((k) => `<tr><td>${bName(BODY_BY_KEY.get(k))}</td><td>${IMG_CREDIT[k]}</td></tr>`)
      .join("");
    const c = lang === "ja" ? {
      lic: "ライセンス",
      licBody: '© 2026 <a href="https://www.mashsoft.co.jp" target="_blank" rel="noopener">Mashsoft Inc.</a> — コードは MIT License で公開されています。' +
        'ロゴの書体は <a href="https://github.com/ossobuffo/jura" target="_blank" rel="noopener">Jura</a> Light ' +
        '(© 2019 The Jura Project Authors, <a href="https://scripts.sil.org/OFL" target="_blank" rel="noopener">SIL Open Font License 1.1</a>) ' +
        'から SIDEREUM の7文字だけを切り出して埋め込んでいます。',
      img: "画像クレジット",
      imgBody: "以下の天体の表面には、NASA / USGS のパブリックドメイン画像を使用しています。",
      proc: "太陽・土星 (環を含む)・天王星・海王星・パラス・ジュノーは、シェーダによる生成テクスチャです (実写ではありません)。",
      data: "データと精度",
      dataBody: "軌道間隔・天体の大きさとも実寸比で表示しています。天体位置は J2000 平均軌道要素 (NASA JPL 公表値) にもとづくケプラー軌道の近似計算です。教育・可視化目的であり、天文計算・観測用途の精度はありません。小惑星の軌道上の位相は概略です。恒星 (宇宙ビューの背景・地上ビューとも) は Yale Bright Star Catalogue 第5改訂版 (Hoffleit & Warren 1991, パブリックドメイン) の実位置・実等級 (6.5等まで・約8,400星)、色は B-V 色指数にもとづく近似です。星座線は d3-celestial (Olaf Frohn, BSD-2-Clause) を使用しています。星雲・星団・銀河 (メシエ天体109個と二重星団) は OpenNGC (Mattia Verga, CC-BY-SA-4.0) の位置・等級・視直径によるもので、面輝度として描いています。天の川は Deep Star Maps 2020 の拡散光版 (NASA/Goddard Space Flight Center Scientific Visualization Studio。Gaia DR2: ESA/Gaia/DPAC) を天球に貼ったものです。月の向きはカシニの法則 (自転周期 = 公転周期、極は黄道から 1.54° 傾き、交点は軌道と共通) で組んでいるので、光学秤動 — 経度 ±8.0°・緯度 ±6.8° の首振り — は出ます。物理秤動 (数分角) と日周秤動は省略しています。",
      disc: "本アプリは NASA・USGS とは無関係であり、両機関による承認・推奨を意味するものではありません。",
    } : {
      lic: "License",
      licBody: '© 2026 <a href="https://www.mashsoft.co.jp" target="_blank" rel="noopener">Mashsoft Inc.</a> — The code is released under the MIT License. ' +
        'The wordmark embeds the seven letters of SIDEREUM subset from ' +
        '<a href="https://github.com/ossobuffo/jura" target="_blank" rel="noopener">Jura</a> Light ' +
        '(© 2019 The Jura Project Authors, <a href="https://scripts.sil.org/OFL" target="_blank" rel="noopener">SIL Open Font License 1.1</a>).',
      img: "Image credits",
      imgBody: "The surfaces of the following bodies use public-domain imagery from NASA / USGS.",
      proc: "The Sun, Saturn (incl. rings), Uranus, Neptune, Pallas and Juno use procedurally generated textures (not actual imagery).",
      data: "Data & accuracy",
      dataBody: "Orbital spacing and body sizes are displayed to actual scale. Positions are approximated with Keplerian orbits based on J2000 mean orbital elements published by NASA JPL. This app is for education and visualization; it is not suitable for astronomical or observational use. Orbital phases of the asteroids are approximate. Stars (both the space-view background and the ground view) use real positions and magnitudes (mag ≤ 6.5, ~8,400 stars) from the Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991, public domain); colors are approximated from the B-V index. Constellation lines are from d3-celestial (Olaf Frohn, BSD-2-Clause). Deep-sky objects (109 Messier objects and the Double Cluster) use positions, magnitudes and apparent sizes from OpenNGC (Mattia Verga, CC-BY-SA-4.0), rendered as surface brightness. The Milky Way is the diffuse-only layer of Deep Star Maps 2020 (NASA/Goddard Space Flight Center Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC), mapped onto the celestial sphere. The Moon's orientation follows Cassini's laws (rotation period = orbital period; pole tilted 1.54° from the ecliptic, sharing the orbit's node), so optical libration — the ±8.0° / ±6.8° nodding of the disc — is reproduced. Physical libration (a few arcminutes) and diurnal libration are omitted.",
      disc: "This app is not affiliated with, nor endorsed by, NASA or USGS.",
    };
    aboutEl.innerHTML =
      `<button id="aboutClose" aria-label="close">✕</button>` +
      `<h2 class="logo">SIDEREUM<span class="yomi">${lang === "ja" ? "(シデレウム β版)" : "(Beta)"}</span></h2>` +
      `<h3>${c.lic}</h3><p>${c.licBody}</p>` +
      `<h3>${c.img}</h3><p>${c.imgBody}</p>` +
      `<table><tbody>${rows}</tbody></table>` +
      `<p>${c.proc}</p>` +
      `<h3>${c.data}</h3><p>${c.dataBody}</p><p>${c.disc}</p>`;
  }
  menuAboutBtn.addEventListener("click", () => {
    setMenu(false);
    buildAbout();
    aboutEl.classList.add("open");
    modalScrim.classList.add("on");
  });
  aboutEl.addEventListener("click", (e) => {
    if (e.target.id === "aboutClose") hideModals();
  });

