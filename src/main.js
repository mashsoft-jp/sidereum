  // ---------- 起動 ----------
  updatePositions();
  applyLang();
  // 初期カメラは「デフォルト」ビュー (内惑星が収まる俯瞰) に即時セット
  goDefaultView();
  cam.dist = cam.distTgt;
  // 保存済みの操作パネル設定を復元 (速度・ズーム・角度)
  {
    const sp = parseFloat(localStorage.getItem("ssSpeed"));
    if (isFinite(sp) && sp > 0) {
      daysPerSec = sp;
      speedInput.value = Math.max(0, Math.min(100,
        Math.round(18 * Math.log(sp * 86400) / Math.log(60))));
      speedVal.textContent = fmtRate(daysPerSec);
    }
    // ズームは俯瞰域のみ復元 (天体接近中の至近距離は選択が復元されないため除外)
    const zd = parseFloat(localStorage.getItem("ssZoom"));
    if (isFinite(zd) && zd >= 1) {
      cam.distTgt = Math.min(1400, zd);
      cam.dist = cam.distTgt;
    }
    const mg = parseFloat(localStorage.getItem("ssMag"));
    if (isFinite(mg) && mg >= 1) {
      camZoomTgt = Math.min(MAG_MAX, mg);
      camZoom = camZoomTgt;
    }
    const an = parseFloat(localStorage.getItem("ssAngle"));
    if (isFinite(an)) {
      cam.pitchTgt = Math.max(-1.52, Math.min(1.52, an));
      cam.pitch = cam.pitchTgt;
    }
  }
  // 共有URLのパラメータがあれば localStorage 復元より優先して適用
  const fromShare = applyShareURL();
  // ?tour=... はさらに優先 (シーンの状態を上書きする)
  const fromTour = applyTourURL();
  // 初回のみ操作ガイドを表示 (共有リンク・ツアーで開いた場合はそのまま見せる)。
  // あわせて、銀河系から太陽系へ寄る導入を流し、着いたところでガイドを出す
  // (動きを減らす設定の端末では導入を流さないので、そのまま出す)
  if (!fromShare && !fromTour && !localStorage.getItem("ssGuideSeen")) {
    buildWelcome();
    const showWelcome = () => welcomeEl.classList.add("open");
    if (!startIntro(showWelcome)) showWelcome();
  }
  requestAnimationFrame(frame);
