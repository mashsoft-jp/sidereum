  // ---------- オーバーレイ (ラベル・選択リング) ----------
  function drawOverlay() {
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.textAlign = "center";
    octx.font = '10.5px "Avenir Next","Hiragino Sans",sans-serif';
    // 注視しているだけの天体 (ツアー) には選択マークを付けない。
    // ツアーの注目天体 (spot) は選択とは別に、同じ見た目で強調する
    const marked = showSelMark ? selected : null;
    const spotB = tourSpot ? BODY_BY_KEY.get(tourSpot) : null;

    for (const b of [SUN, ...PLANETS]) {
      const s = screenPos.get(b.key);
      if (!s || s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) continue;
      if (s.r > H * 0.6) continue;
      if (marked === b || spotB === b) {
        octx.beginPath();
        octx.arc(s.x, s.y, Math.max(s.r, 3) + 6, 0, 2 * Math.PI);
        octx.strokeStyle = "rgba(242,178,62,0.9)";
        octx.lineWidth = 1.2;
        octx.stroke();
      }
      if (b.showLabel) {
        octx.fillStyle = (marked === b || spotB === b) ? "rgba(242,178,62,0.95)" : "rgba(201,213,234,0.75)";
        octx.fillText(bName(b), s.x, s.y - Math.max(s.r, 3) - 9);
      }
    }

    // 衛星ラベル (母天体から画面上で離れている、または十分拡大している時のみ)
    for (const s of SATELLITES) {
      const sp = screenPos.get(s.key);
      if (!sp || sp.r >= H * 0.6) continue;
      if (sp.x < -40 || sp.x > W + 40 || sp.y < -40 || sp.y > H + 40) continue;
      const pp = screenPos.get(s.parent);
      const away = pp ? Math.hypot(sp.x - pp.x, sp.y - pp.y) > 16 : true;
      if (s.showLabel && (sp.r > 2 || away)) {
        octx.fillStyle = (marked === s || spotB === s) ? "rgba(242,178,62,0.95)" : "rgba(201,213,234,0.6)";
        octx.fillText(bName(s), sp.x, sp.y - Math.max(sp.r, 3) - 8);
      }
      if (marked === s || spotB === s) {
        octx.beginPath();
        octx.arc(sp.x, sp.y, Math.max(sp.r, 3) + 6, 0, 2 * Math.PI);
        octx.strokeStyle = "rgba(242,178,62,0.9)";
        octx.lineWidth = 1.2;
        octx.stroke();
      }
    }

    // 探査機 (実寸比では点にもならないので、常に名前を出す)
    for (const pr of PROBES) {
      if (!pr.live || (tourProbe && pr.key !== tourProbe)) continue;
      const sp = screenPos.get(pr.key);
      if (!sp || sp.x < -40 || sp.x > W + 40 || sp.y < -40 || sp.y > H + 40) continue;
      octx.fillStyle = (marked === pr || spotB === pr)
        ? "rgba(242,178,62,0.95)" : "rgba(180,205,240,0.85)";
      octx.fillText(bName(pr), sp.x, sp.y - PROBE_PX * 0.5 - 8);
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
          octx.fillText(bName(tb), ex - dx * 22, ey - dy * 22 - 4);
          }
        }
      }
    }

    // 星座名 (背景天球上のラベル)
    if (showConst) {
      octx.fillStyle = "rgba(150,178,224,0.5)";
      octx.font = '11px "Avenir Next","Hiragino Sans",sans-serif';
      for (const c of CONST_LABELS) {
        const w = VP[3] * c.wx + VP[7] * c.wy + VP[11] * c.wz + VP[15];
        if (w <= 0.001) continue;
        const x = (VP[0] * c.wx + VP[4] * c.wy + VP[8] * c.wz + VP[12]) / w;
        const y = (VP[1] * c.wx + VP[5] * c.wy + VP[9] * c.wz + VP[13]) / w;
        const px = (x * 0.5 + 0.5) * W, py = (1 - (y * 0.5 + 0.5)) * H;
        if (px < 0 || px > W || py < 0 || py > H) continue;
        octx.fillText(lang === "ja" ? c.ja : c.en, px, py);
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
        octx.fillStyle = "rgba(226,178,110,0.75)";
        octx.fillText(lang === "ja" ? "黄道" : "Ecliptic", bx, by - 6);
      }
    }
  }

  // ---------- 日時の表示 & 入力 (表示はローカル時刻) ----------
  const dateInput = document.getElementById("dateInput");
  const timeInput = document.getElementById("timeInput");
  const tzText = document.getElementById("tzText");
  const pad2 = (n) => String(n).padStart(2, "0");
  // タイムゾーン略称 (JST / GMT / BST など)。日付・言語ごとにキャッシュ (夏時間対応)
  let tzKey = "", tzVal = "";
  function tzAbbr(d) {
    const key = lang + "|" + d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (key !== tzKey) {
      tzKey = key;
      try {
        tzVal = new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en", { timeZoneName: "short" })
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
    const d = new Date(J2000 + simDays * DAY_MS);
    const ds = String(d.getFullYear()).padStart(4, "0") +
      "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    // 編集中は上書きしない
    if (document.activeElement !== dateInput && ds !== lastDateStr) {
      dateInput.value = ds;
      lastDateStr = ds;
    }
    const ts = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (document.activeElement !== timeInput && ts !== lastTimeStr) {
      timeInput.value = ts;
      lastTimeStr = ts;
    }
    const tz = tzAbbr(d);
    if (tz !== lastTzStr) {
      tzText.textContent = tz;
      lastTzStr = tz;
    }
  }
  // 入力欄の min/max はローカル日付なので、範囲もローカル時刻で揃える
  const MIN_T = new Date(1900, 0, 1).getTime();
  const MAX_T = new Date(2199, 11, 31, 23, 59, 59, 999).getTime();
  function setSimTime(t) {
    simDays = (Math.min(Math.max(t, MIN_T), MAX_T) - J2000) / DAY_MS;
  }
  // 年を4桁打ち終える前にも change は発火する ("1" の時点で 0001 年として発火)。
  // そこで確定・補正すると入力途中の年が勝手に書き換わってしまうため、
  // 4桁揃うまでは何もしない。フォーカスも奪わない (奪うと続きが打てない)
  dateInput.addEventListener("change", () => {
    const v = dateInput.value;                // "YYYY-MM-DD"
    if (!v) return;
    const [y, mo, dd] = v.split("-").map(Number);
    if (!(y >= 1000)) return;                 // 入力途中 (年が4桁未満)
    // 日付だけを差し替え、時刻は今の値をそのまま持ち越す
    const c = new Date(J2000 + simDays * DAY_MS);
    setSimTime(new Date(y, mo - 1, dd,
      c.getHours(), c.getMinutes(), c.getSeconds(), c.getMilliseconds()).getTime());
  });
  timeInput.addEventListener("change", () => {
    const v = timeInput.value;                // "HH:MM"
    if (!v) return;
    const [hh, mi] = v.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mi)) return;
    // 時刻だけを差し替え。入力欄に秒が無いので秒以下は 0 に揃える
    const c = new Date(J2000 + simDays * DAY_MS);
    setSimTime(new Date(c.getFullYear(), c.getMonth(), c.getDate(), hh, mi, 0, 0).getTime());
  });
  // Enter で入力を終える
  dateInput.addEventListener("keydown", (e) => { if (e.key === "Enter") dateInput.blur(); });
  timeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") timeInput.blur(); });
  // 入力欄を離れたら、実際の日時を必ず書き戻す (範囲外や打ちかけの表示を正す)
  dateInput.addEventListener("blur", () => { lastDateStr = ""; });
  timeInput.addEventListener("blur", () => { lastTimeStr = ""; });
  document.getElementById("nowBtn").addEventListener("click", () => {
    simDays = (Date.now() - J2000) / DAY_MS;
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

  // ---------- メインループ ----------
  let last = performance.now();
  let lastSettingsSave = 0;
  let followKey = null;                   // 前フレームで追従していた天体
  const followPrev = [0, 0, 0];
  function frame(now) {
    const raw = (now - last) / 1000;
    last = now;
    const dtc = Math.min(0.5, raw);       // カメラ緩和用 (低 fps でも追従)
    // シミュレーション時刻は「実経過時間 × 再生速度」の連続関数にする。
    // タブ非表示中は rAF が止まるが、復帰フレームで隠れていた時間ぶんを
    // 一括で進める (クランプすると 1秒=1秒 でも時計が現実から遅れていく)
    if (playing) simDays += daysPerSec * raw;

    if (selected && followKey === selected.key) {
      const t = posW.get(selected.key);
      followPrev[0] = t[0]; followPrev[1] = t[1]; followPrev[2] = t[2];
    }

    updatePositions();

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
        const b = selected || lastCenter;
        if (b && b.key !== surfaceBody) {
          const c = surfaceAltAz(b);
          const az = c.az * DEG, alt = c.alt * DEG;
          if (gTrkKey === b.key) {
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
          gTrkKey = b.key; gTrkAz = az; gTrkAlt = alt;
        }
      } else {
        gTrkKey = "";
      }
    }
    gAz += (gAzTgt - gAz) * k;
    gAlt += (gAltTgt - gAlt) * k;
    gFov += (gFovTgt - gFov) * k;

    render(now / 1000);
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
    requestAnimationFrame(frame);
  }

