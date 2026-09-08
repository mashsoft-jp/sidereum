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

  // Megrim の実際の輪郭を、中心線に沿って進むマスクで描く。
  // 輪郭は src/fonts と同じ Daniel Johnson の Megrim (OFL 1.1)。
  const INTRO_GLYPHS = {"S":[561,"M78 527Q78 624 127.0 667.0Q176 710 286 710Q363 710 410.0 670.0Q457 630 478 548L385 478H336L444 559Q423 626 383.5 653.0Q344 680 286 680Q246 680 218.5 675.0Q191 670 163.5 655.5Q136 641 122.0 609.0Q108 577 108 527Q108 483 148.5 449.0Q189 415 247.0 391.0Q305 367 363.5 342.0Q422 317 462.5 278.0Q503 239 503 188Q503 88 453.5 39.0Q404 -10 284 -10Q186 -10 130.0 29.5Q74 69 53 152L81 164Q101 83 149.5 51.5Q198 20 284 20Q380 20 426.5 57.0Q473 94 473 188Q473 232 432.5 266.0Q392 300 333.5 324.0Q275 348 217.0 373.0Q159 398 118.5 437.0Q78 476 78 527Z","M360 478 L461 554 Q423 695 286 695 Q93 695 93 527 C93 360 488 359 488 188 Q488 5 284 5 Q112 5 67 158"],"I":[228,"M129 0H99V700H129Z","M114 700 V0"],"D":[593,"M195 0H99V700H195Q339 700 439.0 594.0Q539 488 539.0 350.0Q539 212 439.0 106.0Q339 0 195 0ZM195 30Q326 30 417.5 126.5Q509 223 509.0 350.0Q509 477 417.5 573.5Q326 670 195 670H129V30Z","M114 0 V685 H195 Q332 685 428 586 Q524 487 524 350 Q524 213 428 114 Q332 15 195 15 H114"],"E":[576,"M458 366H161L467 670H129V30H517V0H99V700H540L234 396H458Z","M517 15 H114 V685 H503 L197 381 H458"],"R":[550,"M177 30H453L332 362L388 394Q457 432 457 515Q457 670 221 670H129V0H99V700H221Q353 700 420.0 651.5Q487 603 487 515Q487 415 403 368L369 349L496 0H177Z","M114 0 V685 H221 Q472 685 472 515 Q472 422 396 381 L350 356 L475 15 H177"],"U":[646,"M173 700H556V301Q556 141 501.0 65.5Q446 -10 323.0 -10.0Q200 -10 145.0 65.5Q90 141 90 301V700H120V301Q120 218 134.0 161.5Q148 105 176.0 75.0Q204 45 239.0 32.5Q274 20 323.0 20.0Q372 20 407.0 32.5Q442 45 470.0 75.0Q498 105 512.0 161.5Q526 218 526 301V670H173Z","M105 700 V301 Q105 5 323 5 Q541 5 541 301 V685 H173"],"M":[708,"M185 30H579V629L354 147L129 630V0L99 1V701H129L354 218L579 700L609 701V0L185 1Z","M114 0 V685 L354 182 L594 685 V15 H185"]};
  let introTraces = [];
  function buildIntroTrace() {
    introLogo.setAttribute("aria-label", "SIDEREUM");
    introLogo.innerHTML = Array.from("SIDEREUM", (c, i) => {
      const [w, outline, trace] = INTRO_GLYPHS[c];
      return `<svg aria-hidden="true" viewBox="0 -940 ${w} 1200" style="width:${w / 1000}em" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><mask id="introInk${i}" maskUnits="userSpaceOnUse" x="0" y="-60" width="${w}" height="820"><path class="introTrace" d="${trace}" fill="none" stroke="white" stroke-width="90" stroke-linecap="round" stroke-linejoin="round"/></mask></defs>` +
        `<g transform="scale(1,-1)"><path d="${outline}" fill="currentColor" mask="url(#introInk${i})"/></g>` +
        `<circle class="introPen" r="19" fill="#fff1ca" opacity="0"/></svg>`;
    }).join("");
    introTraces = Array.from(introLogo.querySelectorAll("svg"), svg => {
      const path = svg.querySelector(".introTrace"), pen = svg.querySelector(".introPen");
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = String(length);
      return {path, pen, length};
    });
  }
  function drawIntroTrace(t) {
    introTraces.forEach(({path, pen, length}, i) => {
      // 少しずつ重ねて左から右へ描き、到着前に全ての文字を書き終える。
      const u = Math.max(0, Math.min(1, (t - 2 - i * 0.17) / 0.85));
      path.style.strokeDashoffset = String(length * (1 - u));
      path.style.opacity = u > 0 ? "1" : "0";
      const point = path.getPointAtLength(length * u);
      pen.setAttribute("cx", point.x); pen.setAttribute("cy", -point.y);
      pen.setAttribute("opacity", u > 0 && u < 1 ? Math.min(1, u * 12, (1 - u) * 12) : 0);
    });
  }

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
    buildIntroTrace();
    introApp.appendChild(introLogo);
    for (const ev of INTRO_SKIP_EV) addEventListener(ev, introSkip, { passive: true });
    return true;
  }

  // カメラ停止とロゴの縮小が終わってから HUD とガイドを出す。
  function revealIntro() {
    if (introShown) return;
    introShown = true;
    introTraces = [];
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
    // 方位の移動が始まる最初のフレームから2秒後に表示を始める。
    const fade = Math.max(0, Math.min(1, (t - 2.0) / 0.9));
    introLogo.style.opacity = t >= 2 ? "1" : "0";
    drawIntroTrace(t);
    introBackdrop.style.opacity = String(fade);
    if (t >= INTRO_SEC + INTRO_LOGO_SEC) { endIntro(); return; }
    if (t >= INTRO_SEC) {
      // カメラを着地点に固定してから、中央のロゴだけを小さくする。
      cam.dist = cam.distTgt = introDist;
      cam.yaw = cam.yawTgt = introYaw;
      cam.pitch = cam.pitchTgt = introPitch;
      if (!introLogoStart) {
        // 描き終えた輪郭を同じフォントの文字へ引き継ぎ、既存の着地処理へ。
        introLogo.textContent = "SIDEREUM";
        introTraces = [];
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
