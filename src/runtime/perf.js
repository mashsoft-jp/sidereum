  // ---------- 描画負荷の表示 (?perf=1 のときだけ) ----------
  // 開発用。既定では計測も描画もしない — perfOn が false のとき perfLap は
  // 即 return するので、通常の再生には一切触らない。
  //
  // CPU の時間は performance.now() の差。gl.* の呼び出しはコマンドを積むだけで、
  // 実際に絵を出すのは GPU なので、これだけでは区間の合計とフレーム間隔が一致
  // しない。読み方:
  //   合計 ≈ 間隔          → CPU 律速。区間の内訳がそのまま効く
  //   合計 << 間隔 で 60fps → 頭打ち。余力がどれだけあるかは分からない
  //   合計 << 間隔 で 60fps 未満 → GPU 律速。どの区間かは GPU 列を見る
  //
  // GPU の時間は EXT_disjoint_timer_query で測る (取れる環境だけ。iOS Safari
  // など拡張の無いところでは列ごと出ない = これまでと同じ表示になる)。
  const perfOn = /(^|[?&])perf=1(&|$)/.test(location.search);
  const PERF_N = 120;                     // 履歴 (60fps で 2秒ぶん)
  const perfHist = new Float32Array(PERF_N);
  let perfHead = 0, perfPrev = 0, perfLapT = 0;
  const perfKeys = [];                    // 出た順に並べる (フレーム内の順序)
  const perfAcc = new Map();              // 区間名 → 直近の平均 [ms]
  const perfCnt = new Map();              // 数えたもの (恒星の数など)
  const PERF_EMA = 0.1;                   // 平均の追従 (数字が暴れると読めない)

  function perfFrame(now) {
    if (!perfOn) return;
    if (perfPrev) {
      perfHist[perfHead] = now - perfPrev;
      perfHead = (perfHead + 1) % PERF_N;
    }
    perfPrev = now;
    // 区間の起点は「いま」であって rAF の時刻ではない。rAF の引数はブラウザが
    // フレームを組み立てた時刻で、コールバックが実際に走り出すまでには間が
    // ある (タブが絞られていると数百ms)。now を起点にすると、その待ち時間が
    // まるごと最初の区間に乗って読めなくなる
    perfLapT = performance.now();
    gpuBegin();
  }
  // 前回の lap からここまでを name の時間として足す
  function perfLap(name) {
    if (!perfOn) return;
    const t = performance.now();
    if (!perfAcc.has(name)) { perfKeys.push(name); perfAcc.set(name, 0); }
    perfAcc.set(name, perfAcc.get(name) * (1 - PERF_EMA) + (t - perfLapT) * PERF_EMA);
    perfLapT = t;
    gpuEnd(name);
    gpuBegin();
  }
  const perfCount = (name, n) => { if (perfOn) perfCnt.set(name, n); };

  // ---------- GPU の時間 ----------
  // GPU のコマンド列に目印を打ち、その区間に GPU が費やした時間を返してもらう。
  // クセが3つある。
  //   - 結果は即座には返らない。投げたクエリを後のフレームで回収する
  //   - TIME_ELAPSED は同時に1つしか走らせられない。区間は順に測る
  //     (perfLap の位置がそのまま区切りになるので、呼び出し側は変えていない)
  //   - GPU_DISJOINT_EXT が立った回は値が無意味なので捨てる。読むと下りるので
  //     フレームに1回だけ読む
  //
  // ?perf=1 のときしか拡張を取らない。通常の再生では何も起きない
  const gpuExt = perfOn ? gl.getExtension("EXT_disjoint_timer_query") : null;
  const gpuAcc = new Map();      // 区間名 → 直近の平均 [ms]
  const gpuFree = [];            // 回収済みのクエリ (使い回す)
  const gpuWait = [];            // { name, q } 結果待ち
  let gpuOpen = null;            // begin 済みで end 待ち
  const GPU_MAX = 32;            // 抱える上限。回収が追いつかない間は測らない

  function gpuBegin() {
    if (!gpuExt || gpuOpen || gpuWait.length >= GPU_MAX) return;
    const q = gpuFree.pop() || gpuExt.createQueryEXT();
    gpuExt.beginQueryEXT(gpuExt.TIME_ELAPSED_EXT, q);
    gpuOpen = q;
  }
  // name が null のときは測るだけ測って捨てる (フレーム末尾の端数)
  function gpuEnd(name) {
    if (!gpuOpen) return;
    gpuExt.endQueryEXT(gpuExt.TIME_ELAPSED_EXT);
    gpuWait.push({ name, q: gpuOpen });
    gpuOpen = null;
  }
  function gpuPoll() {
    if (!gpuExt) return;
    // 途中で GPU を他に取られた回は、その間の値がすべて無意味になる
    const bad = gl.getParameter(gpuExt.GPU_DISJOINT_EXT);
    for (let i = gpuWait.length - 1; i >= 0; i--) {
      const w = gpuWait[i];
      if (!gpuExt.getQueryObjectEXT(w.q, gpuExt.QUERY_RESULT_AVAILABLE_EXT)) continue;
      if (!bad && w.name) {
        const ms = gpuExt.getQueryObjectEXT(w.q, gpuExt.QUERY_RESULT_EXT) / 1e6;
        const pv = gpuAcc.has(w.name) ? gpuAcc.get(w.name) : ms;
        gpuAcc.set(w.name, pv * (1 - PERF_EMA) + ms * PERF_EMA);
      }
      gpuFree.push(w.q);
      gpuWait.splice(i, 1);
    }
  }

  function perfDraw() {
    if (!perfOn) return;
    gpuEnd(null);        // 最後の区間 (この表示自体) は測っても意味がない
    gpuPoll();
    let sum = 0, mx = 0, n = 0;
    for (let i = 0; i < PERF_N; i++) {
      const v = perfHist[i];
      if (v > 0) { sum += v; if (v > mx) mx = v; n++; }
    }
    if (!n) return;
    const avg = sum / n;
    let secSum = 0;
    for (const k of perfKeys) secSum += perfAcc.get(k);
    const lines = [];
    lines.push((1000 / avg).toFixed(1) + " fps   " + avg.toFixed(1) + " ms  (最悪 " + mx.toFixed(1) + ")");
    // 区間の行だけは [名前, CPU, GPU] の配列で持ち、数字を右寄せで別に描く。
    // 名前に全角が混ざるので、等幅フォントでも文字数では桁が揃わない
    if (gpuExt) {
      let gpuSum = 0;
      for (const k of perfKeys) gpuSum += gpuAcc.get(k) || 0;
      lines.push("合計  CPU " + secSum.toFixed(2) + "  GPU " + gpuSum.toFixed(2) + " ms");
      // まだ結果が返っていない区間は — (数フレーム遅れて埋まる)
      for (const k of perfKeys) {
        lines.push([k, perfAcc.get(k).toFixed(2),
                    gpuAcc.has(k) ? gpuAcc.get(k).toFixed(2) : "—"]);
      }
    } else {
      lines.push("CPU 合計 " + secSum.toFixed(2) + " ms");
      for (const k of perfKeys) lines.push([k, perfAcc.get(k).toFixed(2), ""]);
    }
    let cnt = "";
    for (const [k, v] of perfCnt) cnt += (cnt ? "  " : "") + k + " " + v;
    if (cnt) lines.push(cnt);
    lines.push(glc.width + "×" + glc.height + "  DPR " + DPR.toFixed(2));

    const pad = 7, lh = 14, gw = PERF_N, gh = 26;
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.font = '11px "SF Mono","Menlo",monospace';
    octx.textAlign = "left";
    // 区間の行の桁位置 (字下げ / 名前の幅 / 数字1桁ぶんの幅)
    const IND = 12, GAP = 8, numW = octx.measureText("0000.00").width;
    let nameW = 0;
    for (const s of lines) if (typeof s !== "string") nameW = Math.max(nameW, octx.measureText(s[0]).width);
    const rowW = IND + nameW + GAP + numW + GAP + numW;
    let w = gw;
    for (const s of lines) w = Math.max(w, typeof s === "string" ? octx.measureText(s).width : rowW);
    const bw = w + pad * 2, bh = lines.length * lh + gh + pad * 2 + 4;
    // 右端の縦スライダーを避ける。狭い画面では時計とビュー切替が縦に伸びるので、
    // そのぶん下げる (開発用なので多少重なっても構わないが、グラフは見たい)
    const bx = Math.max(8, W - bw - 58), by = W < 700 ? 190 : 78;
    octx.fillStyle = "rgba(4,6,14,0.82)";
    octx.fillRect(bx, by, bw, bh);
    octx.strokeStyle = "rgba(150,178,224,0.25)";
    octx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    // フレーム間隔の棒グラフ。33ms でグラフの高さいっぱい、16.7ms に目安の線
    const gx = bx + pad, gy = by + pad;
    octx.fillStyle = "rgba(150,178,224,0.10)";
    octx.fillRect(gx, gy, gw, gh);
    for (let i = 0; i < PERF_N; i++) {
      const v = perfHist[(perfHead + i) % PERF_N];
      if (!(v > 0)) continue;
      const h = Math.min(gh, v / 33 * gh);
      octx.fillStyle = v > 16.9 ? "rgba(242,178,62,0.9)" : "rgba(120,200,150,0.75)";
      octx.fillRect(gx + i, gy + gh - h, 1, h);
    }
    octx.fillStyle = "rgba(150,178,224,0.45)";
    octx.fillRect(gx, gy + gh - 16.7 / 33 * gh, gw, 1);
    octx.fillStyle = "rgba(201,213,234,0.95)";
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i], y = gy + gh + 4 + lh * (i + 1) - 3;
      if (typeof s === "string") { octx.fillText(s, gx, y); continue; }
      octx.fillText(s[0], gx + IND, y);
      octx.textAlign = "right";
      octx.fillText(s[1], gx + IND + nameW + GAP + numW, y);
      if (s[2]) octx.fillText(s[2], gx + rowW, y);
      octx.textAlign = "left";
    }
  }
