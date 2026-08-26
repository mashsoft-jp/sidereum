  // ---------- 初回の導入 ----------
  // 銀河系を上から見た絵から寄っていき、太陽系まで来たところで初回ガイドを
  // 出す。初めて開いたときだけの演出で、共有リンク・ツアーで開いたときと
  // 視聴済みの人には流さない (条件は main.js)。
  //
  // 絵は shaders/intro.frag の描き絵を画面全体の三角形へアルファ合成で乗せる
  // だけ。シーンはその下で普通に描き続けているので、銀河が薄れるとそのまま
  // 本編の星空が出てくる。Bloom より前に重ねるので、中心のふくらみも滲む。
  // 時間の配り方: 3.7秒で銀河を抜けきり (滑らかな光が星に分かれ)、そこから
  // 1.4秒かけて薄れる。薄れきった 5.1秒の時点でカメラはまだ遠いので、
  // 最後の 1.3秒は太陽系へ寄っていく画がそのまま見える
  const INTRO_SEC = 6.4;       // 全体の長さ [s]
  const INTRO_CAM = 1.8;       // カメラが寄りはじめる [s]
  const INTRO_DIM = 3.7;       // 銀河が薄れはじめる [s]
  const INTRO_DIM_SEC = 1.4;   // 薄れきるまで [s]
  const INTRO_ZOOM = 8.0;      // 寄りの深さ (e^n 倍)
  const INTRO_ZOOM_SEC = 5.2;  // 寄りきるまで [s]
  const INTRO_DIST = 1400;    // カメラの出発点 (距離の上限)
  const INTRO_YAW = 0.55;     // 方位の振り出し [rad] (寄りながら戻す)
  const INTRO_AIM = [0.55, 0.16];   // 寄っていく先 = 太陽系のあたり (円盤座標)
  const introApp = document.getElementById("app");
  const INTRO_SKIP_EV = ["pointerdown", "keydown", "wheel", "touchstart"];
  let introOn = false;        // 流しているか
  let introT0 = 0;            // 開始時刻 [s]。最初に描けたフレームで入れる —
                              // 読み込みが長引いた端末で、時計だけ先に進んで
                              // 銀河をまるごと飛ばしてしまうのを防ぐ
  let introOnEnd = null;      // 終わったときに呼ぶもの
  let introDist = 0, introYaw = 0;     // 着地点 (開始時に控える)
  let introFade = 0, introZoom = 1, introSpin = 0;

  const introEase = (x) => {
    const u = Math.max(0, Math.min(1, x));
    return u * u * (3 - 2 * u);
  };
  // 途中で触られたらそこで畳む。初回だけとはいえ、止められない映像を
  // 見せられるのは困る
  function introSkip() { if (introOn) endIntro(); }

  function startIntro(onEnd) {
    // 動きを減らす設定の人には流さない (画面いっぱいが数秒動き続けるため)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    introOnEnd = onEnd;
    introOn = true;
    introT0 = 0;
    introDist = cam.distTgt;
    introYaw = cam.yawTgt;
    cam.dist = cam.distTgt = INTRO_DIST;
    cam.yaw = cam.yawTgt = introYaw - INTRO_YAW;
    introFade = 1; introZoom = 1; introSpin = 0;
    introApp.classList.add("introMode");
    ovl.style.opacity = "0";           // 天体の名前は銀河が薄れてから
    for (const ev of INTRO_SKIP_EV) addEventListener(ev, introSkip, { passive: true });
    return true;
  }

  function endIntro() {
    introOn = false;
    introFade = 0;
    cam.dist = cam.distTgt = introDist;
    cam.yaw = cam.yawTgt = introYaw;
    introApp.classList.remove("introMode");
    // 消えていた HUD がいきなり現れないよう、1回だけ浮かび上がらせる
    introApp.classList.add("introOut");
    setTimeout(() => introApp.classList.remove("introOut"), 1000);
    ovl.style.opacity = "";
    for (const ev of INTRO_SKIP_EV) removeEventListener(ev, introSkip);
    const f = introOnEnd; introOnEnd = null;
    if (f) f();
  }

  // カメラは緩和に任せず、決まった長さで着地させる。指数の緩和は近づくほど
  // 遅くなるので「いつ着いたか」が決められず、ガイドを出す合図に使えない
  function introStep(nowSec) {
    if (!introOn) return;
    if (!introT0) introT0 = nowSec;
    const t = nowSec - introT0;
    if (t >= INTRO_SEC) { endIntro(); return; }
    const e = introEase((t - INTRO_CAM) / (INTRO_SEC - INTRO_CAM));
    cam.dist = cam.distTgt = INTRO_DIST + (introDist - INTRO_DIST) * e;
    cam.yaw = cam.yawTgt = introYaw - INTRO_YAW * (1 - e);
    introFade = 1 - introEase((t - INTRO_DIM) / INTRO_DIM_SEC);
    ovl.style.opacity = String(1 - introFade);
    // 寄りは指数で進める (見た目の速さが一定になる)。出だしだけ溜める
    introZoom = Math.exp(INTRO_ZOOM * Math.pow(Math.min(1, t / INTRO_ZOOM_SEC), 1.2));
    introSpin = -0.35 - t * 0.014;
  }

  function drawIntro() {
    if (!introOn || introFade <= 0.002) return;
    gl.useProgram(introP.pr);
    gl.uniform2f(introP.u.uRes, glc.width, glc.height);
    gl.uniform1f(introP.u.uZoom, introZoom);
    gl.uniform1f(introP.u.uSpin, introSpin);
    gl.uniform1f(introP.u.uFade, introFade);
    gl.uniform2f(introP.u.uAim, INTRO_AIM[0], INTRO_AIM[1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, postVB);
    gl.enableVertexAttribArray(introP.a.aPos);
    gl.vertexAttribPointer(introP.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }
