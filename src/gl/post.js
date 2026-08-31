
  // ---------- Bloom (明るいところの滲み) ----------
  // シーンは既定のフレームバッファへ描いたまま、描き終わってから
  // copyTexSubImage2D で取り込む。オフスクリーンへ描くと MSAA (canvas の
  // antialias) が効かなくなり、軌道線や天体の輪郭がギザギザになるため。
  //
  // 取り込む → しきい値で明るいところだけ抜きつつ 1/4 に縮小 → 横と縦に
  // ぼかす → 画面へ加算。UI と天体名は別のキャンバスなので最初から対象外
  const BLOOM_DIV = 4;
  const BLOOM_THRESH = 0.72;   // これ以下の明るさは滲ませない
  const BLOOM_AMOUNT = 0.45;   // 戻すときの強さ

  let bloomOn = localStorage.getItem("ssBloom") !== "0";   // 既定 ON
  let bloomReady = false;      // 確保に失敗した端末では以後あきらめる
  let bloomFailed = false;
  let bloomSrcW = 0, bloomSrcH = 0, bloomW = 0, bloomH = 0;
  let sceneTex = null;
  const bloomTex = [null, null], bloomFB = [null, null];

  // 画面いっぱいを覆う三角形1枚
  const postVB = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, postVB);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  // fmt: 画面の取り込み先は RGB でなければならない。canvas を alpha:false で
  // 作っているので既定のフレームバッファにアルファが無く、RGBA へ
  // copyTexSubImage2D すると INVALID_OPERATION になる。
  // ぼかし用はレンダーターゲットなので、確実に描ける RGBA にする
  function postTex(w, h, fmt) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, null);
    // 2の累乗とは限らないので、ミップマップと REPEAT は使えない
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // 画面寸法が変わったら作り直す。resize() から呼ぶと初期化順に縛られるので、
  // 描く直前に自分で見に行く
  function bloomTargets() {
    if (bloomFailed) return false;
    const w = glc.width, h = glc.height;
    if (w < 8 || h < 8) return false;
    if (bloomReady && w === bloomSrcW && h === bloomSrcH) return true;
    for (const t of [sceneTex, bloomTex[0], bloomTex[1]]) if (t) gl.deleteTexture(t);
    for (const f of bloomFB) if (f) gl.deleteFramebuffer(f);
    bloomSrcW = w; bloomSrcH = h;
    bloomW = Math.max(2, Math.floor(w / BLOOM_DIV));
    bloomH = Math.max(2, Math.floor(h / BLOOM_DIV));
    sceneTex = postTex(w, h, gl.RGB);
    for (let i = 0; i < 2; i++) {
      bloomTex[i] = postTex(bloomW, bloomH, gl.RGBA);
      bloomFB[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFB[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bloomTex[i], 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        bloomFailed = true;
        console.warn("Bloom 用のフレームバッファを作れませんでした。無効にします");
        return false;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    bloomReady = true;
    return true;
  }

  // 三角形を1枚描く。プログラムごとに aPos の場所が違うので毎回張り直す
  function postDraw(p) {
    gl.enableVertexAttribArray(p.a.aPos);
    gl.vertexAttribPointer(p.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(p.a.aPos);
  }

  // ---------- HDR オフスクリーン (?gl=2 のときだけ) ----------
  // シーンをリニアの放射輝度のまま RGBA16F へ描き、最後にまとめてトーンマップ
  // する。各パスでトーンマップしてしまうと 1.0 を超える明るさ (太陽・恒星) が
  // その時点で潰れ、滲みへ渡す情報が残らない。
  //
  // MSAA は自前で持つ。canvas の antialias は既定のフレームバッファにしか
  // 効かないので、そのままオフスクリーンへ描くと軌道線がギザギザになる
  // (WebGL 1 経路で画面を copyTexSubImage2D している理由がこれ)。
  // マルチサンプルのレンダーバッファへ描き、blitFramebuffer で解決する。
  //
  // 合成したあとの画面は WebGL 1 のときとまったく同じ内容なので、Bloom は
  // これまでどおり画面を取り込む経路のまま動く (この段では滲みの計算は
  // 変えていない)。
  let hdrW = 0, hdrH = 0, hdrReady = false, hdrFailed = false;
  let msFB = null, msCol = null, msDep = null, hdrFB = null, hdrTex = null;
  let hbW = 0, hbH = 0;
  const hbTex = [null, null], hbFB = [null, null];
  // リニアでのしきい値。1.0 = 正面から照らされた白い面。
  //
  // 固定にしてはいけない。夕方は大気減光で太陽の円盤が 1.3 程度まで落ち、
  // 1.0 をかろうじて超えるだけになって滲みがほとんど出なかった。一方で空の
  // 側は skyAdaptGain (目の順応) で持ち上げているので、暗い場面ほど「何を
  // 明るいと見なすか」の基準が下がる。WebGL 1 経路が skyDayF でしきい値を
  // 動かしているのと同じ考え方で、昼は高く・薄明から夜は低くする
  const hdrThresh = () => 0.25 + skyDayF * 0.90;
  const HDR_AMOUNT = 0.55;

  // HDR のぼかし先。8bit だと 1.0 で頭打ちになり、太陽のような
  // 桁違いに明るいものの情報がここで消える
  function hdrTex16(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function hdrTargets() {
    if (!hdrOn || hdrFailed) return false;
    const w = glc.width, h = glc.height;
    if (w < 8 || h < 8) return false;
    if (hdrReady && w === hdrW && h === hdrH) return true;
    if (msFB) {
      gl.deleteFramebuffer(msFB); gl.deleteRenderbuffer(msCol); gl.deleteRenderbuffer(msDep);
      gl.deleteFramebuffer(hdrFB); gl.deleteTexture(hdrTex);
      for (let i = 0; i < 2; i++) { gl.deleteTexture(hbTex[i]); gl.deleteFramebuffer(hbFB[i]); }
    }
    hdrReady = false;
    hdrW = w; hdrH = h;
    const smp = Math.max(1, Math.min(4, gl.getParameter(gl.MAX_SAMPLES)));
    msCol = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, msCol);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, smp, gl.RGBA16F, w, h);
    msDep = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, msDep);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, smp, gl.DEPTH_COMPONENT24, w, h);
    msFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, msFB);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msCol);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msDep);
    const okMS = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    // 解決先。ここから合成パスが読む
    hdrTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, hdrTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    hdrFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, hdrFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hdrTex, 0);
    const okRS = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!okMS || !okRS) {
      hdrFailed = true;
      console.warn("HDR 用のフレームバッファを作れませんでした。既定の経路で描きます");
      return false;
    }
    // 滲み用 (1/4 解像度)。WebGL 1 経路の bloomTex とは別に持つ —
    // あちらは 8bit で、リニアの値を入れると 1.0 で潰れる
    hbW = Math.max(2, Math.floor(w / BLOOM_DIV));
    hbH = Math.max(2, Math.floor(h / BLOOM_DIV));
    for (let i = 0; i < 2; i++) {
      hbTex[i] = hdrTex16(hbW, hbH);
      hbFB[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, hbFB[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hbTex[i], 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        hdrFailed = true;
        console.warn("HDR 用のフレームバッファを作れませんでした。既定の経路で描きます");
        return false;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    hdrReady = true;
    return true;
  }
  // シーンを描く前。オフスクリーンへ向ける (使えないときは既定のまま)
  function hdrBegin() {
    if (!hdrTargets()) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, msFB);
    gl.viewport(0, 0, hdrW, hdrH);
  }
  // シーンを描き終えたら、解決してトーンマップし、画面へ出す
  function hdrEnd() {
    if (!hdrReady || hdrFailed) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msFB);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, hdrFB);
    gl.blitFramebuffer(0, 0, hdrW, hdrH, 0, 0, hdrW, hdrH, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.bindBuffer(gl.ARRAY_BUFFER, postVB);
    gl.activeTexture(gl.TEXTURE0);

    // 滲み。リニアのまましきい値を切り、ぼかす (合成でシーンへ足す)
    if (bloomOn) {
      gl.viewport(0, 0, hbW, hbH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, hbFB[0]);
      gl.bindTexture(gl.TEXTURE_2D, hdrTex);
      gl.useProgram(hdrThreshP.pr);
      gl.uniform1i(hdrThreshP.u.uTex, 0);
      gl.uniform2f(hdrThreshP.u.uTexel, 1 / hdrW, 1 / hdrH);
      gl.uniform1f(hdrThreshP.u.uThresh, hdrThresh());
      postDraw(hdrThreshP);
      gl.useProgram(blurP.pr);
      gl.uniform1i(blurP.u.uTex, 0);
      for (let i = 0; i < 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, hbFB[1 - i]);
        gl.bindTexture(gl.TEXTURE_2D, hbTex[i]);
        if (i === 0) gl.uniform2f(blurP.u.uDir, 1 / hbW, 0);
        else gl.uniform2f(blurP.u.uDir, 0, 1 / hbH);
        postDraw(blurP);
      }
    }

    // 合成。シーン + 滲みをリニアで足してからトーンマップして画面へ
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, hdrW, hdrH);
    gl.useProgram(toneP.pr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hdrTex);
    gl.uniform1i(toneP.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, hbTex[0]);
    gl.uniform1i(toneP.u.uBloom, 1);
    gl.uniform1f(toneP.u.uAmount, bloomOn ? HDR_AMOUNT : 0);
    postDraw(toneP);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  // シーンを描き終えたあとに呼ぶ
  function bloomPass() {
    if (hdrOn) return;        // HDR 経路の滲みは hdrEnd がリニアで作る
    if (!bloomOn || !bloomTargets()) return;
    const w = bloomSrcW, h = bloomSrcH;

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.bindBuffer(gl.ARRAY_BUFFER, postVB);
    gl.activeTexture(gl.TEXTURE0);

    // 1) 画面をテクスチャへ取り込む
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, w, h);

    // 2) 明るいところを抜きながら 1/4 へ
    gl.viewport(0, 0, bloomW, bloomH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFB[0]);
    gl.useProgram(threshP.pr);
    gl.uniform1i(threshP.u.uTex, 0);
    gl.uniform2f(threshP.u.uTexel, 1 / w, 1 / h);
    // 明るい昼の空では、空そのものが 0.72 を超えて広い範囲が滲みに拾われる。
    // 目は明るい場面では露出を絞るので、空が丸ごと光るのはおかしい。
    // 空の明るさぶんしきい値を持ち上げ、太陽の芯だけを滲ませる
    gl.uniform1f(threshP.u.uThresh, Math.min(0.96, BLOOM_THRESH + skyDayF * 0.24));
    postDraw(threshP);

    // 3) 横 → 縦の順にぼかす (bloomFB[0] → [1] → [0])
    gl.useProgram(blurP.pr);
    gl.uniform1i(blurP.u.uTex, 0);
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFB[1 - i]);
      gl.bindTexture(gl.TEXTURE_2D, bloomTex[i]);
      if (i === 0) gl.uniform2f(blurP.u.uDir, 1 / bloomW, 0);
      else gl.uniform2f(blurP.u.uDir, 0, 1 / bloomH);
      postDraw(blurP);
    }

    // 4) 画面へ加算して戻す
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(addP.pr);
    gl.bindTexture(gl.TEXTURE_2D, bloomTex[0]);
    gl.uniform1i(addP.u.uTex, 0);
    gl.uniform1f(addP.u.uAmount, BLOOM_AMOUNT);
    postDraw(addP);

    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }
