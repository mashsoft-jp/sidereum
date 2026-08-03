  // ---------- 天体テクスチャ (パブリックドメインの実全球マップ) ----------
  //   出典: 水星 MESSENGER (USGS) / 金星 Magellan レーダー地形 (NASA) / 地球 Blue Marble (NASA) /
  //         月 LRO (NASA SVS) / 火星 Viking (USGS) / 木星 Cassini PIA07782 (NASA/JPL) /
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
    pluto:   "pluto.jpg",
    ceres:   "ceres.jpg",
    vesta:   "vesta.jpg",
  };
  // 地表以外に地球だけが持つ2枚。天体のキーではないので TEXTURES とは分ける
  //   雲   Blue Marble: Clouds (NASA Earth Observatory) — 被覆率としてグレースケールで持つ
  //   夜景 Black Marble 2016 (NASA Earth Observatory) — 下地の海陸を落として街灯りだけ残した
  const TEXTURES_EXTRA = {
    cloud: "earth-clouds.jpg",
    night: "earth-night.jpg",
  };
  const texURL = (key) => TEX_DIR + (TEXTURES[key] || TEXTURES_EXTRA[key]);
