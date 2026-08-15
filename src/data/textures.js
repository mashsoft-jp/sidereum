  // ---------- 天体テクスチャ (パブリックドメインの実全球マップ) ----------
  //   出典: 水星 MESSENGER (USGS) / 金星 Magellan レーダー地形 (NASA) / 地球 Blue Marble (NASA) /
  //         月 LRO (NASA SVS) / 火星 Viking (USGS) / 木星 Cassini PIA07782 (NASA/JPL) /
  //         イオ・ガニメデ Voyager + Galileo SSI 合成 (USGS) /
  //         エウロパ・カリスト 同 (USGS。輝度のみの製品なので色は天体色を掛けた) /
  //         冥王星 New Horizons (NASA) / ケレス・ベスタ Dawn (NASA/JPL)
  //   土星・天王星・海王星・パラス・ジュノーは実測の全球マップが存在しないためプロシージャル描画
  //
  //   画像は index.html と同じ場所の tex/ に置く外部ファイル。data URI で埋め込むと
  //   (1) HTML を1文字直すたびに画像ぜんぶを再ダウンロードさせることになり、
  //   (2) base64 のぶん 4/3 に膨らんだうえ HTML の解析完了まで描画が始まらない。
  //   解像度を上げるほど不利になるので分離した。読み込みに失敗した天体は
  //   仮色のまま描かれる (src/gl/resources.js)
  const TEX_DIR = "tex/";
  const TEXTURES = {
    mercury: "mercury.jpg",
    venus:   "venus.jpg",
    earth:   "earth.jpg",
    moon:    "moon.jpg",
    mars:    "mars.jpg",
    jupiter: "jupiter.jpg",
    io:      "io.jpg",
    europa:   "europa.jpg",
    ganymede: "ganymede.jpg",
    callisto: "callisto.jpg",
    pluto:   "pluto.jpg",
    ceres:   "ceres.jpg",
    vesta:   "vesta.jpg",
  };
  // 輝度だけの製品しか無く、色は天体色 (colA) を掛けて与えたもの。
  // クレジットに「色は再現」と添えるために持つ
  const MONO_TEX = new Set(["europa", "callisto"]);
  // 地表以外に地球だけが持つ2枚。天体のキーではないので TEXTURES とは分ける
  //   雲   Blue Marble: Clouds (NASA Earth Observatory) — 被覆率としてグレースケールで持つ
  //   夜景 Black Marble 2016 (NASA Earth Observatory) — 下地の海陸を落として街灯りだけ残した
  const TEXTURES_EXTRA = {
    cloud: "earth-clouds.jpg",
    night: "earth-night.jpg",
  };
  // 実測の標高から起こした接空間の法線図。アルベド図は一定の照明で正規化されて
  // いて起伏が焼き込まれているため、これが無いと太陽が動いても陰影が変わらない。
  //   月   LOLA (NASA SVS) / 火星 MOLA (PDS) / 水星 MESSENGER DEM (USGS)
  // 起伏は実寸の 3倍で焼いてある (8bit に収めるため。強さは uNrmAmt で調整)
  const NORMALS = {
    moon:    "moon-nrm.jpg",
    mars:    "mars-nrm.jpg",
    mercury: "mercury-nrm.jpg",
  };
  // 解像度は2組を同名で持つ。2K が tex/ 直下、4K が tex/4k/。
  //
  // 既定は端末によらず 2K。4K は 1枚あたり 4096×2048×4バイト×1.33 (ミップ込み) =
  // 約 45MB で、常駐する 14枚ぶんでは 625MB になる。通る端末でも初回の転送量が
  // 数倍になるので、選んだ人にだけ渡す。
  //
  // 端末で出し分けていた時期もあったが、PC でも GPU は千差万別で、
  // 「既定で有効 → 最初の読み込みで落ちる → メニューに辿り着けないので直せない」
  // という詰み方をする。既定を軽い側に倒しておけば、その袋小路が無くなる
  let texHiRes = (() => {
    try { return localStorage.getItem("ssHiRes") === "1"; }
    catch (e) { return false; }          // プライベートモード等
  })();
  // 法線図かどうかは接頭辞だけで見る。NORMALS を先に引くと、法線図も持つ天体
  // (月・火星・水星) の地表テクスチャが法線図に化ける
  const texURL = (key) => {
    if (key.indexOf("nrm:") === 0) return TEX_DIR + (texHiRes ? "4k/" : "") + NORMALS[key.slice(4)];
    return TEX_DIR + (texHiRes ? "4k/" : "") + (TEXTURES[key] || TEXTURES_EXTRA[key]);
  };
