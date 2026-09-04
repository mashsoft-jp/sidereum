  // ---------- 天体名検索 ----------
  // 天体・衛星・探査機・星雲星団・星座・流星群を名前で探して飛ぶ。日本語名と英語名の
  // どちらでも引ける (表示は今の言語)。タイトル横の 🔍 か "/" キーで開く。
  // 天体は select() に任せる (宇宙ビューでは寄り、地上ビューではそちらを向く)。
  // 空に貼り付いたもの (星雲星団・星座・流星群) は地上ビューでその方向を向く
  const searchBtn = document.getElementById("searchBtn");
  const searchBox = document.getElementById("searchBox");
  const searchInput = document.getElementById("searchInput");
  const searchList = document.getElementById("searchList");
  const SEARCH_KIND = { body: "sBody", sat: "sSat", probe: "sProbe", dso: "sDso", const: "sConst", shower: "sShower" };
  // 照合用に正規化: 全角→半角、小文字、ひらがな→カタカナ、空白と区切り (・ - ' .) を落とす
  const sKey = (v) => String(v).normalize("NFKC").toLowerCase()
    .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/[\s・･\-–—'’.]/g, "");
  let searchIndex = null, sRes = [], sSel = 0;

  function buildSearchIndex() {
    const ix = [];
    for (const b of ALL_BODIES) {
      ix.push({ kind: b.parent ? "sat" : "body", keys: [b.name, b.nameEn, b.en],
                label: () => bName(b), go: () => goSearchBody(b) });
    }
    for (const pr of PROBES) {
      ix.push({ kind: "probe", keys: [pr.name, pr.nameEn, pr.en], label: () => bName(pr), go: () => goSearchBody(pr) });
    }
    for (const d of DSO) {
      const m = d[0] ? "M" + d[0] : "";
      ix.push({ kind: "dso", keys: [m, m && "M " + d[0], m && "メシエ" + d[0], d[8], d[9]],
                label: () => (m ? m + " " : "") + (lang === "ja" ? (d[8] || d[9]) : (d[9] || d[8])),
                go: () => aimSkyRaDec(d[1], d[2], 12, "dso") });
    }
    for (const c of CONST_LABELS) {
      ix.push({ kind: "const", keys: [c.ja, c.en, c.ab], label: () => (lang === "ja" ? c.ja : c.en),
                go: () => aimSkyDir([c.wx, c.wy, c.wz], 65, "const") });
    }
    for (const sh of SHOWERS) {
      if (sh.key === "sporadic") continue;
      ix.push({ kind: "shower", keys: [sh.ja, sh.en], label: () => (lang === "ja" ? sh.ja : sh.en),
                go: () => goSearchShower(sh.key) });
    }
    for (const e of ix) e.nk = e.keys.filter(Boolean).map(sKey);
    return ix;
  }
  // 部分一致。先頭に近く一致したものを先に (同点は索引の順 = 天体 → 星雲 → 星座 → 流星群)
  function searchQuery(q) {
    const k = sKey(q);
    if (!k) return [];
    const hits = [];
    for (const e of searchIndex) {
      let best = -1;
      for (const nk of e.nk) {
        const i = nk.indexOf(k);
        if (i >= 0 && (best < 0 || i < best)) best = i;
      }
      if (best >= 0) hits.push({ e, best });
    }
    hits.sort((a, b) => a.best - b.best);
    return hits.slice(0, 8).map((h) => h.e);
  }
  function renderSearch() {
    const t = T();
    searchList.innerHTML = "";
    searchInput.removeAttribute("aria-activedescendant");
    if (!sRes.length) {
      if (searchInput.value.trim()) {
        const li = document.createElement("li");
        li.className = "sNone";
        li.textContent = t.searchNone;
        searchList.appendChild(li);
      }
      searchInput.setAttribute("aria-expanded", "false");
      return;
    }
    sRes.forEach((e, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.id = "sOpt" + i;
      if (i === sSel) { li.className = "on"; li.setAttribute("aria-selected", "true"); }
      const nm = document.createElement("span"), kd = document.createElement("span");
      nm.textContent = e.label();
      kd.className = "sKind"; kd.textContent = t[SEARCH_KIND[e.kind]];
      li.appendChild(nm); li.appendChild(kd);
      // pointerdown で決める (click だと先に入力欄の blur が走って一覧が畳まれる)
      li.addEventListener("pointerdown", (ev) => { ev.preventDefault(); goSearch(e); });
      searchList.appendChild(li);
    });
    searchInput.setAttribute("aria-expanded", "true");
    searchInput.setAttribute("aria-activedescendant", "sOpt" + sSel);
  }
  function openSearch() {
    if (!searchIndex) searchIndex = buildSearchIndex();
    setMenu(false);
    hideModals();
    searchBox.hidden = false;
    searchInput.value = "";
    sRes = []; sSel = 0;
    renderSearch();
    searchInput.focus();
  }
  function closeSearch() {
    if (searchBox.hidden) return;
    searchBox.hidden = true;
    searchInput.blur();
  }
  function goSearch(e) {
    closeSearch();
    e.go();
    hideHint();
  }

  // ---- 飛び先 ----
  function goSearchBody(b) {
    if (groundView && b.key === surfaceBody) exitGround();   // 立っている天体は宇宙から見る
    select(b, true);
  }
  // 赤経赤緯 (J2000, 度) → ワールドの単位方向 (showers.js の dirW と同じ変換)
  const _sd = [0, 0, 0];
  function aimSkyRaDec(raDeg, decDeg, fovDeg, what) {
    const eps = 23.4393 * DEG, ce = Math.cos(eps), se = Math.sin(eps);
    const ra = raDeg * DEG, dec = decDeg * DEG, cd = Math.cos(dec);
    const xq = cd * Math.cos(ra), yq = cd * Math.sin(ra), zq = Math.sin(dec);
    _sd[0] = xq; _sd[1] = -yq * se + zq * ce; _sd[2] = -(yq * ce + zq * se);
    aimSkyDir(_sd, fovDeg, what);
  }
  // ワールドの方向 (天球上の点) へ地上ビューを向ける。層が消えていれば入れる
  const _sg = [0, 0, 0];
  function aimSkyDir(d, fovDeg, what) {
    if (!groundView) enterSurface("earth");
    buildObsFrame();
    if (what === "dso" && !dsoOn) menuDsoBtn.click();
    if (what === "const" && !showConst) menuConstBtn.click();
    select(null, false);
    gTrack = false; gRadTrack = "";
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    worldDirToGround([d[0] / l, d[1] / l, d[2] / l], _sg);
    const rf = refractUp(_sg[1]);
    _sg[0] *= rf[0]; _sg[2] *= rf[0]; _sg[1] = rf[1];
    const az = Math.atan2(_sg[0], -_sg[2]), alt = Math.asin(Math.max(-1, Math.min(1, _sg[1])));
    let dz = (az - gAz) % (2 * Math.PI);
    if (dz > Math.PI) dz -= 2 * Math.PI;
    if (dz < -Math.PI) dz += 2 * Math.PI;
    gAzTgt = gAz + dz;
    gAltTgt = Math.max(-1.3, Math.min(GALT_MAX, alt));
    gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, fovDeg * DEG));
    updateGroundUI();
  }
  function goSearchShower(key) {
    if (!groundView) enterSurface("earth");
    buildObsFrame();
    setMeteor(true);
    select(null, false);
    aimGroundAtRadiant(key, false);
    gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, 62 * DEG));
    updateGroundUI();
  }

  // ---- 操作 ----
  searchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (searchBox.hidden) openSearch(); else closeSearch();
  });
  searchInput.addEventListener("input", () => {
    sRes = searchQuery(searchInput.value);
    sSel = 0;
    renderSearch();
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (sRes.length) {
        sSel = (sSel + (e.key === "ArrowDown" ? 1 : sRes.length - 1)) % sRes.length;
        renderSearch();
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (sRes[sSel]) goSearch(sRes[sSel]);
      e.preventDefault();
    } else if (e.key === "Escape") {
      closeSearch();
      e.stopPropagation();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!searchBox.hidden && !searchBox.contains(e.target) && !searchBtn.contains(e.target)) closeSearch();
  });
  // "/" で開く (入力欄にフォーカスが無いときだけ)
  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && e.target === document.body && !tourActive && !introOn) {
      e.preventDefault();
      openSearch();
    }
  });
  // 言語切替 (applyLang から)
  function refreshSearchLang() {
    const t = T();
    searchBtn.setAttribute("aria-label", t.search);
    searchBtn.title = t.search;
    searchInput.setAttribute("aria-label", t.search);
    searchInput.placeholder = t.searchPh;
    if (!searchBox.hidden) renderSearch();
  }
