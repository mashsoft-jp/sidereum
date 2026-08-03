
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

  // シーンを描き終えたあとに呼ぶ
  function bloomPass() {
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
    gl.uniform1f(threshP.u.uThresh, BLOOM_THRESH);
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
