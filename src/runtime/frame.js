  // ---------- オーバーレイ (ラベル・選択リング) ----------
  // 文字は lblPut で積むだけにして、最後に lblEnd でまとめて置く (優先度つきの
  // 衝突回避は render/body.js 側)。リングや破線は重なっても読めるので直に描く。
  function drawOverlay() {
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.textAlign = "center";
    lblBegin();
    // 注視しているだけの天体 (ツアー) には選択マークを付けない。
    // ツアーの注目天体 (spot) は選択とは別に、同じ見た目で強調する
    const marked = showSelMark ? selected : null;
    const spotB = tourSpot ? BODY_BY_KEY.get(tourSpot) : null;

    for (const b of [SUN, ...PLANETS]) {
      const s = screenPos.get(b.key);
      if (!s || s.hidden) continue;   // 手前の天体の円盤に隠れている
      if (s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) continue;
      if (s.r > H * 0.6) continue;
      const hit = marked === b || spotB === b;
      if (hit) {
        octx.beginPath();
        octx.arc(s.x, s.y, Math.max(s.r, 3) + 6, 0, 2 * Math.PI);
        octx.strokeStyle = "rgba(242,178,62,0.9)";
        octx.lineWidth = 1.2;
        octx.stroke();
      }
      lblBlock(s.x, s.y, s.r);   // 円盤の上に星座名などを置かせない
      if (b.showLabel) {
        lblPut(bName(b), s.x, s.y - Math.max(s.r, 3) - 9, hit ? LBL_SEL : LBL_BODY,
               hit ? "rgba(242,178,62,0.95)" : "rgba(201,213,234,0.75)", LF10);
      }
    }

    // 衛星ラベル (母天体から画面上で離れている、または十分拡大している時のみ)
    for (const s of SATELLITES) {
      const sp = screenPos.get(s.key);
      if (!sp || sp.hidden || sp.r >= H * 0.6) continue;
      if (sp.x < -40 || sp.x > W + 40 || sp.y < -40 || sp.y > H + 40) continue;
      const pp = screenPos.get(s.parent);
      const away = pp ? Math.hypot(sp.x - pp.x, sp.y - pp.y) > 16 : true;
      const hit = marked === s || spotB === s;
      lblBlock(sp.x, sp.y, sp.r);
      if (s.showLabel && (sp.r > 2 || away)) {
        lblPut(bName(s), sp.x, sp.y - Math.max(sp.r, 3) - 8, hit ? LBL_SEL : lblPri(s),
               hit ? "rgba(242,178,62,0.95)" : "rgba(201,213,234,0.6)", LF10);
      }
      if (hit) {
        octx.beginPath();
        octx.arc(sp.x, sp.y, Math.max(sp.r, 3) + 6, 0, 2 * Math.PI);
        octx.strokeStyle = "rgba(242,178,62,0.9)";
        octx.lineWidth = 1.2;
        octx.stroke();
      }
    }

    // 探査機 (実寸比では点にもならないので、常に名前を出す)
    for (const pr of PROBES) {
      if (!pr.live || (tourProbes && tourProbes.indexOf(pr.key) < 0)) continue;
      const sp = screenPos.get(pr.key);
      if (!sp || sp.hidden) continue;
      if (sp.x < -40 || sp.x > W + 40 || sp.y < -40 || sp.y > H + 40) continue;
      const hit = marked === pr || spotB === pr;
      lblPut(bName(pr), sp.x, sp.y - (pr.px ? pr.px * 0.5 : 4) - 8, hit ? LBL_SEL : LBL_PROBE,
             hit ? "rgba(242,178,62,0.95)" : "rgba(180,205,240,0.85)", LF10);
    }

    // ツアーの視線ガイド。注視している天体から、指定した天体の方向へ破線を引く。
    // 実寸比では相手がほぼ必ず画面外なので、枠の内側で止めて名前と矢じりを出す
    if (tourSight && !groundView && selected) {
      const from = screenPos.get(selected.key);
      const tb = BODY_BY_KEY.get(tourSight);
      if (from && tb) {
        // 相手はカメラの真横や後方にいることが多く、投影では位置が出ない。
        // ワールドの方向ベクトルをカメラの右/上ベクトルへ射影して画面の向きを得る
        const fw = posW.get(selected.key), tw = posW.get(tourSight);
        const vx = tw[0] - fw[0], vy = tw[1] - fw[1], vz = tw[2] - fw[2];
        let dx = vx * Vm[0] + vy * Vm[4] + vz * Vm[8];
        let dy = -(vx * Vm[1] + vy * Vm[5] + vz * Vm[9]);   // 画面の y は下向き
        const len = Math.hypot(dx, dy);
        if (len > 1e-9) {
          dx /= len; dy /= len;
          // 枠の内側まで伸ばす (長さは画面のピクセル。方向だけを上で求めている)
          const m = 52;                       // 枠からの余白 (名前を置く分)
          let t = Math.max(W, H);
          if (dx > 1e-6) t = Math.min(t, (W - m - from.x) / dx);
          else if (dx < -1e-6) t = Math.min(t, (m - from.x) / dx);
          if (dy > 1e-6) t = Math.min(t, (H - m - from.y) / dy);
          else if (dy < -1e-6) t = Math.min(t, (m - from.y) / dy);
          const t0 = Math.max(from.r, 3) + 10;
          if (t > t0 + 24) {
          const sx = from.x + dx * t0, sy = from.y + dy * t0;
          const ex = from.x + dx * t, ey = from.y + dy * t;
          octx.save();
          octx.setLineDash([7, 5]);
          octx.strokeStyle = "rgba(242,178,62,0.7)";
          octx.lineWidth = 1.2;
          octx.beginPath();
          octx.moveTo(sx, sy);
          octx.lineTo(ex, ey);
          octx.stroke();
          octx.restore();
          octx.fillStyle = "rgba(242,178,62,0.95)";
          octx.beginPath();                   // 矢じり
          octx.moveTo(ex, ey);
          octx.lineTo(ex - dx * 10 - dy * 5, ey - dy * 10 + dx * 5);
          octx.lineTo(ex - dx * 10 + dy * 5, ey - dy * 10 - dx * 5);
          octx.closePath();
          octx.fill();
          lblPut(bName(tb), ex - dx * 22, ey - dy * 22 - 4, LBL_SEL, "rgba(242,178,62,0.95)", LF10);
          }
        }
      }
    }

    // 星座名 (背景天球上のラベル)
    if (showConst) {
      for (const c of CONST_LABELS) {
        const w = VP[3] * c.wx + VP[7] * c.wy + VP[11] * c.wz + VP[15];
        if (w <= 0.001) continue;
        const x = (VP[0] * c.wx + VP[4] * c.wy + VP[8] * c.wz + VP[12]) / w;
        const y = (VP[1] * c.wx + VP[5] * c.wy + VP[9] * c.wz + VP[13]) / w;
        const px = (x * 0.5 + 0.5) * W, py = (1 - (y * 0.5 + 0.5)) * H;
        if (px < 0 || px > W || py < 0 || py > H) continue;
        lblPut(lang === "ja" ? c.ja : c.en, px, py, LBL_SKY, "rgba(150,178,224,0.5)");
      }
      // 黄道ラベル: 画面中央に最も近い可視点に1つ
      let bx = 0, by = 0, bd = Infinity;
      for (let i = 0; i + 2 < ECL_WORLD.length; i += 3) {
        const X = ECL_WORLD[i], Y = ECL_WORLD[i + 1], Z = ECL_WORLD[i + 2];
        const w = VP[3] * X + VP[7] * Y + VP[11] * Z + VP[15];
        if (w <= 0.001) continue;
        const px = ((VP[0] * X + VP[4] * Y + VP[8] * Z + VP[12]) / w * 0.5 + 0.5) * W;
        const py = (1 - ((VP[1] * X + VP[5] * Y + VP[9] * Z + VP[13]) / w * 0.5 + 0.5)) * H;
        if (px < 0 || px > W || py < 0 || py > H) continue;
        const d = (px - W / 2) ** 2 + (py - H / 2) ** 2;
        if (d < bd) { bd = d; bx = px; by = py; }
      }
      if (bd < Infinity) {
        lblPut(lang === "ja" ? "黄道" : "Ecliptic", bx, by - 6, LBL_SKY, "rgba(226,178,110,0.75)");
      }
    }
    lblEnd();
  }

  // ---------- 日時の表示 & 入力 ----------
  // 表示の基準は3つから選ぶ (時計の右端をタップで切替)。既定は端末のまま。
  //   device 端末のタイムゾーン。夏時間も端末任せ
  //   site   観測地の時刻。観測地を東京から動かすと、端末の時刻では空が読めない
  //   utc    協定世界時
  //
  // site は、観測地が都市リストのどれか (または現在地取得) なら**その土地の
  // 常用時** (JST・EST など。夏時間も込み)。緯度経度を直に入れた場合は常用時の
  // 区割りが分からないので、経度から出す地方平均太陽時 (LMT) に落とす。
  // LMT なら「12時に太陽が南中する」という意味が常に立つので、退避先として妥当。
  //
  // site は端末と同じずれになっても飛ばさない (東京 + 端末も日本、など)。
  // 選べるものが状況で増えたり減ったりする方が分かりにくい。ただし表示が
  // 端末と一字一句同じになってしまうので、site のときだけ 📍 を付ける —
  // これが無いと、押しても何も起きていないように見える。
  //
  // 時刻を出すところ (時計・出没・天文カレンダー) はすべてここを通す。
  // 片方だけ切り替わると、時計と出没時刻が食い違って前より読めなくなる
  const dateInput = document.getElementById("dateInput");
  const timeInput = document.getElementById("timeInput");
  const tzText = document.getElementById("tzText");
  const pad2 = (n) => String(n).padStart(2, "0");
  const CLOCK_MODES = ["device", "site", "utc"];
  let clockMode = "device";
  try {
    const v = localStorage.getItem("ssClock");
    if (CLOCK_MODES.indexOf(v) >= 0) clockMode = v;
  } catch (e) { /* プライベートモード等 */ }
  // ある時間帯の UTC からのずれ [ms]。その時間帯での壁時計を組み直して引き算する。
  // Intl.DateTimeFormat の生成は重いので時間帯ごとに使い回す
  const zoneFmt = new Map();
  function zoneOffset(zone, t) {
    let f = zoneFmt.get(zone);
    if (f === undefined) {
      try {
        f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour12: false,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit" });
      } catch (e) {
        f = null;                      // 未対応の時間帯名。以後は引かない
      }
      zoneFmt.set(zone, f);
    }
    if (!f) return null;
    const g = {};
    for (const p of f.formatToParts(new Date(t))) g[p.type] = p.value;
    // hour12:false は真夜中を "24" と出す実装がある
    const wall = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute, +g.second);
    return wall - (t - (t % 1000 + 1000) % 1000);   // 秒に丸めた t との差
  }
  // 観測地の常用時のずれ [ms]。時間帯が分からなければ null
  function siteCivilOffset(t) {
    const z = siteZone();
    return z ? zoneOffset(z, t) : null;
  }
  // UTC からのずれ [ms]。端末は日時によって変わる (夏時間) ので毎回引き直す
  function clockOffset(t) {
    if (clockMode === "utc") return 0;
    if (clockMode === "site") {
      const o = siteCivilOffset(t);
      return o !== null ? o : obsLon / 360 * DAY_MS;   // 常用時が引けなければ LMT
    }
    return -new Date(t).getTimezoneOffset() * 60000;
  }
  // 表示用にずらした Date。以後は getUTC* で読む — getHours() 等は端末の
  // タイムゾーンで解釈し直してしまい、ずらした意味が消える
  const clockDate = (ms) => new Date(ms + clockOffset(ms));
  const clockHM = (ms) => {
    const d = clockDate(ms);
    return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  };
  // 表示の年月日時分 → UTC のミリ秒。端末のずれは時刻そのものに依存するので、
  // 一度あてはめてから引き直して収束させる (夏時間の境目のため)
  function clockToMs(y, mo, dd, hh, mi, ss, ms) {
    const u = Date.UTC(y, mo, dd, hh, mi, ss || 0, ms || 0);
    return u - clockOffset(u - clockOffset(u));
  }
  // タイムゾーン略称 (JST / GMT / BST など)。zone を渡さなければ端末のもの。
  // 日付・言語・時間帯ごとにキャッシュ (夏時間で変わるため日付も鍵に入れる)
  let tzKey = "", tzVal = "";
  function tzAbbr(d, zone) {
    const key = lang + "|" + (zone || "") + "|" +
      d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (key !== tzKey) {
      tzKey = key;
      try {
        const opt = { timeZoneName: "short" };
        if (zone) opt.timeZone = zone;
        tzVal = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en", opt)
          .formatToParts(d).find((p) => p.type === "timeZoneName").value || "";
      } catch (e) {
        tzVal = "";
      }
    }
    return tzVal;
  }
  // DOM への書き込みは値が変わった時だけ行う (毎フレームのレイアウト誘発を防ぐ)
  let lastDateStr = "", lastTimeStr = "", lastTzStr = "";
  function updateClock() {
    const t = J2000 + simDays * DAY_MS;
    const d = clockDate(t);
    const ds = String(d.getUTCFullYear()).padStart(4, "0") +
      "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
    // 編集中は上書きしない
    if (document.activeElement !== dateInput && ds !== lastDateStr) {
      dateInput.value = ds;
      lastDateStr = ds;
    }
    const ts = pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
    if (document.activeElement !== timeInput && ts !== lastTimeStr) {
      timeInput.value = ts;
      lastTimeStr = ts;
    }
    const tz = clockMode === "utc" ? "UTC"
             : clockMode === "site" ? "\uD83D\uDCCD" + (siteZone() ? tzAbbr(new Date(t), siteZone()) : "LMT")
             : tzAbbr(new Date(t));
    if (tz !== lastTzStr) {
      tzText.textContent = tz;
      tzText.title = T().clockTzHint;
      lastTzStr = tz;
    }
  }
  // 基準の切替。切り替えたら次のフレームで必ず書き直させる
  tzText.addEventListener("click", () => {
    clockMode = CLOCK_MODES[(CLOCK_MODES.indexOf(clockMode) + 1) % CLOCK_MODES.length];
    try { localStorage.setItem("ssClock", clockMode); } catch (e) { /* プライベートモード等 */ }
    lastDateStr = lastTimeStr = lastTzStr = "";
    updateObs();
  });
  // 入力欄の min/max はローカル日付なので、範囲もローカル時刻で揃える
  const MIN_T = new Date(1900, 0, 1).getTime();
  const MAX_T = new Date(2199, 11, 31, 23, 59, 59, 999).getTime();
  function setSimTime(t) {
    simDays = (Math.min(Math.max(t, MIN_T), MAX_T) - J2000) / DAY_MS;
  }
  // ガイドツアーの「できました」判定用。simDays は再生でも勝手に動くので
  // スナップショットでは操作を見分けられない。日時が変わる経路はこの3つ
  // (日付欄・時刻欄・現在時刻ボタン) だけなので、ここで数える
  let clockEdits = 0;
  // 年を4桁打ち終える前にも change は発火する ("1" の時点で 0001 年として発火)。
  // そこで確定・補正すると入力途中の年が勝手に書き換わってしまうため、
  // 4桁揃うまでは何もしない。フォーカスも奪わない (奪うと続きが打てない)
  dateInput.addEventListener("change", () => {
    const v = dateInput.value;                // "YYYY-MM-DD"
    if (!v) return;
    const [y, mo, dd] = v.split("-").map(Number);
    if (!(y >= 1000)) return;                 // 入力途中 (年が4桁未満)
    // 日付だけを差し替え、時刻は今の値をそのまま持ち越す
    const c = clockDate(J2000 + simDays * DAY_MS);
    setSimTime(clockToMs(y, mo - 1, dd, c.getUTCHours(), c.getUTCMinutes(),
      c.getUTCSeconds(), c.getUTCMilliseconds()));
    clockEdits++;
  });
  // ---- 矢印キーの桁上がり ----
  // <input type="time"> の ↑↓ は、分が 59→00 で折り返すだけで時を繰り上げない。
  // 「1分進める」つもりの操作が59分戻る操作になってしまい、日の入りを1分ずつ
  // 追うような使い方ができない。
  //
  // どの桁にフォーカスがあるかを知る API は無いので、押す前と後の値を比べて
  // 折り返しから桁を見分ける。分だけが 59→00 に変わったなら分の桁、時だけが
  // 23→00 に変わったなら時の桁 — このふたつは同時には起きない。12時間表記の
  // 環境にある AM/PM 桁は ±12時間動くので、どちらの判定にも掛からない。
  //
  // イベントは keydown → input → change の順で、1ステップごとに change が飛ぶ
  let timeStep = null;                        // {v: 押す前の値, up: ↑か}
  timeInput.addEventListener("keydown", (e) => {
    timeStep = (e.key === "ArrowUp" || e.key === "ArrowDown")
      ? { v: timeInput.value, up: e.key === "ArrowUp" } : null;
  });
  timeInput.addEventListener("change", () => {
    const v = timeInput.value;                // "HH:MM"
    const st = timeStep;
    timeStep = null;                          // 1回のステップで1回だけ効かせる
    if (!v) return;
    let [hh, mi] = v.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mi)) return;
    let dayCarry = 0;
    const pv = st && st.v ? st.v.split(":").map(Number) : null;
    if (pv && Number.isFinite(pv[0]) && Number.isFinite(pv[1])) {
      const ph = pv[0], pm = pv[1];
      if (hh === ph) {
        // 分の桁。折り返していたら時へ繰り上げる (繰り下げる)
        if (st.up && pm === 59 && mi === 0) hh += 1;
        else if (!st.up && pm === 0 && mi === 59) hh -= 1;
        if (hh > 23) { hh = 0; dayCarry = 1; }
        else if (hh < 0) { hh = 23; dayCarry = -1; }
        // 編集中の欄は updateClock が書き換えないので、ここで直す
        if (hh !== ph) timeInput.value = pad2(hh) + ":" + pad2(mi);
      } else if (mi === pm) {
        // 時の桁。同じ話が一段上でも起きる — 23時から進めたら翌日にする
        if (st.up && ph === 23 && hh === 0) dayCarry = 1;
        else if (!st.up && ph === 0 && hh === 23) dayCarry = -1;
      }
    }
    // 時刻だけを差し替え。入力欄に秒が無いので秒以下は 0 に揃える
    // (日をまたいだときだけ、日付も一緒に動かす。日付欄はフォーカスが無いので
    //  updateClock が次のフレームで書き直す)
    const c = clockDate(J2000 + simDays * DAY_MS);
    setSimTime(clockToMs(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate() + dayCarry, hh, mi));
    clockEdits++;
  });
  // Enter で入力を終える
  dateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") dateInput.blur(); });
  timeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") timeInput.blur(); });
  // 入力欄を離れたら、実際の日時を必ず書き戻す (範囲外や打ちかけの表示を正す)
  dateInput.addEventListener("blur", () => { lastDateStr = ""; });
  timeInput.addEventListener("blur", () => { lastTimeStr = ""; timeStep = null; });
  // ---- 日送り (前日 / 翌日) ----
  // 矢印キーの繰り上がりは時刻欄には入れられたが、日付欄には入れられない。
  // <input type="date"> は桁ごとの編集状態を内部に持っていて、value 代入でも
  // stepUp/stepDown でも編集中の桁へは届かず、「6月31日」のような組み合わせが
  // 残る (value は空になる)。日をまたぐ操作はボタンで受ける
  function stepDay(n) {
    const c = clockDate(J2000 + simDays * DAY_MS);
    setSimTime(clockToMs(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate() + n,
      c.getUTCHours(), c.getUTCMinutes(), c.getUTCSeconds(), c.getUTCMilliseconds()));
    lastDateStr = "";                 // 次のフレームで日付欄を必ず書き直させる
    clockEdits++;
  }
  document.getElementById("dayPrev").addEventListener("click", () => stepDay(-1));
  document.getElementById("dayNext").addEventListener("click", () => stepDay(1));
  document.getElementById("nowBtn").addEventListener("click", () => {
    simDays = (Date.now() - J2000) / DAY_MS;
    clockEdits++;
  });
  function fmtDays(v) {
    const u = T().u;
    if (v >= 365.25) return (v / 365.25).toFixed(1) + u.yr;
    if (v >= 10) return Math.round(v) + u.d;
    if (v >= 1) return v.toFixed(1) + u.d;
    if (v >= 1 / 24) return (v * 24).toFixed(1) + u.h;
    if (v >= 1 / 1440) return Math.round(v * 1440) + u.min;
    return Math.round(v * 86400) + u.s;
  }
  // 再生速度の表示。最低速だけは「1秒/秒」になってしまい、割り算の形では
  // 意味が取りにくい (1秒で1秒進む = 等倍) ので、そこだけ言葉にする
  function fmtRate(v) {
    if (Math.abs(v * 86400 - 1) < 0.01) return T().rateReal;
    return fmtDays(v) + T().rateSuffix;
  }

  // ---------- メインループ ----------
  let last = performance.now();
  let lastSettingsSave = 0;
  let followKey = null;                   // 前フレームで追従していた天体
  const followPrev = [0, 0, 0];
  function frame(now) {
    // コンテキストを失ったら描き続けない (gl.* は無視されるだけだが、案内を
    // 出したうえで回し続ける意味がない)。復帰は gl/setup.js が開き直しで行う
    if (glLost) return;
    perfFrame(now);          // 描画負荷の計測 (?perf=1 のときだけ動く)
    const raw = (now - last) / 1000;
    last = now;
    const dtc = Math.min(0.5, raw);       // カメラ緩和用 (低 fps でも追従)
    // シミュレーション時刻は「実経過時間 × 再生速度」の連続関数にする。
    // タブ非表示中は rAF が止まるが、復帰フレームで隠れていた時間ぶんを
    // 一括で進める (クランプすると 1秒=1秒 でも時計が現実から遅れていく)
    if (playing) {
      let adv = daysPerSec * raw;
      // ツアーの早送りは、指定日時でいきなり止めずに手前から落として着地させる。
      // 残り時間が窓 (今の速さで 1.2秒ぶん) を切ったら √ で減速 — 減速度が一定に
      // なるので、止まる瞬間だけが急にならない
      if (tourUntil !== null) {
        const win = daysPerSec * 1.2, rem = tourUntil - simDays;
        if (rem > 0 && rem < win) adv *= Math.max(0.02, Math.sqrt(rem / win));
      }
      simDays += adv;
    }
    // 探査機のモデルはゆっくり回して立体だと分かるようにしているが、回し続けると
    // 時計を止めた場面でも機体だけが動いてしまう。再生中だけ進める
    if (playing) probeSpin += dtc * 0.10;

    if (selected && followKey === selected.key) {
      const t = posW.get(selected.key);
      followPrev[0] = t[0]; followPrev[1] = t[1]; followPrev[2] = t[2];
    }

    updatePositions();
    updateEclipses();   // 太陽面を隠している天体を、今の位置から選び直す

    // 注視点追従 & ズーム・角度の緩和
    if (selected) {
      const t = posW.get(selected.key);
      if (followKey === selected.key) {
        // 天体の公転移動分は即時追従 (緩和すると実サイズ時に遅れで見失う)
        cam.focus[0] += t[0] - followPrev[0];
        cam.focus[1] += t[1] - followPrev[1];
        cam.focus[2] += t[2] - followPrev[2];
      }
      followKey = selected.key;
      lastCenter = selected;
      cam.focusTgt[0] = t[0]; cam.focusTgt[1] = t[1]; cam.focusTgt[2] = t[2];
    } else {
      followKey = null;
    }
    const k = 1 - Math.exp(-dtc * 5.5);
    cam.focus[0] += (cam.focusTgt[0] - cam.focus[0]) * k;
    cam.focus[1] += (cam.focusTgt[1] - cam.focus[1]) * k;
    cam.focus[2] += (cam.focusTgt[2] - cam.focus[2]) * k;
    cam.panOff[0] += (cam.panOffTgt[0] - cam.panOff[0]) * k;
    cam.panOff[1] += (cam.panOffTgt[1] - cam.panOff[1]) * k;
    cam.panOff[2] += (cam.panOffTgt[2] - cam.panOff[2]) * k;
    cam.distTgt = Math.max(minDist(), Math.min(1400, cam.distTgt));
    cam.dist += (cam.distTgt - cam.dist) * k;
    camZoomTgt = Math.max(1, Math.min(MAG_MAX, camZoomTgt));
    camZoom += (camZoomTgt - camZoom) * k;
    let dyaw = (cam.yawTgt - cam.yaw) % (2 * Math.PI);
    if (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    cam.yaw += dyaw * k;
    cam.pitch += (cam.pitchTgt - cam.pitch) * k;
    // 地上ビューのカメラ緩和 (目標方位は aimGroundAt で現在値の近傍に正規化済み)
    if (groundView) {
      buildObsFrame();   // 追尾計算 (surfaceAltAz) が現在フレームの観測者基底を使えるように
      // 選択が変わって天体別の画角下限が上がった場合は目標を追従させる
      const mf = gMinFov();
      if (gFovTgt < mf) gFovTgt = mf;
      // 自動追尾: 日周運動での移動分は即時反映し、残差のみ緩和で追従
      // (緩和だけだと定常遅れが高倍率の視野幅を超え、天体が視野外に留まるため)
      if (gTrack) {
        // 追う先は天体か、流星群の放射点 (ツアーで放射点を画面中央に留める)
        const b = gRadTrack ? null : (selected || lastCenter);
        const c = gRadTrack ? radiantAltAz(gRadTrack)
                            : (b && b.key !== surfaceBody ? surfaceAltAz(b) : null);
        const trk = gRadTrack ? "@" + gRadTrack : (b ? b.key : "");
        if (c) {
          const az = c.az * DEG, alt = c.alt * DEG;
          if (gTrkKey === trk) {
            // 前フレームからの移動分は即時追従
            let dm = (az - gTrkAz) % (2 * Math.PI);
            if (dm > Math.PI) dm -= 2 * Math.PI;
            if (dm < -Math.PI) dm += 2 * Math.PI;
            gAz += dm;
            gAlt += alt - gTrkAlt;
          }
          // 残差 (追尾開始前に生じたずれ等) は目標へ寄せて緩和で収束させる
          let dr = (az - gAz) % (2 * Math.PI);
          if (dr > Math.PI) dr -= 2 * Math.PI;
          if (dr < -Math.PI) dr += 2 * Math.PI;
          gAzTgt = gAz + dr;
          gAltTgt = Math.max(-1.4, Math.min(GALT_MAX, alt));
          gTrkKey = trk; gTrkAz = az; gTrkAlt = alt;
        }
      } else {
        gTrkKey = "";
        gRadTrack = "";
      }
    }
    gAz += (gAzTgt - gAz) * k;
    gAlt += (gAltTgt - gAlt) * k;
    gFov += (gFovTgt - gFov) * k;

    tourRideCam();     // ガイドツアー: 探査機視点のステップはカメラを直接置く
    introStep(now / 1000);   // 初回の導入: カメラを寄せる (流していなければ素通り)
    perfLap("更新");
    render(now / 1000);
    perfLap("描画(他)");
    bloomPass();          // 明るいところの滲み (シーンを描き終えてから)
    perfLap("Bloom");
    updateClock();
    tourWatch();          // ガイドツアー: 促した操作をされたら次のステップへ
    updateZoomUI();
    updateMagUI();
    updateAngleUI();
    updateObs();
    updateGroundUI();
    if (now - lastSettingsSave > 2000) {
      lastSettingsSave = now;
      saveSettings();
    }
    perfLap("UI");
    perfDraw();           // 計測の表示はいちばん最後 (オーバーレイを消さないため)
    requestAnimationFrame(frame);
  }

