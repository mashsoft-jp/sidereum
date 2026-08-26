  // ---------- 初回の導入 ----------
  // 太陽系をはるか外 (ヘリオポーズのあたり) から見せ、少し置いてから既定の
  // 位置まで寄る。着いたところで初回ガイドを出す。初めて開いたときだけの
  // 演出で、共有リンク・ツアーで開いたときと視聴済みの人には流さない
  // (条件は main.js)。
  //
  // 距離の上限 1400 world は、海王星軌道 (30.11 au = 340 world) の縮尺で
  // 124 au ≒ ヘリオポーズ。ちょうど太陽系ぜんぶが視野に収まる引きになる。
  const INTRO_SEC = 4.6;      // 全体の長さ [s]
  const INTRO_HOLD = 1.0;     // 寄りはじめるまでの間 [s]
  const INTRO_DIST = 1400;    // カメラの出発点 (距離の上限 = ヘリオポーズ付近)
  const INTRO_PITCH = 0.10;   // 出発時の俯角 [rad] (円盤を横から見る)
  const INTRO_YAW = 0.55;     // 方位の振り出し [rad] (寄りながら戻す)
  const introApp = document.getElementById("app");
  const INTRO_SKIP_EV = ["pointerdown", "keydown", "wheel", "touchstart"];
  let introOn = false;        // 流しているか
  let introT0 = 0;            // 開始時刻 [s]。最初に描けたフレームで入れる —
                              // 読み込みが長引いた端末で、時計だけ先に進んで
                              // 引きの画をまるごと飛ばしてしまうのを防ぐ
  let introOnEnd = null;      // 終わったときに呼ぶもの
  let introDist = 0, introYaw = 0, introPitch = 0;   // 着地点 (開始時に控える)

  function introActive() { return introOn; }

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
    introPitch = cam.pitchTgt;
    cam.dist = cam.distTgt = INTRO_DIST;
    cam.yaw = cam.yawTgt = introYaw - INTRO_YAW;
    cam.pitch = cam.pitchTgt = INTRO_PITCH;
    introApp.classList.add("introMode");
    for (const ev of INTRO_SKIP_EV) addEventListener(ev, introSkip, { passive: true });
    return true;
  }

  function endIntro() {
    introOn = false;
    cam.dist = cam.distTgt = introDist;
    cam.yaw = cam.yawTgt = introYaw;
    cam.pitch = cam.pitchTgt = introPitch;
    introApp.classList.remove("introMode");
    // 消えていた HUD がいきなり現れないよう、1回だけ浮かび上がらせる
    introApp.classList.add("introOut");
    setTimeout(() => introApp.classList.remove("introOut"), 1000);
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
    // 距離と俯角は間を置いてから動かす。方位だけは最初から一定の速さで
    // 回しておく — 止まった画で1秒待たされると、固まったように見える
    const e = introEase((t - INTRO_HOLD) / (INTRO_SEC - INTRO_HOLD));
    cam.dist = cam.distTgt = INTRO_DIST + (introDist - INTRO_DIST) * e;
    cam.pitch = cam.pitchTgt = INTRO_PITCH + (introPitch - INTRO_PITCH) * e;
    cam.yaw = cam.yawTgt = introYaw - INTRO_YAW * (1 - t / INTRO_SEC);
  }
