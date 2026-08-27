  // ---------- 描画負荷の表示 (?perf=1 のときだけ) ----------
  // 開発用。既定では計測も描画もしない — perfOn が false のとき perfLap は
  // 即 return するので、通常の再生には一切触らない。
  //
  // 測れるのは CPU の時間だけ。gl.* の呼び出しはコマンドを積むだけで、実際に
  // 絵を出すのは GPU なので、区間の合計とフレーム間隔は一致しない。読み方:
  //   合計 ≈ 間隔          → CPU 律速。区間の内訳がそのまま効く
  //   合計 << 間隔 で 60fps → 頭打ち。余力がどれだけあるかは分からない
  //   合計 << 間隔 で 60fps 未満 → GPU 律速。メニューの切替で当たりを付ける
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
  }
  // 前回の lap からここまでを name の時間として足す
  function perfLap(name) {
    if (!perfOn) return;
    const t = performance.now();
    if (!perfAcc.has(name)) { perfKeys.push(name); perfAcc.set(name, 0); }
    perfAcc.set(name, perfAcc.get(name) * (1 - PERF_EMA) + (t - perfLapT) * PERF_EMA);
    perfLapT = t;
  }
  const perfCount = (name, n) => { if (perfOn) perfCnt.set(name, n); };

  function perfDraw() {
    if (!perfOn) return;
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
    lines.push("CPU 合計 " + secSum.toFixed(2) + " ms");
    for (const k of perfKeys) lines.push("  " + k + "  " + perfAcc.get(k).toFixed(2));
    let cnt = "";
    for (const [k, v] of perfCnt) cnt += (cnt ? "  " : "") + k + " " + v;
    if (cnt) lines.push(cnt);
    lines.push(glc.width + "×" + glc.height + "  DPR " + DPR.toFixed(2));

    const pad = 7, lh = 14, gw = PERF_N, gh = 26;
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.font = '11px "SF Mono","Menlo",monospace';
    octx.textAlign = "left";
    let w = gw;
    for (const s of lines) w = Math.max(w, octx.measureText(s).width);
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
      octx.fillText(lines[i], gx, gy + gh + 4 + lh * (i + 1) - 3);
    }
  }
