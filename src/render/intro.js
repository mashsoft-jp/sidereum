  // ---------- 初回の導入 ----------
  // 太陽系をはるか外 (ヘリオポーズのあたり) から見せ、少し置いてから既定の
  // 位置まで寄る。着いたところで初回ガイドを出す。初めて開いたときだけの
  // 演出で、共有リンク・ツアーで開いたときと視聴済みの人には流さない
  // (条件は main.js)。
  //
  // 距離の上限 1400 world は、海王星軌道 (30.11 au = 340 world) の縮尺で
  // 124 au ≒ ヘリオポーズ。ちょうど太陽系ぜんぶが視野に収まる引きになる。
  const INTRO_SEC = 4.6;      // 寄り終える (着く) まで [s]
  const INTRO_HOLD = 1.0;     // 寄りはじめるまでの間 [s]
  const INTRO_LOGO_SEC = 0.75; // カメラ停止後、ロゴを縮める時間 [s]
  const INTRO_DIST = 1400;    // カメラの出発点 (距離の上限 = ヘリオポーズ付近)
  const INTRO_PITCH = 0.10;   // 出発時の俯角 [rad] (円盤を横から見る)
  const INTRO_YAW = 0.55;     // 方位の振り出し [rad] (寄りながら戻す)
  const introApp = document.getElementById("app");
  const INTRO_SKIP_EV = ["pointerdown", "keydown", "wheel", "touchstart"];
  let introOn = false;        // 流しているか
  let introT0 = 0;            // 開始時刻 [s]。最初に描けたフレームで入れる —
                              // 読み込みが長引いた端末で、時計だけ先に進んで
                              // 引きの画をまるごと飛ばしてしまうのを防ぐ
  let introOnEnd = null;      // ガイドを出すときに呼ぶもの
  let introShown = false;     // ガイドをもう出したか
  let introLogo = null;       // 導入中だけ中央に重ねるワードマーク
  let introLogoStart = null;
  let introBackdrop = null;
  let introDist = 0, introYaw = 0, introPitch = 0;   // 着地点 (開始時に控える)

  function introActive() { return introOn; }

  // 出だしは溜め、終わりはうんと粘る。等速で寄ると、見かけの大きさは
  // 距離の逆数で効くので最後だけ一気に膨らんで見える
  const introEase = (x) => {
    const u = Math.max(0, Math.min(1, x));
    return 1 - Math.pow(1 - u * u * (3 - 2 * u), 1.4);
  };
  // 途中で触られたらそこで畳む。初回だけとはいえ、止められない映像を
  // 見せられるのは困る
  function introSkip() { if (introOn) endIntro(); }

  function startIntro(onEnd) {
    // 動きを減らす設定の人には流さない (画面いっぱいが数秒動き続けるため)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    introOnEnd = onEnd;
    introOn = true;
    introShown = false;
    introT0 = 0;
    introLogoStart = null;
    introDist = cam.distTgt;
    introYaw = cam.yawTgt;
    introPitch = cam.pitchTgt;
    cam.dist = cam.distTgt = INTRO_DIST;
    cam.yaw = cam.yawTgt = introYaw - INTRO_YAW;
    cam.pitch = cam.pitchTgt = INTRO_PITCH;
    introApp.classList.add("introMode");
    introBackdrop = document.createElement("div");
    introBackdrop.id = "introBackdrop";
    introApp.appendChild(introBackdrop);
    welcomeEl.classList.remove("introLanded");
    welcomeEl.classList.add("introPrepare");
    introLogo = document.createElement("div");
    introLogo.id = "introLogo";
    introLogo.className = "logo";
    introLogo.textContent = "SIDEREUM";
    introApp.appendChild(introLogo);
    for (const ev of INTRO_SKIP_EV) addEventListener(ev, introSkip, { passive: true });
    return true;
  }

  // カメラ停止とロゴの縮小が終わってから HUD とガイドを出す。
  function revealIntro() {
    if (introShown) return;
    introShown = true;
    if (introLogo) { introLogo.remove(); introLogo = null; }
    if (introBackdrop) { introBackdrop.remove(); introBackdrop = null; }
    welcomeEl.classList.remove("introPrepare", "introDock");
    welcomeEl.classList.add("introLanded");
    introApp.classList.remove("introMode");
    // 消えていた HUD がいきなり現れないよう、1回だけ浮かび上がらせる
    introApp.classList.add("introOut");
    setTimeout(() => introApp.classList.remove("introOut"), 1000);
    // ここから先はガイドを操作する番なので、画面を触っても飛ばさない
    for (const ev of INTRO_SKIP_EV) removeEventListener(ev, introSkip);
    const f = introOnEnd; introOnEnd = null;
    if (f) f();
  }

  function endIntro() {
    introOn = false;
    cam.dist = cam.distTgt = introDist;
    cam.yaw = cam.yawTgt = introYaw;
    cam.pitch = cam.pitchTgt = introPitch;
    revealIntro();
  }

  // カメラは緩和に任せず、決まった長さで着地させる。指数の緩和は近づくほど
  // 遅くなるので「いつ着いたか」が決められず、ガイドを出す合図に使えない
  function introStep(nowSec) {
    if (!introOn) return;
    if (!introT0) introT0 = nowSec;
    const t = nowSec - introT0;
    // 方位の移動が始まる最初のフレームから0.5秒後に表示を始める。
    const fade = Math.max(0, Math.min(1, (t - 0.5) / 0.9));
    introLogo.style.opacity = String(fade);
    introBackdrop.style.opacity = String(fade);
    if (t >= INTRO_SEC + INTRO_LOGO_SEC) { endIntro(); return; }
    if (t >= INTRO_SEC) {
      // カメラを着地点に固定してから、中央のロゴだけを小さくする。
      cam.dist = cam.distTgt = introDist;
      cam.yaw = cam.yawTgt = introYaw;
      cam.pitch = cam.pitchTgt = introPitch;
      if (!introLogoStart) {
        const r = introLogo.getBoundingClientRect();
        introLogoStart = { x: r.x + r.width / 2, y: r.y + r.height / 2,
          size: parseFloat(getComputedStyle(introLogo).fontSize) };
        welcomeEl.classList.remove("introPrepare");
        welcomeEl.classList.add("introDock");
      }
      // 実際のダイアログを測り、縦持ち・横持ちでも見出しにぴたりと合わせる。
      const target = document.getElementById("welcomeLogo");
      const r = target.getBoundingClientRect(), appRect = introApp.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(target).fontSize);
      const u = (t - INTRO_SEC) / INTRO_LOGO_SEC, e = u * u * (3 - 2 * u);
      introLogo.style.left = (introLogoStart.x + (r.x + r.width / 2 - introLogoStart.x) * e - appRect.x) + "px";
      introLogo.style.top = (introLogoStart.y + (r.y + r.height / 2 - introLogoStart.y) * e - appRect.y) + "px";
      introLogo.style.fontSize = (introLogoStart.size + (size - introLogoStart.size) * e) + "px";
      introLogo.style.letterSpacing = (0.13 + 0.13 * e) + "em";
      introLogo.style.textShadow = "none";
      welcomeEl.style.setProperty("--introShade", String(0.72 * e));
      welcomeEl.style.setProperty("--introCard", String(e));
      return;
    }
    // 距離と俯角は間を置いてから動かす。方位だけは最初から一定の速さで
    // 回しておく — 止まった画で1秒待たされると、固まったように見える。
    // 距離は等比で詰める (log で線形)。等差だと見かけの大きさが距離の逆数で
    // 効くので、遠いあいだは何も起きず最後だけ一気に膨らむ画になる
    const e = introEase((t - INTRO_HOLD) / (INTRO_SEC - INTRO_HOLD));
    cam.dist = cam.distTgt = INTRO_DIST * Math.pow(introDist / INTRO_DIST, e);
    cam.pitch = cam.pitchTgt = INTRO_PITCH + (introPitch - INTRO_PITCH) * e;
    cam.yaw = cam.yawTgt = introYaw - INTRO_YAW * (1 - Math.min(1, t / INTRO_SEC));
  }
