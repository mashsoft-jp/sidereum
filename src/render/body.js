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
  const SCR = {
    P: new Float32Array(16),    // 射影
    A: new Float32Array(16),    // 汎用
    rx: new Float32Array(16), ry: new Float32Array(16), rot: new Float32Array(16),
    model: new Float32Array(16), mvp: new Float32Array(16),
    t: [0, 0, 0], tgt: [0, 0, 0],
    v: [0, 0, 0], v2: [0, 0, 0],
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

  function drawBody(b) {
    const r = bodyR(b);
    const model = bodyModel(b, r);
    const mvp = mMul(VP, model, SCR.mvp);
    const tx = texByKey.get(b.key);
    gl.bindTexture(gl.TEXTURE_2D, tx || noTex);
    gl.uniform1f(bodyP.u.uHasTex, tx ? 1 : 0);
    gl.uniformMatrix4fv(bodyP.u.uMVP, false, mvp);
    gl.uniformMatrix4fv(bodyP.u.uModel, false, model);
    gl.uniform1f(bodyP.u.uComet, b.comet ? 1 : 0);
    gl.uniform1f(bodyP.u.uType, b.type);
    gl.uniform3fv(bodyP.u.uColA, b.colA);
    gl.uniform3fv(bodyP.u.uColB, b.colB);
    gl.uniform3fv(bodyP.u.uColC, b.colC);
    gl.uniform3fv(bodyP.u.uRim, b.rim);
    gl.uniform4fv(bodyP.u.uParams, b.params);
    gl.drawElements(gl.TRIANGLES, sphere.idx.length, gl.UNSIGNED_SHORT, 0);
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

