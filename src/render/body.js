  // ---------- リサイズ ----------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const appEl = document.getElementById("app");
    W = appEl.clientWidth || window.innerWidth || 1;
    H = appEl.clientHeight || window.innerHeight || 1;
    glc.width = W * DPR; glc.height = H * DPR;
    ovl.width = W * DPR; ovl.height = H * DPR;
    gl.viewport(0, 0, W * DPR, H * DPR);
  }
  window.addEventListener("resize", resize);
  // iOS の PWA (standalone) は回転時に resize イベントが発火しない (または
  // 寸法確定前に発火する) ことがあり、キャンバスのバッファ寸法と表示寸法が
  // ずれて描画が縦に伸縮する。#app の実寸変化を直接監視して追従させる
  if (window.ResizeObserver) {
    new ResizeObserver(() => { resize(); positionInfoPanel(); })
      .observe(document.getElementById("app"));
  }
  resize();

  // ---------- 描画 ----------
  let VP = mIdent(), Vm = mIdent();
  let EYE = [0, 0, 0];          // カメラ位置 (描画はカメラ相対座標で行う)
  const screenPos = new Map();  // key -> {x, y, r, w}

  // 毎フレームの行列・ベクトルはスクラッチを使い回す (GC 停止対策)
  const ZERO3 = [0, 0, 0], UP3 = [0, 1, 0];
  const NO_OBL = [1, 1, 1];   // 扁平を持たない天体 (真球) 用
  const SCR = {
    P: new Float32Array(16),    // 射影
    A: new Float32Array(16),    // 汎用
    rx: new Float32Array(16), ry: new Float32Array(16), rot: new Float32Array(16),
    model: new Float32Array(16), mvp: new Float32Array(16),
    // 大気シェル用 (本体を全部描いたあとに使うので、本体側と別に持つ)
    airModel: new Float32Array(16), airMvp: new Float32Array(16),
    air64: new Float64Array(16), airSun: [0, 0, 0],
    t: [0, 0, 0], tgt: [0, 0, 0],
    v: [0, 0, 0], v2: [0, 0, 0],
    sun: [0, 0, 0],             // bodyRenderer.draw へ渡す光源位置
    // 食の遮蔽体 (描画中の座標系へ移したもの)。毎フレーム作り直さず使い回す
    ecl: { c: [0, 0, 0], r: 0, sunAng: 0, col: null },
  };

  function bodyModel(b, r) {
    const spin = b.rot ? 2 * Math.PI * simDays / b.rot + (b.spin0 || 0) : 0;
    // 土星は環との整合のため実際の極方向 (SATURN_POLE_W) を使う。他は
    // ワールドX軸まわりの傾斜で近似 (傾斜角のみ正確、軸の方位は簡略)
    if (b.key === "saturn") {
      mRotY(spin, SCR.ry);
      mMul(SAT_ROT, SCR.ry, SCR.rot);
    } else {
      mRotX(-(b.tilt || 0) * DEG, SCR.rx);
      mRotY(spin, SCR.ry);
      mMul(SCR.rx, SCR.ry, SCR.rot);
    }
    // 平行移動はカメラ相対 (float64 で差を取ってから f32 化することで震えを防ぐ)
    const t = posW.get(b.key);
    SCR.t[0] = t[0] - EYE[0]; SCR.t[1] = t[1] - EYE[1]; SCR.t[2] = t[2] - EYE[2];
    return mTRS(SCR.t, SCR.rot, r, SCR.model);
  }

  // ---------- 天体レンダラ ----------
  // 夜側の明るさ。点にしか見えない遠くの天体は、真っ暗にすると細い時期に
  // 見失うので明るく保つ。円盤として分解できる大きさになったら暗くして、
  // 月や金星の満ち欠けがはっきり出るようにする。
  // ただし下限は 0 に落とさない — 探査機視点のように天体が画面いっぱいになる
  // 場面で、影側が真っ黒だと画面ごと沈んでしまう
  // 返す値は「画面上でどれくらいの明るさに見せたいか」なので、シェーダへ渡す
  // 前にリニアへ直す (照明の計算はリニアで行う)
  function nightAmbient(b, radiusPx) {
    const v = b.comet
      ? 0.15                               // 彗星核は宇宙空間らしく常に暗い
      : (() => {
          const t = Math.min(1, Math.max(0, ((radiusPx || 0) - 3) / 14));
          return 0.30 - 0.21 * (t * t * (3 - 2 * t));
        })();
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  // WebGL のプログラムと uniform はグローバルな状態なので、設定漏れがあると
  // 直前の描画の値がそのまま残る (実際に uComet の設定漏れで、地上ビューの
  // 全天体が彗星核として描かれうる状態になっていた)。
  //
  // そこで prog をクロージャに閉じ込め、この関数の外から uniform を触れなく
  // する。draw() は呼ばれるたびに天体単位の uniform を「すべて」設定する。
  // どれか1つでも省くと同じ種類のバグが再発するため、条件分岐で飛ばさない。
  //
  // 宇宙ビューと地上ビューでは座標系・モデル行列の作り方・カリング・深度の
  // 扱いが異なるので、パス単位 (beginPass) と天体単位 (draw) を分けている。
  // モデル行列の生成と地上ビューの深度クリアは呼び出し側に残す。
  function createBodyRenderer(prog) {
    const { pr, u, a } = prog;
    let inPass = false;
    // 大気シェルは深度書き込みとカリングを一時的に変えるので、パスの設定を控える
    let passDepthWrite = true, passCull = null;
    return {
      // program・バッファ・頂点属性・テクスチャユニット・depth/cull を確定させる。
      // cullFace は gl.FRONT / gl.BACK、不要なら null
      // airSun / airDay は地上ビューのエアライト用。宇宙ビューは airDay = 0
      beginPass({ time, cameraPosition, cullFace = null, depthTest = true, depthWrite = true,
                  airSun = null, airDay = 0 }) {
        if (inPass) throw new Error("bodyRenderer: beginPass が入れ子になっています");
        inPass = true;
        gl.useProgram(pr);
        gl.uniform1f(u.uAirDay, airDay);
        gl.uniform3f(u.uAirSun, airSun ? airSun[0] : 0, airSun ? airSun[1] : 1, airSun ? airSun[2] : 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereVB);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereIB);
        gl.enableVertexAttribArray(a.aPos);
        gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 0, 0);
        // 天体テクスチャだけがユニット0で入れ替わる。環のプロファイルと
        // 地球の雲・夜景はパスの間ずっと同じなので 1〜3 に据え置く
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ringTex);
        gl.uniform1i(u.uRing, 1);
        gl.uniform2f(u.uRingR, RING_IN, 1.0 / (RING_OUT - RING_IN));
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, cloudTex);
        gl.uniform1i(u.uCloud, 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, nightTex);
        gl.uniform1i(u.uNight, 3);
        gl.uniform1i(u.uNrm, 4);   // ユニット4 は天体ごとに draw() が差し替える
        // 雲は地表と別に、1日あたり 0.7° ほど東へ流す (偏西風のゆるい見立て)。
        // 実時間ではなく暦の時刻で決めるので、停止中は雲も止まる
        gl.uniform1f(u.uCloudRot, simDays * 0.0019 - Math.floor(simDays * 0.0019));
        // 黒点の世代。f32 で桁が落ちない範囲へ畳んでおく (238日周期で群が一巡)
        gl.uniform1f(u.uSunT, simDays - Math.floor(simDays / 238) * 238);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(u.uTex, 0);
        gl.uniform1f(u.uTime, time);
        gl.uniform3f(u.uCam, cameraPosition[0], cameraPosition[1], cameraPosition[2]);
        if (depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
        passDepthWrite = !!depthWrite;
        gl.depthMask(passDepthWrite);
        passCull = cullFace;
        if (cullFace !== null) { gl.enable(gl.CULL_FACE); gl.cullFace(cullFace); }
        else gl.disable(gl.CULL_FACE);
      },
      // 大気シェル。本体より一回り大きい球を加算で重ね、円盤の外へはみ出す光の
      // 輪を出す。本体をすべて描き終えてから呼ぶ (深度は書かない)。
      // model は本体の (1 + body.air) 倍にスケールしたもの
      drawAtmos({ body, model, mvp, sunPosition }) {
        if (!inPass) throw new Error("bodyRenderer: beginPass より前に drawAtmos が呼ばれました");
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        // シェルは手前側の半球だけ描く。この球の巻き方向では FRONT を落とすと
        // 観測者側が残る (地上ビューの本体描画と同じ)
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        gl.uniform1f(u.uAtmos, 1);
        gl.uniform1f(u.uAtmosT, body.air);
        gl.uniformMatrix4fv(u.uMVP, false, mvp);
        gl.uniformMatrix4fv(u.uModel, false, model);
        gl.uniform3f(u.uSun, sunPosition[0], sunPosition[1], sunPosition[2]);
        gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
        // パスの状態へ戻す。ここを戻し忘れると後続の天体が透けたり消えたりする
        gl.uniform1f(u.uAtmos, 0);
        gl.disable(gl.BLEND);
        gl.depthMask(passDepthWrite);
        if (passCull !== null) gl.cullFace(passCull); else gl.disable(gl.CULL_FACE);
      },
      // sunPosition は方向ではなく「シェーダが使う座標系での光源位置」。
      // 宇宙ビューは全天体で同一 (カメラ相対の太陽位置)、地上ビューは天体ごとに
      // 「天体 → 実際の太陽」方向を遠方光源の位置として渡す
      // radiusPx = 画面上の見かけの半径。夜側の明るさ (満ち欠けの見え方) を決める
      // eclipse = 太陽面を隠している天体 {c, r, sunAng, col}。無ければ null
      draw({ body, model, mvp, sunPosition, radiusPx, eclipse }) {
        if (!inPass) throw new Error("bodyRenderer: beginPass より前に draw が呼ばれました");
        const tx = texByKey.get(body.key);
        // 法線図を持つ天体だけユニット4を差し替える。持たない天体でも
        // 「持っていない」ことを毎回伝える (前の天体の値を引き継がせない)
        const nx = nrmByKey.get(body.key);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, nx || noTex);
        gl.uniform1f(u.uNrmAmt, nx ? body.nrm : 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tx || noTex);
        gl.uniform1f(u.uHasTex, tx ? 1 : 0);
        gl.uniform1f(u.uAmb, nightAmbient(body, radiusPx));
        gl.uniformMatrix4fv(u.uMVP, false, mvp);
        gl.uniformMatrix4fv(u.uModel, false, model);
        gl.uniform3f(u.uSun, sunPosition[0], sunPosition[1], sunPosition[2]);
        gl.uniform1f(u.uComet, body.comet ? 1 : 0);
        // 扁平は天体ごと。真球は 1,1,1 (条件分岐で省くと前の天体の値が残る)
        gl.uniform3fv(u.uOblate, body.obl || NO_OBL);
        gl.uniform1f(u.uRingOn, body.ring ? 1 : 0);
        // 食。遮蔽体が無いフレームでも「無い」ことを毎回伝える (前の天体の
        // 影を引きずると、関係のない天体が暗くなる)
        const ec = eclipse || null;
        gl.uniform3f(u.uEclC, ec ? ec.c[0] : 0, ec ? ec.c[1] : 0, ec ? ec.c[2] : 0);
        gl.uniform2f(u.uEclR, ec ? ec.r : 0, ec ? ec.sunAng : 1);
        gl.uniform3fv(u.uEclCol, ec ? ec.col : ZERO3);
        gl.uniform1f(u.uAtmos, 0);      // 直前が大気シェルでも本体として描く
        gl.uniform1f(u.uType, body.type);
        // 色はリニアに直したもの (bodies.js で一度だけ変換済み) を渡す。
        // シェーダ側で毎画素 pow を回さないため
        gl.uniform3fv(u.uColA, body.colAL);
        gl.uniform3fv(u.uColB, body.colBL);
        gl.uniform3fv(u.uColC, body.colCL);
        gl.uniform3fv(u.uRim, body.rimL);
        gl.uniform4fv(u.uParams, body.params);
        gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
      },
      endPass() {
        inPass = false;
        gl.disable(gl.CULL_FACE);
      },
    };
  }

  // 宇宙ビュー用。モデル行列を作って1天体を描く (パスは呼び出し側で開く)
  function drawBody(b, sunPosition) {
    const r = bodyR(b);
    const model = bodyModel(b, r);              // SCR.t にカメラ相対位置が入る
    const d = Math.hypot(SCR.t[0], SCR.t[1], SCR.t[2]) || 1;
    const radiusPx = r / d * (H / 2) / Math.tan(eFov() / 2);
    // 遮蔽体もカメラ相対へ (f64 で差を取ってから f32 化するのは天体本体と同じ)
    const e = eclipseFor(b);
    let eclipse = null;
    if (e) {
      SCR.ecl.c[0] = e.cw[0] - EYE[0];
      SCR.ecl.c[1] = e.cw[1] - EYE[1];
      SCR.ecl.c[2] = e.cw[2] - EYE[2];
      SCR.ecl.r = e.r; SCR.ecl.sunAng = e.sunAng; SCR.ecl.col = e.col;
      eclipse = SCR.ecl;
    }
    bodyRenderer.draw({ body: b, model, mvp: mMul(VP, model, SCR.mvp), sunPosition, radiusPx, eclipse });
  }

  // 宇宙ビュー用。大気を持つ天体のシェルを1つ描く (本体をすべて描いたあとに呼ぶ)
  function drawBodyAtmos(b, sunPosition) {
    const model = bodyModel(b, bodyR(b) * (1 + b.air));
    bodyRenderer.drawAtmos({ body: b, model, mvp: mMul(VP, model, SCR.mvp), sunPosition });
  }

  function project(w) {
    const wx = w[0] - EYE[0], wy = w[1] - EYE[1], wz = w[2] - EYE[2];
    const x = VP[0]*wx + VP[4]*wy + VP[8]*wz + VP[12];
    const y = VP[1]*wx + VP[5]*wy + VP[9]*wz + VP[13];
    const cw = VP[3]*wx + VP[7]*wy + VP[11]*wz + VP[15];
    // 微小天体への接近時は cw が 0.01 を大きく下回る。背面判定は符号だけで行う
    if (cw <= 1e-9) return null;
    return { x: (x / cw * 0.5 + 0.5) * W, y: (1 - (y / cw * 0.5 + 0.5)) * H, w: cw };
  }

