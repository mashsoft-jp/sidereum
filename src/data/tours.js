  // ============================================================
  // ガイドツアー (シーンの並び + ナレーション)
  // ============================================================
  // 1ステップ = 共有URL 相当の状態 + ナレーション。
  // 各ステップには「変えたい項目だけ」を書く。書かなかった項目は直前の
  // ステップの状態がそのまま続く (畳み込んでから適用する)。
  //
  //   view  "space" | "ground" | "moon"
  //   d     日時。UTC の ISO 文字列 ("1910-05-20T06:00")
  //   sel   選択天体のキー。null で選択解除 (注視点は太陽へ)
  //   fit   この軌道半径 [au] が画面に収まる距離にする (画角と縦横比から算出)
  //   km    選択天体からの距離 [km]。fit より優先
  //   z     カメラ距離 [world]。fit・km が無いときだけ使う
  //   mag   ズーム倍率   a 俯角 [rad]   y 方位 [rad]
  //   spd   再生速度 [日/秒]   play 再生するか
  //   hold  自動送りでの滞留秒 (既定 12)
  //   text  ナレーション
  //
  // カメラは Tgt 側だけを設定し、実際の移動はメインループの緩和に任せる
  // (通常操作と同じ動きで繋がる)。
  const TOURS = [
    {
      id: "scale",
      title: { ja: "太陽系の大きさ", en: "The Size of the Solar System" },
      lead: {
        ja: "地球から出発して海王星まで、実寸比のまま引いていきます。",
        en: "Pull back from Earth to Neptune, all at true scale.",
      },
      steps: [
        {
          view: "space", sel: "earth", km: 25000, mag: 1, a: 0.30, y: 0.9,
          play: false, hold: 10,
          text: {
            ja: "まずは地球から。直径は約 12,700 km。このあと視点を引いていくので、" +
                "この球の大きさを覚えておいてください。",
            en: "We start at Earth — about 12,700 km across. Keep this size in mind: " +
                "everything that follows is drawn to the same scale.",
          },
        },
        {
          km: 1100000, hold: 11,
          text: {
            ja: "月の軌道まで引きました。月までは約 38万 km — 地球を30個ならべた距離で、" +
                "人類がこれまでに到達した最も遠い場所です。",
            en: "Out to the Moon's orbit: about 384,000 km, or 30 Earths side by side. " +
                "This is still the farthest humans have ever travelled.",
          },
        },
        {
          sel: null, fit: 1.7, a: 0.42, hold: 13,
          text: {
            ja: "太陽から火星までを一望します。太陽と地球の距離が 1 天文単位 (au) — " +
                "約1億5000万 km で、太陽の光でも8分20秒かかります。" +
                "さきほどの月の軌道は、もう地球の点の中に隠れてしまいました。",
            en: "The Sun out to Mars. The Earth–Sun distance is 1 astronomical unit (au), " +
                "about 150 million km — sunlight takes 8 minutes 20 seconds to cross it. " +
                "The Moon's orbit has already vanished into Earth's dot.",
          },
        },
        {
          fit: 5.5, hold: 12,
          text: {
            ja: "火星の外側の小惑星帯を越えると木星。太陽から 5.2 au です。" +
                "内側の4惑星は、この軌道の内側のごく狭い範囲に収まってしまいます。",
            en: "Past the asteroid belt lies Jupiter, 5.2 au from the Sun. " +
                "All four inner planets now fit inside a small patch at the centre.",
          },
        },
        {
          fit: 30, spd: 200, play: true, hold: 16,
          text: {
            ja: "一番外側の海王星は 30 au。太陽の光でも4時間以上かかります。" +
                "時間を進めてみると、外側の惑星ほどゆっくり動くことがわかります。",
            en: "Neptune, the outermost planet, orbits at 30 au — over four light-hours out. " +
                "With time running you can see how much more slowly the outer planets move.",
          },
        },
        {
          fit: 30, a: 1.5708, play: false, hold: 14,
          text: {
            ja: "真上から見た太陽系。ここまでが主要な惑星の領域ですが、" +
                "太陽の重力が届く範囲は、さらにこの数千倍先まで広がっています。",
            en: "The Solar System from above. This is the realm of the major planets — " +
                "yet the Sun's gravity reaches thousands of times farther still.",
          },
        },
      ],
    },
  ];

