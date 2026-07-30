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
  //   lit   true なら太陽光の当たる側へ回り込む (a・y より優先)
  //   spd   再生速度 [日/秒]   play 再生するか
  //   constel 星座 (と黄道) を出すか。ツアー中だけの一時変更で設定は保存しない
  //   mark  sel の天体に選択マーク (オレンジのリング) を出すか。既定は false
  //   hold  自動送りでの滞留秒 (既定 12)
  //   text  ナレーション
  //   scene false ならシーン (ビュー・日時・カメラ・速度・選択) を触らない。
  //         畳み込みで前の設定が毎回再適用されるため、利用者に操作させる
  //         チュートリアルではこれが無いとカメラが巻き戻る
  //   ui    一時的に出す UI: "controls" / "nav" / "menu" / "view" / "clock"
  //   hi    ハイライトする要素の CSS セレクタ
  //   await 検知したら自動で次へ進む操作:
  //         "rotate" / "zoom" / "dist" / "pan" / "select" / "play" / "view" / "menu"
  //         (日時は再生中に勝手に動いて誤検知するので対象にしない)
  //
  // ツアー単位:
  //   platform "touch" | "desktop" — 一覧に出す端末。未指定は常に出す
  //   manual   true なら「自動送り」ボタンを隠す (検知式のツアー用)
  //   keep     true なら終了時にシーンを戻さない
  //
  // カメラは Tgt 側だけを設定し、実際の移動はメインループの緩和に任せる
  // (通常操作と同じ動きで繋がる)。
  //
  // 終了時は開始前の状態 (日時・ビュー・カメラ・速度・選択) へ戻す。
  // 終わった場面にそのまま留まらせたいツアーだけ、ツアー側に keep: true を書く。
  const TOURS = [
    {
      id: "basics-desktop",
      platform: "desktop",
      manual: true,
      title: { ja: "はじめての操作", en: "Getting Started" },
      lead: {
        ja: "回転・拡大・天体の選択など、基本の操作を実際に試しながら覚えます。",
        en: "Learn the basics — rotate, zoom, pick a body — by trying each one.",
      },
      steps: [
        {
          view: "space", sel: null, fit: 1.7, a: 0.42, y: 0.9, mag: 1,
          play: false, constel: true, mark: true,
          text: {
            ja: "Sidereum へようこそ。太陽系を実際の縮尺で見てまわれます。" +
                "基本の操作をひとつずつ試してみましょう。",
            en: "Welcome to Sidereum — the Solar System at true scale. " +
                "Let's try the basic controls one at a time.",
          },
        },
        {
          scene: false, await: "rotate",
          text: {
            ja: "まずは視点を回してみます。画面をドラッグしてください。",
            en: "First, turn the view: drag anywhere on the screen.",
          },
        },
        {
          scene: false, await: "zoom",
          text: {
            ja: "マウスホイールを回すと拡大・縮小できます。回してみてください。",
            en: "Scroll the mouse wheel to zoom in and out. Give it a try.",
          },
        },
        {
          scene: false, await: "dist",
          text: {
            ja: "Shift を押しながらホイールを回すと、拡大率ではなく" +
                "太陽系との距離そのものが変わります。",
            en: "Hold Shift while scrolling to change your distance from the " +
                "Solar System itself, rather than the magnification.",
          },
        },
        {
          scene: false, await: "pan",
          text: {
            ja: "右ドラッグすると、見ている位置を平行に動かせます。" +
                "中心から外れた天体を追いたいときに使います。",
            en: "Right-drag to slide the view sideways — handy for following " +
                "something that has drifted off centre.",
          },
        },
        {
          scene: false, await: "select", ui: ["nav"], hi: "#navPanel",
          text: {
            ja: "天体をクリックすると選択して近づきます。左のリストからも選べます。" +
                "どれか選んでみてください。",
            en: "Click a body to select it and fly closer — or pick one from the " +
                "list on the left. Try selecting one.",
          },
        },
        {
          scene: false, ui: ["clock"], hi: "#clock",
          text: {
            ja: "右上の日付・時刻を直接指定すると、任意の日時へジャンプできます。" +
                "1900年から2199年まで指定できます。",
            en: "Type into the date and time at the top right to jump to any moment — " +
                "anywhere from 1900 to 2199.",
          },
        },
        {
          scene: false, ui: ["controls"], hi: "#play", await: "play",
          text: {
            ja: "下のパネルの再生ボタンで時間を進められます。速度は隣のスライダーで、" +
                "1秒 = 1秒 から約240年まで変えられます。押してみてください。",
            en: "Press play in the panel below to run time forward. The slider next to it " +
                "sets the speed, from 1 second per second up to about 240 years. Try it.",
          },
        },
        {
          scene: false, await: "view", ui: ["view"], hi: "#viewMode",
          text: {
            ja: "上のタブで宇宙・地上・月面を切り替えられます。" +
                "地上と月面は、その場所から見た実際の空になります。切り替えてみてください。",
            en: "The tabs at the top switch between Space, Ground and Moon. Ground and " +
                "Moon show the real sky from that place. Try switching.",
          },
        },
        {
          scene: false, ui: ["menu"], hi: "#menuBtn",
          text: {
            ja: "左上のメニューには、共有リンク・風景の表示・単位や言語の切替・" +
                "操作方法があります。基本操作はここまでです。" +
                "ほかのガイドツアーも同じメニューから開けます。",
            en: "The menu at the top left holds share links, scenery, units, language " +
                "and the full control list. That's the basics — the other guided tours " +
                "live in the same menu.",
          },
        },
      ],
    },
    {
      id: "basics-touch",
      platform: "touch",
      manual: true,
      title: { ja: "はじめての操作", en: "Getting Started" },
      lead: {
        ja: "回転・拡大・天体の選択など、基本の操作を実際に試しながら覚えます。",
        en: "Learn the basics — rotate, zoom, pick a body — by trying each one.",
      },
      steps: [
        {
          view: "space", sel: null, fit: 1.7, a: 0.42, y: 0.9, mag: 1,
          play: false, constel: true, mark: true,
          text: {
            ja: "Sidereum へようこそ。太陽系を実際の縮尺で見てまわれます。" +
                "基本の操作をひとつずつ試してみましょう。",
            en: "Welcome to Sidereum — the Solar System at true scale. " +
                "Let's try the basic controls one at a time.",
          },
        },
        {
          scene: false, await: "rotate",
          text: {
            ja: "まずは視点を回してみます。1本指で画面をドラッグしてください。",
            en: "First, turn the view: drag the screen with one finger.",
          },
        },
        {
          scene: false, await: "zoom",
          text: {
            ja: "2本の指でつまむように広げたり縮めたり (ピンチ) すると拡大・縮小できます。",
            en: "Pinch with two fingers to zoom in and out.",
          },
        },
        {
          scene: false, await: "dist", ui: ["controls"], hi: "#zoom",
          text: {
            ja: "下のパネルの「距離」スライダーでは、拡大率ではなく" +
                "太陽系との距離そのものが変わります。動かしてみてください。",
            en: "The “Distance” slider in the panel below changes how far you are from " +
                "the Solar System itself, rather than the magnification. Try moving it.",
          },
        },
        {
          scene: false, await: "pan",
          text: {
            ja: "2本の指を同時にドラッグすると、見ている位置を平行に動かせます。" +
                "中心から外れた天体を追いたいときに使います。",
            en: "Drag with two fingers to slide the view sideways — handy for following " +
                "something that has drifted off centre.",
          },
        },
        {
          scene: false, await: "select", ui: ["nav"], hi: "#navPanel",
          text: {
            ja: "天体をタップすると選択して近づきます。左のリストからも選べます。" +
                "どれか選んでみてください。",
            en: "Tap a body to select it and fly closer — or pick one from the list on " +
                "the left. Try selecting one.",
          },
        },
        {
          scene: false, ui: ["clock"], hi: "#clock",
          text: {
            ja: "右上の日付・時刻を直接指定すると、任意の日時へジャンプできます。" +
                "1900年から2199年まで指定できます。",
            en: "Type into the date and time at the top right to jump to any moment — " +
                "anywhere from 1900 to 2199.",
          },
        },
        {
          scene: false, ui: ["controls"], hi: "#play", await: "play",
          text: {
            ja: "下のパネルの再生ボタンで時間を進められます。速度は隣のスライダーで、" +
                "1秒 = 1秒 から約240年まで変えられます。押してみてください。",
            en: "Press play in the panel below to run time forward. The slider next to it " +
                "sets the speed, from 1 second per second up to about 240 years. Try it.",
          },
        },
        {
          scene: false, await: "view", ui: ["menu", "view"], hi: "#menuBtn",
          text: {
            ja: "左上のメニューを開くと、宇宙・地上・月面を切り替えられます。" +
                "地上と月面は、その場所から見た実際の空になります。切り替えてみてください。",
            en: "Open the menu at the top left to switch between Space, Ground and Moon. " +
                "Ground and Moon show the real sky from that place. Try switching.",
          },
        },
        {
          scene: false, ui: ["menu"], hi: "#menuBtn",
          text: {
            ja: "同じメニューに、共有リンク・風景の表示・単位や言語の切替・" +
                "操作方法があります。基本操作はここまでです。" +
                "ほかのガイドツアーも同じメニューから開けます。",
            en: "The same menu holds share links, scenery, units, language and the full " +
                "control list. That's the basics — the other guided tours live there too.",
          },
        },
      ],
    },
    {
      id: "scale",
      title: { ja: "太陽系の大きさ", en: "The Size of the Solar System" },
      lead: {
        ja: "地球から出発して海王星まで、実寸比のまま引いていきます。",
        en: "Pull back from Earth to Neptune, all at true scale.",
      },
      steps: [
        {
          view: "space", sel: "earth", km: 25000, mag: 1, lit: true,
          play: false, constel: false, hold: 10,
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
          sel: null, fit: 1.7, a: 0.42, y: 0.9, hold: 13,
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

