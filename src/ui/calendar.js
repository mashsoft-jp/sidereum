  // ---------- 天文カレンダー (モーダル) ----------
  // core/events.js が見つけたできごとを暦年ごとに日時順に並べ、選ぶとその日時・
  // その天体・地上ビューへ飛ばす。ここは表示と飛び先だけを持ち、計算は一切しない。
  // 年は上部の ◀ ▶ と年の選択で切り替える。開いたときは、いま見ている日時の年。
  const menuCalBtn = document.getElementById("menuCal");
  const skyCalEl = document.getElementById("skyCal");
  const CAL_Y_MIN = 1900, CAL_Y_MAX = 2199;   // 日付欄と同じ範囲
  let calYear = null;            // 表示している年 (時計の基準で数えた暦年。null = 未計算)
  let calRows = [];

  // 暦年 y の元日 0:00 (時計の基準) を UTC [ms] で。基準のずれは日時で変わる (夏時間)
  // ので、いったん近い時刻で引いてからもう一度引き直す
  function calYearStart(y) {
    const g = Date.UTC(y, 0, 1);
    return g - clockOffset(g - clockOffset(g));
  }
  const calYearOf = (ms) => clockDate(ms).getUTCFullYear();

  // イベント1件の見出しと補足。天体名・群名は言語に合わせる
  function calText(ev) {
    const c = T().cal;
    const nm = (k) => { const b = BODY_BY_KEY.get(k); return b ? bName(b) : k; };
    switch (ev.kind) {
      case "fullmoon":
        return { h: c.fullmoon,
                 s: ev.data.big ? c.bigMoon(fmtMoonKm(ev.data.km))
                  : ev.data.small ? c.smallMoon(fmtMoonKm(ev.data.km)) : "" };
      case "season":
        return { h: c.season[ev.data.q], s: c.seasonSub[ev.data.q] };
      case "apsis": {
        const km = ev.data.au * AU_KM;
        const v = lang === "ja" ? Math.round(km / 1e4).toLocaleString() : (km / 1e6).toFixed(1);
        return { h: ev.data.far ? c.aphelionE(v) : c.perihelionE(v), s: c.apsisSub };
      }
      case "perihelion":
        return { h: c.perihelion(nm(ev.key), ev.data.au.toFixed(2)), s: c.perihelionSub };
      case "closest":
        return { h: c.closest(nm(ev.key), ev.data.au.toFixed(2)), s: c.closestSub };
      case "station":
        return ev.data.retro
          ? { h: c.retroStart(nm(ev.key)), s: c.retroStartSub }
          : { h: c.retroEnd(nm(ev.key)), s: c.retroEndSub };
      case "moonConj":
        return ev.data.occult
          ? { h: c.occult(nm(ev.key)), s: c.occultSub }
          : { h: c.moonConj(nm(ev.key), ev.data.deg.toFixed(1)), s: "" };
      case "transit":
        return { h: c.transit(nm(ev.key)), s: c.transitSub };
      case "solarEclipse":
        return { h: ev.data.type === "total" ? c.solarTotal
               : ev.data.type === "annular" ? c.solarAnnular : c.solarPartial,
                 s: c.magSuffix(ev.data.mag.toFixed(2)) };
      case "lunarEclipse":
        return { h: ev.data.type === "total" ? c.lunarTotal
               : ev.data.type === "partial" ? c.lunarPartial : c.lunarPenumbral, s: "" };
      case "opposition":
        return { h: c.opposition(nm(ev.key)), s: c.oppositionSub };
      case "elongation":
        return ev.data.east
          ? { h: c.elongEast(nm(ev.key), ev.data.deg.toFixed(0)), s: c.elongEastSub }
          : { h: c.elongWest(nm(ev.key), ev.data.deg.toFixed(0)), s: c.elongWestSub };
      case "conjunction":
        return { h: c.conjunction(nm(ev.key), nm(ev.data.with), ev.data.deg.toFixed(1)), s: "" };
      case "shower": {
        const sh = SHOWERS.find((x) => x.key === ev.key);
        return { h: c.shower(sh ? (lang === "ja" ? sh.ja : sh.en) : ev.key), s: "" };
      }
    }
    return { h: ev.kind, s: "" };
  }

  // 月の距離: 日本語は「35.7万km」、英語は「357,000 km」
  const fmtMoonKm = (km) => lang === "ja" ? (km / 1e4).toFixed(1)
                                          : (Math.round(km / 1000) * 1000).toLocaleString("en-US");
  const CAL_WD_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const CAL_WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const CAL_MON_EN = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];

  function calYearLabel(y) { return lang === "ja" ? y + "\u5e74" : String(y); }

  function buildSkyCal() {
    const t = T(), c = t.cal;
    const now = Date.now();
    const thisYear = calYearOf(now);
    // 年の切替: ◀ ▶ と、押すと一覧が開く <select> (スマホでは OS の選択 UI になる)
    let sel = '<select id="calYearSel" aria-label="' + c.yearSel + '">';
    for (let y = CAL_Y_MIN; y <= CAL_Y_MAX; y++) {
      sel += '<option value="' + y + '"' + (y === calYear ? " selected" : "") + ">" +
             calYearLabel(y) + "</option>";
    }
    sel += "</select>";
    const yearBar = '<div class="calYear">' +
      '<button id="calPrev" aria-label="' + c.prev + '"' + (calYear <= CAL_Y_MIN ? " disabled" : "") + ">\u25c0</button>" +
      sel +
      '<button id="calNext" aria-label="' + c.next + '"' + (calYear >= CAL_Y_MAX ? " disabled" : "") + ">\u25b6</button>" +
      (calYear !== thisYear ? '<button id="calThisYear">' + c.thisYear + "</button>" : "") +
      "</div>";
    const head = '<button id="skyCalClose" aria-label="close">\u2715</button>' +
                 "<h2>" + c.title + "</h2>" + yearBar +
                 "<p>" + c.lead(siteLabel()) + "</p>";
    let body = "";
    if (!calRows.length) {
      body = "<p>" + c.none + "</p>";
    } else {
      let curMonth = -1;
      for (let i = 0; i < calRows.length; i++) {
        // 日付も時計と同じ基準で出す (時計だけ地方時にすると日をまたぐ回で食い違う)
        const ev = calRows[i], ms = J2000 + ev.t * DAY_MS, d = clockDate(ms);
        if (d.getUTCMonth() !== curMonth) {
          curMonth = d.getUTCMonth();
          body += '<h3 class="calMonth">' +
            (lang === "ja" ? (curMonth + 1) + "\u6708" : CAL_MON_EN[curMonth]) + "</h3>";
        }
        const wd = (lang === "ja" ? CAL_WD_JA : CAL_WD_EN)[d.getUTCDay()];
        const tx = calText(ev);
        // 実際の今より前のものは済んだ印に暗くする (「見る」は押せる)
        body += '<div class="calRow' + (ms < now ? " past" : "") + '">' +
          '<div class="calWhen"><span class="calDay">' + d.getUTCDate() + "</span>" +
          '<span class="calWd">' + wd + "</span>" +
          '<span class="calTime">' + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + "</span></div>" +
          '<div class="calWhat"><span class="calTitle">' + tx.h + "</span>" +
          (tx.s ? '<span class="calSub">' + tx.s + "</span>" : "") + "</div>" +
          '<button class="calGo" data-i="' + i + '">' + c.go + "</button>" +
        "</div>";
      }
    }
    skyCalEl.innerHTML = head + body + '<p class="calNote">' + c.note + "</p>";
    skyCalEl.scrollTop = 0;
  }

  // 暦年 y のできごとを集める。年の境は時計の基準で切る (元日 0:00 が UTC の何時かは基準で変わる)
  function calCompute(y) {
    calYear = Math.max(CAL_Y_MIN, Math.min(CAL_Y_MAX, y));
    const ms0 = calYearStart(calYear), ms1 = calYearStart(calYear + 1);
    const t0 = (ms0 - J2000) / DAY_MS;
    calRows = findEvents(t0, (ms1 - ms0) / DAY_MS).filter((ev) => {
      // 走査の端は1日単位なので、年の外へはみ出したぶんを落とす
      if (calYearOf(J2000 + ev.t * DAY_MS) !== calYear) return false;
      // 食・太陽面通過・掩蔽は「この観測地で見えるもの」だけ。地平線の下で起きていても
      // 案内しようがない (月と惑星の接近は、月がゆっくり離れるので沈んでいても翌日に見える)
      if (ev.kind === "solarEclipse" || ev.kind === "lunarEclipse" || ev.kind === "transit") return ev.data.up;
      if (ev.kind === "moonConj" && ev.data.occult) return ev.data.up;
      return true;
    });
    // その年いちばん大きい / 小さい満月に印を付ける (暦年で閉じているのでここで決まる)
    const fulls = calRows.filter((ev) => ev.kind === "fullmoon");
    if (fulls.length >= 2) {
      let big = fulls[0], small = fulls[0];
      for (const ev of fulls) {
        if (ev.data.km < big.data.km) big = ev;
        if (ev.data.km > small.data.km) small = ev;
      }
      big.data.big = true; small.data.small = true;
    }
  }
  function openSkyCal() {
    calCompute(calYearOf(J2000 + simDays * DAY_MS));   // いま見ている日時の年から
    buildSkyCal();
    skyCalEl.classList.add("open");
    modalScrim.classList.add("on");
    calScrollToNext();
  }
  // 済んだものを飛ばして、直近のできごとが年バーのすぐ下に来るところまで送る。
  // その行が月の先頭なら月見出しごと見せる。全部済んでいれば先頭のまま
  function calScrollToNext() {
    let row = skyCalEl.querySelector(".calRow:not(.past)");
    if (!row) return;
    const prev = row.previousElementSibling;
    if (prev && prev.classList.contains("calMonth")) row = prev;
    // 貼り付いた年バーは表示域の上端に来るので、その高さぶん手前で止める
    skyCalEl.scrollTop = row.offsetTop - skyCalEl.querySelector(".calYear").offsetHeight;
  }

  // イベントを選んだときの飛び先。種別ごとに「それが見える画角」を決め打ちする
  const CAL_FOV = {
    solarEclipse: 1.6, lunarEclipse: 3, fullmoon: 4,
    opposition: 20, elongation: 34, conjunction: 8, shower: 62,
    season: 70, apsis: 3, station: 20, moonConj: 3, transit: 1.2,
    perihelion: 30, closest: 45,   // 尾が何十度も伸びるので広めに
  };
  function goToEvent(ev) {
    hideModals();
    setPlaying(false);
    setSimTime(J2000 + evViewTime(ev) * DAY_MS);   // 昼に起きるものは見える時刻へずらす
    updateClock();
    updatePositions();
    updateEclipses();
    // 太陽が主役のもの (日食・二至二分・近日点) は昼の空が要る。風景が切ってあると
    // 昼の空を描かないので入れる。太陽面通過だけは入れない — 画角 1° ではグレアが
    // 画面全体を白く飛ばして、水星の点が見えなくなる
    if (ev.key === "sun") setTerrain(true);
    if (ev.kind === "shower") setMeteor(true);
    enterSurface("earth");
    buildObsFrame();               // 飛んだ先の日時で観測者基底を作り直す
    if (ev.kind === "shower") {
      select(null, false);
      aimGroundAtRadiant(ev.key, true);
    } else {
      // 月と惑星の接近・太陽面通過は、主役 (惑星) より月・太陽を中心に据えたほうが収まる
      const b = BODY_BY_KEY.get(ev.kind === "moonConj" ? "moon" : ev.kind === "transit" ? "sun" : ev.key);
      select(b, false);
      infoPanel.classList.remove("open");
      aimGroundAt(b, true);
    }
    let fov = CAL_FOV[ev.kind];
    if (ev.kind === "moonConj" && ev.data.occult) fov = 1.5;
    gFov = gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, fov * DEG));
    updateGroundUI();
  }

  skyCalEl.addEventListener("click", (e) => {
    if (e.target.id === "skyCalClose") { hideModals(); return; }
    if (e.target.id === "calNext") { calCompute(calYear + 1); buildSkyCal(); return; }
    if (e.target.id === "calPrev") { calCompute(calYear - 1); buildSkyCal(); return; }
    if (e.target.id === "calThisYear") { calCompute(calYearOf(Date.now())); buildSkyCal(); return; }
    const go = e.target.closest(".calGo");
    if (go) goToEvent(calRows[+go.dataset.i]);
  });
  skyCalEl.addEventListener("change", (e) => {
    if (e.target.id === "calYearSel") { calCompute(+e.target.value); buildSkyCal(); }
  });
  menuCalBtn.addEventListener("click", () => { setMenu(false); openSkyCal(); });

  // 言語切替・観測地の変更で開いているものを作り直す (観測地は食の可視判定を変える)
  function refreshSkyCal(recompute) {
    if (!skyCalEl.classList.contains("open")) return;
    if (recompute && calYear !== null) calCompute(calYear);
    buildSkyCal();
  }
