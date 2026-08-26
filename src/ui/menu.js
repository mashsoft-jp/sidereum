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

  // ---------- シーン共有URL ----------
  // 日時・選択天体・カメラ (ズーム/角度/方位)・速度・再生状態を URL に載せる。
  // バックエンド不要。起動時に applyShareURL() で復元する。
  const menuShareBtn = document.getElementById("menuShare");
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
    return location.origin + location.pathname + "?" + p.toString();
  }
  function applyShareURL() {
    const q = new URLSearchParams(location.search);
    if (!q.has("d") && !q.has("sel") && !q.has("z")) return false;
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
    return true;
  }
  let shareResetTimer = 0;
  menuShareBtn.addEventListener("click", () => {
    const url = buildShareURL();
    const done = () => {
      menuShareBtn.textContent = T().menuShareDone;
      clearTimeout(shareResetTimer);
      shareResetTimer = setTimeout(() => { menuShareBtn.textContent = T().menuShare; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, () => { prompt("URL", url); });
    } else {
      prompt("URL", url);
    }
  });

  // ---------- メニューの New / Update タグ ----------
  // 中身が増えた・変わった項目に印を付ける。項目ごとに「今の版」を持ち、
  // 利用者がその項目を開いた時点の版を localStorage に控えて比べる。
  // 中身を直したら、その項目の版を +1 する
  const MENU_VER = { menuHelp: 1, menuCal: 1, menuAbout: 2 };
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
    for (const btn of menuEl.querySelectorAll(':scope > button[role="menuitem"]')) {
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
      dataBody: "軌道間隔・天体の大きさとも実寸比で表示しています。天体位置は J2000 平均軌道要素 (NASA JPL 公表値) にもとづくケプラー軌道の近似計算です。教育・可視化目的であり、天文計算・観測用途の精度はありません。小惑星の軌道上の位相は概略です。恒星 (宇宙ビューの背景・地上ビューとも) は Yale Bright Star Catalogue 第5改訂版 (Hoffleit & Warren 1991, パブリックドメイン) の実位置・実等級 (6.5等まで・約8,400星)、色は B-V 色指数にもとづく近似です。星座線は d3-celestial (Olaf Frohn, BSD-2-Clause) を使用しています。天の川は Deep Star Maps 2020 の拡散光版 (NASA/Goddard Space Flight Center Scientific Visualization Studio。Gaia DR2: ESA/Gaia/DPAC) を天球に貼ったものです。月の向きはカシニの法則 (自転周期 = 公転周期、極は黄道から 1.54° 傾き、交点は軌道と共通) で組んでいるので、光学秤動 — 経度 ±8.0°・緯度 ±6.8° の首振り — は出ます。物理秤動 (数分角) と日周秤動は省略しています。",
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
      dataBody: "Orbital spacing and body sizes are displayed to actual scale. Positions are approximated with Keplerian orbits based on J2000 mean orbital elements published by NASA JPL. This app is for education and visualization; it is not suitable for astronomical or observational use. Orbital phases of the asteroids are approximate. Stars (both the space-view background and the ground view) use real positions and magnitudes (mag ≤ 6.5, ~8,400 stars) from the Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991, public domain); colors are approximated from the B-V index. Constellation lines are from d3-celestial (Olaf Frohn, BSD-2-Clause). The Milky Way is the diffuse-only layer of Deep Star Maps 2020 (NASA/Goddard Space Flight Center Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC), mapped onto the celestial sphere. The Moon's orientation follows Cassini's laws (rotation period = orbital period; pole tilted 1.54° from the ecliptic, sharing the orbit's node), so optical libration — the ±8.0° / ±6.8° nodding of the disc — is reproduced. Physical libration (a few arcminutes) and diurnal libration are omitted.",
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

