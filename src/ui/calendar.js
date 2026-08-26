  // ---------- 天文カレンダー (モーダル) ----------
  // core/events.js が見つけたできごとを日時順に並べ、選ぶとその日時・その天体・
  // 地上ビューへ飛ばす。ここは表示と飛び先だけを持ち、計算は一切しない。
  const menuCalBtn = document.getElementById("menuCal");
  const skyCalEl = document.getElementById("skyCal");
  const CAL_SPAN = 366;          // 1画面ぶんの期間 [日]
  let calT0 = null;              // 表示している期間の先頭 (null = 未計算)
  let calRows = [];

  // イベント1件の見出しと補足。天体名・群名は言語に合わせる
  function calText(ev) {
    const c = T().cal;
    const nm = (k) => { const b = BODY_BY_KEY.get(k); return b ? bName(b) : k; };
    switch (ev.kind) {
      case "fullmoon":
        return { h: c.fullmoon, s: "" };
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

  const CAL_WD_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const CAL_WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const CAL_MON_EN = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];

  function buildSkyCal() {
    const t = T(), c = t.cal;
    const head = '<button id="skyCalClose" aria-label="close">✕</button>' +
                 "<h2>" + c.title + "</h2>" +
                 "<p>" + c.lead(siteLabel()) + "</p>";
    let body = "";
    if (!calRows.length) {
      body = "<p>" + c.none + "</p>";
    } else {
      let curMonth = "";
      for (let i = 0; i < calRows.length; i++) {
        // 日付も時計と同じ基準で出す (時計だけ地方時にすると日をまたぐ回で食い違う)
        const ev = calRows[i], d = clockDate(J2000 + ev.t * DAY_MS);
        const mk = d.getUTCFullYear() + "/" + (d.getUTCMonth() + 1);
        if (mk !== curMonth) {
          curMonth = mk;
          body += '<h3 class="calMonth">' +
            (lang === "ja" ? d.getUTCFullYear() + "年 " + (d.getUTCMonth() + 1) + "月"
                           : CAL_MON_EN[d.getUTCMonth()] + " " + d.getUTCFullYear()) + "</h3>";
        }
        const wd = (lang === "ja" ? CAL_WD_JA : CAL_WD_EN)[d.getUTCDay()];
        const tx = calText(ev);
        body += '<div class="calRow">' +
          '<div class="calWhen"><span class="calDay">' + d.getUTCDate() + "</span>" +
          '<span class="calWd">' + wd + "</span>" +
          '<span class="calTime">' + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + "</span></div>" +
          '<div class="calWhat"><span class="calTitle">' + tx.h + "</span>" +
          (tx.s ? '<span class="calSub">' + tx.s + "</span>" : "") + "</div>" +
          '<button class="calGo" data-i="' + i + '">' + c.go + "</button>" +
        "</div>";
      }
    }
    const nav = '<div class="calNav">' +
      '<button id="calPrev">' + c.prev + "</button>" +
      '<button id="calNext">' + c.next + "</button></div>";
    skyCalEl.innerHTML = head + body + nav + '<p class="calNote">' + c.note + "</p>";
    skyCalEl.scrollTop = 0;
  }

  function calCompute(t0) {
    calT0 = t0;
    calRows = findEvents(t0, CAL_SPAN).filter((ev) => {
      // 食は「この観測地で見えるもの」だけ。地平線の下で起きていても案内しようがない
      if (ev.kind === "solarEclipse" || ev.kind === "lunarEclipse") return ev.data.up;
      return true;
    });
  }
  function openSkyCal() {
    calCompute(simDays);
    buildSkyCal();
    skyCalEl.classList.add("open");
    modalScrim.classList.add("on");
  }

  // イベントを選んだときの飛び先。種別ごとに「それが見える画角」を決め打ちする
  const CAL_FOV = {
    solarEclipse: 1.6, lunarEclipse: 3, fullmoon: 4,
    opposition: 20, elongation: 34, conjunction: 8, shower: 62,
  };
  function goToEvent(ev) {
    hideModals();
    setPlaying(false);
    setSimTime(J2000 + evViewTime(ev) * DAY_MS);   // 昼に起きるものは見える時刻へずらす
    updateClock();
    updatePositions();
    updateEclipses();
    // 日食は空が暗くなるところが見せ場なので、風景が切ってあれば入れる
    if (ev.kind === "solarEclipse") setTerrain(true);
    if (ev.kind === "shower") setMeteor(true);
    enterSurface("earth");
    buildObsFrame();               // 飛んだ先の日時で観測者基底を作り直す
    if (ev.kind === "shower") {
      select(null, false);
      aimGroundAtRadiant(ev.key, true);
    } else {
      const b = BODY_BY_KEY.get(ev.key);
      select(b, false);
      infoPanel.classList.remove("open");
      aimGroundAt(b, true);
    }
    gFov = gFovTgt = Math.max(gMinFov(), Math.min(MAX_FOV, CAL_FOV[ev.kind] * DEG));
    updateGroundUI();
  }

  skyCalEl.addEventListener("click", (e) => {
    if (e.target.id === "skyCalClose") { hideModals(); return; }
    if (e.target.id === "calNext") { calCompute(calT0 + CAL_SPAN); buildSkyCal(); return; }
    if (e.target.id === "calPrev") { calCompute(calT0 - CAL_SPAN); buildSkyCal(); return; }
    const go = e.target.closest(".calGo");
    if (go) goToEvent(calRows[+go.dataset.i]);
  });
  menuCalBtn.addEventListener("click", () => { setMenu(false); openSkyCal(); });

  // 言語切替・観測地の変更で開いているものを作り直す (観測地は食の可視判定を変える)
  function refreshSkyCal(recompute) {
    if (!skyCalEl.classList.contains("open")) return;
    if (recompute && calT0 !== null) calCompute(calT0);
    buildSkyCal();
  }
