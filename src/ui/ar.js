  // ---------- AR モード (端末を空へ向けて、その向きの空を見る) ----------
  // 地上ビュー (地球) の一形態。端末の姿勢センサー (deviceorientation) から視線と
  // 画面の上の向きを取り、gAz/gAlt の代わりにこの2本のベクトルでビュー行列を作る
  // (renderGround)。端末を傾けたロールもそのまま画に出る。
  //
  // 座標系は3つ通る:
  //   端末:  x 右, y 上 (画面の上端), z 画面の手前  — センサーの回転はこれを回す
  //   地球:  x 東, y 北, z 天頂                      — deviceorientation の基準系
  //   地平:  x 東, y 天頂, z 南 (= −北)              — azAltDir と同じ。描画はこれ
  // iOS の alpha は真北ではなく起動時の向きが基準なので、webkitCompassHeading
  // (真北からの方位) との差を arHeadOff に持って地球系で回して合わせる。
  // Android (deviceorientationabsolute) は最初から真北基準なので差は 0。
  let arActive = false;
  let arPending = false;                       // 「タップして開始」を出して権限の要求を待っている
  let arHave = false;                          // 姿勢イベントを1回以上受け取った
  const arFwdT = [0, 0, -1], arUpT = [0, 1, 0]; // センサーの最新値 (目標)
  const arFwd = [0, 0, -1], arUp = [0, 1, 0];   // 緩和後 (描画に使う)
  let arAzOff = 0;        // 方位の手動補正 [rad]。コンパスのずれを、星を実際の位置へドラッグして直す
  let arHeadOff = 0;      // iOS: alpha の基準 → 真北の補正 [rad]
  let arHeadHave = false;
  let arAbs = false;      // 絶対方位のイベント (deviceorientationabsolute) を聞いている
  let arRel = false;      // 方位の基準が取れない端末 (相対の姿勢だけ。方位は手で合わせる)
  let arSaved = null;     // 入る前の再生状態 (速度・再生)。出るときに戻す
  let arWake = null;      // 画面を消灯させない (Screen Wake Lock)
  let arWaitTimer = 0;
  let arCalShown = "";
  // 対応の目安: タッチ端末か、iOS の権限 API がある (iPad + ポインタも拾う)。
  // デスクトップの Chrome にも DeviceOrientationEvent はあるがイベントは来ないので、
  // それだけで出すと「押しても何も起きないボタン」になる
  const arSupported = "DeviceOrientationEvent" in window &&
    (matchMedia("(hover: none) and (pointer: coarse)").matches ||
     typeof DeviceOrientationEvent.requestPermission === "function");
  const vmARBtn = document.getElementById("vmAR");
  const vmAROpt = vmSelect.querySelector('option[value="ar"]');
  const arCalEl = document.getElementById("arCal");
  const arStartEl = document.getElementById("arStart");
  if (!arSupported) { vmARBtn.remove(); vmAROpt.remove(); }
  else document.getElementById("app").classList.add("arReady");

  function screenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === "number") return screen.orientation.angle;
    return typeof window.orientation === "number" ? window.orientation : 0;
  }
  // 角度の折り返し wrapPi は ui/tour.js のものを使う (実行時にしか呼ばないので連結順は問わない)
  function arOnOrient(e) {
    if (e.alpha == null || e.beta == null || e.gamma == null) {
      // 絶対方位を出せない端末 (磁気センサー無し) は相対の姿勢へ落とす
      if (arAbs) {
        window.removeEventListener("deviceorientationabsolute", arOnOrient);
        window.addEventListener("deviceorientation", arOnOrient);
        arAbs = false;
      }
      return;
    }
    const a = e.alpha * DEG, b = e.beta * DEG, g = e.gamma * DEG;
    const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b);
    const cG = Math.cos(g), sG = Math.sin(g);
    // R = Rz(α)·Rx(β)·Ry(γ) (W3C の定義)。端末座標 → 地球座標。列が端末の各軸の向き
    const xE = cA*cG - sA*sB*sG, xN = cG*sA + cA*sB*sG, xU = -cB*sG;   // 端末 x (右)
    const yE = -cB*sA,           yN = cA*cB,            yU = sB;       // 端末 y (上端)
    const zE = cG*sA*sB + cA*sG, zN = sA*sG - cA*cG*sB, zU = cB*cG;    // 端末 z (手前)
    // 方位の基準: iOS はコンパスの向き (真北基準) と、行列が言う「端末の向いている方」
    // の差を補正にする。向いている方は 上端 + 裏 の水平成分 — 寝かせていれば上端、
    // 立てていれば裏 (カメラ) が水平に出て、そのあいだも途切れない
    const absolute = arAbs || e.absolute === true;
    if (!absolute && typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
      const pE = yE - zE, pN = yN - zN;
      if (pE * pE + pN * pN > 0.01) {
        const d = wrapPi(e.webkitCompassHeading * DEG - Math.atan2(pE, pN));
        if (!arHeadHave) { arHeadOff = d; arHeadHave = true; }
        else arHeadOff += wrapPi(d - arHeadOff) * 0.05;   // コンパスは震えるので遅い緩和
      }
    } else if (!absolute && !arRel) {
      arRel = true;   // 方位の基準が無い。案内を差し替える
      updateHint();
    }
    // 画面の向き (横持ち): 画面の上 = 端末座標で (sin θ, cos θ, 0)。θ=90 は端末を
    // 反時計回りに倒して上端が左へ行った姿勢で、そのとき画面の上は端末の右端 (+x)
    const so = screenAngle() * DEG, cs = Math.cos(so), ss = Math.sin(so);
    let uE = ss * xE + cs * yE, uN = ss * xN + cs * yN;
    const uU = ss * xU + cs * yU;
    let fE = -zE, fN = -zN;            // 視線 = 端末の裏
    const fU = -zU;
    // 方位の補正: 地球系で天頂まわりに時計回り (北 → 東) に回す
    const rot = arHeadOff + arAzOff, cr = Math.cos(rot), sr = Math.sin(rot);
    let t = fE * cr + fN * sr; fN = -fE * sr + fN * cr; fE = t;
    t = uE * cr + uN * sr; uN = -uE * sr + uN * cr; uE = t;
    // 地球系 (東, 北, 天頂) → 地平系 (東, 天頂, −北)
    arFwdT[0] = fE; arFwdT[1] = fU; arFwdT[2] = -fN;
    arUpT[0] = uE; arUpT[1] = uU; arUpT[2] = -uN;
    if (!arHave) {   // 最初の1回は緩和せず即時に採る (既定の向きから回ってくる動きを見せない)
      arFwd[0] = fE; arFwd[1] = fU; arFwd[2] = -fN;
      arUp[0] = uE; arUp[1] = uU; arUp[2] = -uN;
    }
    arHave = true;
  }
  // 毎フレーム: センサー値へ緩和で寄せ、方位・高度へ写す (frame.js のカメラ緩和の直後)
  function arStep() {
    if (!arActive || !arHave) return;
    const k = 0.45;   // 地上ビューの緩和より速く追従させる (手の動きに遅れると酔う)
    for (let i = 0; i < 3; i++) {
      arFwd[i] += (arFwdT[i] - arFwd[i]) * k;
      arUp[i] += (arUpT[i] - arUp[i]) * k;
    }
    let l = Math.hypot(arFwd[0], arFwd[1], arFwd[2]);
    if (l < 1e-3) { arFwd[0] = arFwdT[0]; arFwd[1] = arFwdT[1]; arFwd[2] = arFwdT[2]; l = 1; }
    arFwd[0] /= l; arFwd[1] /= l; arFwd[2] /= l;
    const dot = arUp[0]*arFwd[0] + arUp[1]*arFwd[1] + arUp[2]*arFwd[2];
    arUp[0] -= dot * arFwd[0]; arUp[1] -= dot * arFwd[1]; arUp[2] -= dot * arFwd[2];
    l = Math.hypot(arUp[0], arUp[1], arUp[2]);
    if (l < 1e-3) { arUp[0] = arUpT[0]; arUp[1] = arUpT[1]; arUp[2] = arUpT[2]; l = 1; }
    arUp[0] /= l; arUp[1] /= l; arUp[2] /= l;
    // 方位・高度 (オーバーレイの目盛り・流星の視野・共有 URL が読む)。方位は連続に
    gAz += wrapPi(Math.atan2(arFwd[0], -arFwd[2]) - gAz);
    gAzTgt = gAz;
    gAlt = gAltTgt = Math.asin(Math.max(-1, Math.min(1, arFwd[1])));
    gTrack = false;   // 追尾は向きを変えられないので常に切る (矢印で場所を示す)
    // 方位補正の表示 (0 のときは出さない)
    const deg = Math.round(arAzOff / DEG);
    const s = deg === 0 ? "" : T().arCal((deg > 0 ? "+" : "") + deg + "°");
    if (s !== arCalShown) {
      arCalShown = s;
      arCalEl.hidden = !s;
      if (s) arCalEl.textContent = s;
    }
  }
  function arAdjustAz(dRad) { arAzOff = wrapPi(arAzOff + dRad); }
  arCalEl.addEventListener("click", () => { arAzOff = 0; });

  function arNotice(msg) {
    hint.textContent = msg;
    hint.classList.remove("fade");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, 9000);
  }
  function setRate(dps) {
    daysPerSec = dps;
    speedInput.value = Math.max(0, Math.min(100, Math.round(18 * Math.log(dps * 86400) / Math.log(60))));
    speedVal.textContent = fmtRate(dps);
  }
  async function arWakeOn() {
    try {
      if (!navigator.wakeLock || arWake) return;
      arWake = await navigator.wakeLock.request("screen");
      arWake.addEventListener("release", () => { arWake = null; });
    } catch (e) { /* 電池残量など。消灯するだけ */ }
  }
  function arWakeOff() {
    if (arWake) { arWake.release().catch(() => {}); arWake = null; }
  }
  document.addEventListener("visibilitychange", () => {
    if (arActive && document.visibilityState === "visible") arWakeOn();
  });

  function enterAR() {
    if (!arSupported || arActive) return;
    if (typeof DeviceOrientationEvent.requestPermission !== "function") { arStart(); return; }
    // iOS 13+ は利用者の操作 (click / touchend) の中で同期的に権限を求める必要がある。
    // 狭い画面のビュー切替は <select> で、その change は Safari が操作とみなさない
    // (NotAllowedError で弾かれ、iPhone では AR に入れなかった)。操作が生きていなければ
    // 「タップして開始」のボタンを出し、その click で求める
    if (navigator.userActivation && !navigator.userActivation.isActive) { arAskStart(); return; }
    arRequest();
  }
  function arRequest() {
    let p;
    try { p = DeviceOrientationEvent.requestPermission(); } catch (e) { arAskStart(); return; }
    p.then((r) => { if (r === "granted") arStart(); else arFail(T().arDenied); },
           () => arAskStart());   // 操作の外で呼んだ NotAllowedError → ボタンで取り直す
  }
  function arAskStart() {
    if (arActive) return;
    arPending = true;
    if (!groundView || surfaceBody !== "earth") enterSurface("earth");
    arStartEl.innerHTML = T().arStartBtn + "<small>" + T().arStartNote + "</small>";
    arStartEl.hidden = false;
    syncViewModeUI();   // 切替の表示は AR のまま (待っているあいだに地上へ戻さない)
  }
  arStartEl.addEventListener("click", arRequest);
  function arStart() {
    arActive = true;
    arPending = false;
    arStartEl.hidden = true;
    arHave = false; arHeadHave = false; arHeadOff = 0; arRel = false; arAzOff = 0;
    if (!groundView || surfaceBody !== "earth") enterSurface("earth");
    document.getElementById("app").classList.add("arMode");
    // いまの空を見るのが目的なので実時間に合わせる。速度が実時間でないと星が流れる。
    // 入る前の再生状態は控えて、出るときに戻す
    arSaved = { daysPerSec, playing };
    simDays = (Date.now() - J2000) / DAY_MS;
    clockEdits++;
    setRate(1 / 86400);
    setPlaying(true);
    // 深いズームのままでは手ぶれで見られない
    if (gFov < 20 * DEG) gFov = gFovTgt = 60 * DEG;
    gTrack = false;
    arAbs = "ondeviceorientationabsolute" in window;
    window.addEventListener(arAbs ? "deviceorientationabsolute" : "deviceorientation", arOnOrient);
    clearTimeout(arWaitTimer);
    arWaitTimer = setTimeout(() => { if (arActive && !arHave) arFail(T().arNoSensor); }, 2500);
    locateSite();   // 観測地を端末の現在地へ (許可が無ければ今の観測地のまま)
    arWakeOn();
    syncViewModeUI();
  }
  function arFail(msg) {
    exitAR();
    arNotice(msg);
  }
  function exitAR() {
    if (arPending) { arPending = false; arStartEl.hidden = true; }
    if (!arActive) { syncViewModeUI(); return; }
    arActive = false;
    clearTimeout(arWaitTimer);
    window.removeEventListener("deviceorientationabsolute", arOnOrient);
    window.removeEventListener("deviceorientation", arOnOrient);
    document.getElementById("app").classList.remove("arMode");
    arCalEl.hidden = true;
    arCalShown = "";
    if (arSaved) {
      setRate(arSaved.daysPerSec);
      setPlaying(arSaved.playing);
      arSaved = null;
    }
    arWakeOff();
    syncViewModeUI();
  }
  vmARBtn.addEventListener("click", enterAR);
