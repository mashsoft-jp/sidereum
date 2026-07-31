  // ============================================================
  // ガイドツアー (シーンの並び + ナレーション)
  // ============================================================
  // 1ステップ = 共有URL 相当の状態 + ナレーション。
  // 各ステップには「変えたい項目だけ」を書く。書かなかった項目は直前の
  // ステップの状態がそのまま続く (畳み込んでから適用する)。
  //
  //   view  "space" | "ground" | "moon"
  //   d     日時。UTC の ISO 文字列 ("1910-05-20T06:00")
  //   dLocal 観測地の平均太陽時での日時。「現地の何時の空か」を揃えたい地上ビュー
  //         のステップに使う (UTC 固定だと観測地の経度によっては昼になる)
  //   sel   選択天体のキー。null で選択解除 (注視点は太陽へ)
  //   fit   この軌道半径 [au] が画面に収まる距離にする (画角と縦横比から算出)
  //   km    選択天体からの距離 [km]
  //   z     カメラ距離 [world]。km / fit / z は後から書いたものだけが効く
  //   mag   ズーム倍率   a 俯角 [rad]   y 方位 [rad]
  //   lit   true なら太陽光の当たる側へ回り込む (a・y より優先)
  //   side  true なら彗星の尾を横から見る向きへ回り込む (y より優先)
  //   apart 中心天体とこの天体が画面上で重ならない向きへ回り込む (lit より優先)
  //   front この天体が中心天体の手前に重なる向きへ回り込む (apart の逆)。
  //         km をこの天体までの距離より大きくすると、円盤を背に小さく写る
  //   ride  探査機ツアー専用。カメラを探査機の位置に置き、この天体を見続ける。
  //         sel・km・角度の指定より優先する (毎フレーム計算し直す)
  //   path  探査機の軌跡を描く。通ってきたところだけを引く (先は描かない)
  //   site  地上ビューの観測地 [緯度, 経度]。ビューを開く前に適用する
  //   aim   true なら地上ビューで sel の天体に照準を合わせ、追尾する
  //   sight 宇宙ビューで、注視天体からこの天体へ向かう視線ガイド (破線) を出す
  //   spot  この天体の名前と輪郭を強調する (カメラは動かさない)。
  //         引きの画では点になって見つけられないので、注目させたい回に使う
  //   gfov  地上ビューの画角 [度]
  //   spd   再生速度 [日/秒]   play 再生するか
  //   until play: true のとき、この日時 (UTC) まで再生したら停止して次へ
  //   stay  true なら until に達しても次へ進まない (着いた場面を眺めさせる)
  //   constel 星座 (と黄道) を出すか。ツアー中だけの一時変更で設定は保存しない
  //   orbits  軌道線を出すか。同じく一時変更。探査機視点など「写真」として
  //         見せる場面では、画面を横切る線が邪魔になるので落とす
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
  //   probe    探査機ツアー。この1機だけを描き、他機は隠す
  //   keep     true なら終了時にシーンを戻さない
  //   ver      内容の版 (既定 1)。中身を直したらここを +1 する。視聴済みの記録
  //            (localStorage の ssTourSeen) より新しいと、一覧で未視聴側へ戻り
  //            タイトルの右に Update! が付く
  //
  // カメラは Tgt 側だけを設定し、実際の移動はメインループの緩和に任せる
  // (通常操作と同じ動きで繋がる)。
  //
  // 終了時は開始前の状態 (日時・ビュー・カメラ・速度・選択) へ戻す。
  // 終わった場面にそのまま留まらせたいツアーだけ、ツアー側に keep: true を書く。
  // 新しいツアーは、指示がないかぎりこの配列の末尾に足す (一覧の並び順になる)。
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
    {
      id: "halley1910",
      ver: 3,
      manual: true,
      title: { ja: "ハレー彗星 1910年の大接近", en: "Halley's Comet: the 1910 Approach" },
      lead: {
        ja: "太陽系の外から落ちてきて、地球のすぐ横をかすめ、また去っていくまでを辿ります。",
        en: "Follow the comet as it falls in from the outer Solar System, grazes past Earth, and departs.",
      },
      steps: [
        {
          view: "space", sel: null, fit: 11, a: 0.55, y: 0.9, mag: 1,
          d: "1907-06-25", play: false, constel: false, spot: "halley",
          text: {
            ja: "1907年、ハレー彗星は木星と土星の軌道のあいだ、太陽から 10 au のあたりにいます。" +
                "この距離では太陽の熱が届かず、コマも尾もない、ただの暗い氷の塊です。",
            en: "In 1907 Halley is between the orbits of Jupiter and Saturn, 10 au from the Sun. " +
                "Out here there is no warmth to speak of — it is just a dark lump of ice, with no coma or tail.",
          },
        },
        {
          spd: 60, play: true, until: "1910-02-09",
          text: {
            ja: "落ちていく様子を早送りで見てみましょう。外側では這うようにしか動きませんが、" +
                "内側へ入るほど速くなります。楕円軌道では太陽に近いほど速く動くためです。" +
                "1909年10月に太陽から 3 au を切り、氷が昇華しはじめます。",
            en: "Watch it fall, sped up. Far out it barely crawls; the closer it gets, the faster it moves — " +
                "on an elliptical orbit, speed rises as you approach the Sun. " +
                "In October 1909 it crosses 3 au and its ice begins to sublimate.",
          },
        },
        {
          sel: "halley", fit: 0.2, a: 0.55, side: true, d: "1910-02-09",
          play: false, spot: null,
          text: {
            ja: "1910年2月、太陽まで 1.5 au。噴き出したガスと塵が太陽と反対の方向へ流されて、" +
                "核をつつむコマと、その後ろに伸びる尾ができてきました。" +
                "ただし地球からはまだ 1.8 au。この頃は望遠鏡でしか見えません。",
            en: "February 1910, 1.5 au from the Sun. Gas and dust streaming off the nucleus are swept " +
                "away from it, forming a coma and a tail behind. But at 1.8 au from Earth it is still " +
                "a telescopic object.",
          },
        },
        {
          fit: 0.75, a: 0.35, side: true, d: "1910-04-20",
          text: {
            ja: "1910年4月20日、近日点。太陽まで 0.59 au まで迫り、噴き出したガスと塵が" +
                "太陽と反対の方向へ長く流れます。尾がもっとも伸びるのはこの時期です。",
            en: "20 April 1910: perihelion. At 0.59 au from the Sun, the escaping gas and dust stream away " +
                "from it in a long tail. This is when the tail is at its longest.",
          },
        },
        {
          view: "ground", dLocal: "1910-05-05T04:00", sel: "halley",
          aim: true, gfov: 55,
          text: {
            ja: "5月5日の夜明け前。地球まで 0.66 au、太陽から 41° 離れて暗い東の空に上がり、" +
                "ついに肉眼で見えるようになりました。金星のそばで、尾が空を横切っています。",
            en: "Before dawn on 5 May. Now 0.66 au from Earth and 41° from the Sun, it climbs into a " +
                "dark eastern sky and is finally visible to the naked eye, tail streaming past Venus.",
          },
        },
        {
          view: "space", sel: "earth", fit: 0.3, a: 1.4,
          d: "1910-05-16", spd: 0.6, play: true, until: "1910-05-23",
          text: {
            ja: "地球を中心に据えて、5月16日から1週間を進めてみましょう。彗星が地球と太陽のあいだを" +
                "横切り、太陽と反対 — つまり地球の側 — へ伸びた尾の中を、19日から20日にかけて" +
                "地球が通り抜けていきます。当時は尾に含まれるシアンで人類が滅ぶという噂が流れ、" +
                "実際には何も起きませんでした。",
            en: "Centred on Earth, let a week run from 16 May. The comet crosses between Earth and the Sun, " +
                "and on the 19th and 20th Earth passes right through the tail streaming away from the Sun — " +
                "straight at us. Newspapers warned that cyanogen in the tail would poison the planet. " +
                "Nothing happened.",
          },
        },
        {
          view: "ground", dLocal: "1910-05-21T20:00", aim: true, gfov: 85,
          sel: "halley", play: false,
          text: {
            ja: "5月21日、地球最接近 0.152 au。月までの距離の約60倍です。" +
                "尾のすぐ横をかすめて進むため、遠近の効果で尾は空を大きく横切って見えます。" +
                "当時は「100°以上に伸びた」と記録されました。ただし太陽から 24° しか離れておらず、" +
                "日が沈むと西の低い空にいて、まもなく沈んでしまいます。",
            en: "21 May: closest approach at 0.152 au, about 60 times the distance to the Moon. " +
                "Earth skims right alongside the tail, so perspective throws it across the sky — " +
                "observers recorded a tail more than 100° long. But at only 24° from the Sun it hangs " +
                "low in the west after sunset and soon follows it down.",
          },
        },
        {
          dLocal: "1910-05-30T21:00", gfov: 55,
          text: {
            ja: "9日後。地球からは 0.44 au まで離れて尾も短くなりましたが、" +
                "太陽から 79° 離れて空高くに移り、一晩じゅう暗い空で眺められるようになりました。" +
                "多くの人が実際に目にしたのはこの時期です。",
            en: "Nine days later. It has receded to 0.44 au and the tail has shrunk, but at 79° from the " +
                "Sun it now rides high in a dark sky for most of the night. This is when most people " +
                "actually saw it.",
          },
        },
        {
          view: "space", sel: null, fit: 3.2, a: 0.5, y: 0.9,
          d: "1910-08-08", spd: 30, play: true, until: "1911-06-01", spot: "halley",
          text: {
            ja: "太陽から離れるにつれて活動が止まり、尾は縮んで消えていきます。" +
                "次に戻ってきたのは1986年 — このときは 0.42 au までしか近づかず条件が悪く、" +
                "「見えなかった彗星」として記憶されました。その次は2061年です。",
            en: "As it recedes the activity shuts down and the tail shrinks away. " +
                "It returned in 1986, but only came within 0.42 au in poor viewing geometry — " +
                "remembered as the apparition nobody could see. The next is 2061.",
          },
        },
      ],
    },
    {
      id: "phases",
      ver: 3,
      title: { ja: "満ち欠けのしくみ", en: "Why Worlds Wax and Wane" },
      lead: {
        ja: "月と金星の満ち欠けを追い、なぜ形が変わるのか、なぜ金星だけ大きさまで変わるのかを見ます。",
        en: "Follow the phases of the Moon and Venus, and see why the shapes change — and why only Venus changes size.",
      },
      steps: [
        {
          view: "ground", dLocal: "2026-09-15T19:00", sel: "moon",
          aim: true, gfov: 1.2, constel: false, mark: false, play: false, mag: 1,
          text: {
            ja: "新月から4日後の月。太陽に照らされているのは、いつでも月の半分です。" +
                "このときは、その照らされた面をほとんど横から見ているので、細い弧しか光りません。",
            en: "Four days after new moon. Exactly half of the Moon is always lit by the Sun — " +
                "but right now we are looking at that lit half almost edge-on, so only a thin arc shows.",
          },
        },
        {
          dLocal: "2026-09-19T19:30",
          text: {
            ja: "4日後、上弦。地球から見て太陽と直角の方向に来たので、" +
                "照らされた面のちょうど半分が見えています。",
            en: "Four days later, first quarter. The Moon now sits at right angles to the Sun as seen " +
                "from Earth, so we see exactly half of the lit side.",
          },
        },
        {
          dLocal: "2026-09-27T22:00",
          text: {
            ja: "さらに8日後、満月。太陽と反対側に回りこみ、照らされた面を真正面から見ています。" +
                "月そのものは何も変わっていません。変わったのは見る角度だけです。",
            en: "Eight days on, full moon. The Moon has swung round to the far side of Earth from the Sun, " +
                "and we see the lit face head-on. Nothing about the Moon changed — only our viewing angle.",
          },
        },
        {
          view: "space", sel: "moon", km: 9000, a: 1.15, mag: 1,
          d: "2026-09-15", spd: 2, play: true, until: "2026-10-15",
          text: {
            ja: "宇宙から月に寄って、ひと月ぶん早送りしてみましょう。" +
                "太陽に照らされた半分はずっと同じ大きさのままで、明暗の境目が月面を横切っていくだけ " +
                "— 月が地球のまわりを回るにつれて、その半分を見る角度が変わり続けるからです。",
            en: "Now close in from space and run a month forward. The lit half never changes size; " +
                "only the line between day and night sweeps across the surface. " +
                "As the Moon circles Earth, the angle we view that half from keeps turning.",
          },
        },
        {
          view: "ground", dLocal: "2026-08-11T19:30", sel: "venus",
          aim: true, gfov: 0.04, play: false,
          text: {
            ja: "満ち欠けするのは月だけではありません。2026年8月の金星、ちょうど半分です。" +
                "このあとの大きさに注目してください。",
            en: "The Moon is not the only one. Here is Venus in August 2026, exactly half lit. " +
                "Keep an eye on how big it looks.",
          },
        },
        {
          dLocal: "2026-09-20T18:15",
          text: {
            ja: "ひと月半後、同じ倍率です。三日月形になったのに、見かけの大きさは 1.7倍。" +
                "月は地球のまわりを回るので距離がほぼ一定ですが、金星は太陽のまわりを回るので、" +
                "細く見えるときほど地球の近くにいます。",
            en: "Six weeks later, at the same magnification. It has thinned to a crescent — and grown " +
                "1.7 times larger. The Moon orbits Earth, so its distance barely changes; Venus orbits " +
                "the Sun, so the thinner it looks, the closer it is to us.",
          },
        },
        {
          view: "space", sel: "venus", fit: 0.85, a: 1.5708, y: 0.9,
          d: "2026-09-20", play: false, mark: true,
          text: {
            ja: "同じ日を真上から見てみましょう。太陽・金星・地球がほぼ一直線に並び、" +
                "金星がそのあいだにいます。この位置関係のまま、金星に寄ってみます。",
            en: "Now the same day from directly above. Sun, Venus and Earth line up almost exactly, " +
                "with Venus in between. Keeping this angle, let's move in on Venus.",
          },
        },
        {
          km: 26000, mark: false, sight: "earth",
          text: {
            ja: "同じ真上からのアングルで金星に寄りました。向かって左側が太陽に照らされた昼、" +
                "右側が夜です。破線が地球の方向 — 私たちはこの矢印の側から眺めているので、" +
                "見えているのはほとんど夜の側で、明るい部分は縁の細い弧だけになります。" +
                "地球より内側を回る天体でしか起きないことで、ガリレオはこれを" +
                "金星が太陽のまわりを回っている証拠としました。",
            en: "Same view from above, now close in on Venus. The half facing the Sun is lit; the other " +
                "half is night. The dashed line points to Earth — we are looking from that side, so almost " +
                "all of what we see is the night side, and only a thin arc at the edge is lit. " +
                "Only a body orbiting inside Earth's orbit can do this, and Galileo took it as proof " +
                "that Venus circles the Sun.",
          },
        },
        {
          view: "ground", dLocal: "2037-07-24T03:00", sel: "mars",
          aim: true, gfov: 0.011, sight: null,
          text: {
            ja: "では外側の惑星は。火星が最も欠けるのがこの日で、それでも 84% です。" +
                "地球より外側にある天体は、いつも太陽とほぼ同じ方向から眺めることになるので、" +
                "木星では 99%、土星より外ではもう見分けがつきません。",
            en: "What about the outer planets? This is Mars at its most gibbous — and it is still 84% lit. " +
                "Anything outside Earth's orbit is always viewed from nearly the Sun's direction: " +
                "Jupiter reaches 99%, and beyond Saturn the effect is undetectable.",
          },
        },
        {
          view: "moon", d: "2026-09-19T12:00", sel: "earth",
          aim: true, gfov: 4.5,
          text: {
            ja: "最後に、月面から地球を見てみます。地球も同じように満ち欠けします。" +
                "しかも地球から見た月とはちょうど逆 — 地球で上弦の月を眺めている人がいるとき、" +
                "月にいる人は半分欠けた地球を見上げていることになります。",
            en: "Finally, Earth seen from the Moon. It goes through phases too — and always the opposite " +
                "of the Moon's. While someone on Earth watches a first-quarter Moon, someone on the Moon " +
                "is looking up at a half-lit Earth.",
          },
        },
      ],
    },
    {
      id: "voyager1",
      manual: true,
      probe: "voyager1",
      ver: 5,
      title: { ja: "ボイジャー1号の旅", en: "The Voyage of Voyager 1" },
      lead: {
        ja: "1977年の打ち上げから、木星・土星を経て星間空間へ。人類が最も遠くへ送った機体を追います。",
        en: "From launch in 1977 past Jupiter and Saturn into interstellar space — the farthest human-made object.",
      },
      steps: [
        {
          // 地球が画面いっぱいになる距離まで寄り、その手前に機体を小さく置く
          view: "space", sel: "earth", km: 17000, front: "voyager1", mag: 1,
          d: "1977-09-05T00:05", play: false, constel: false, spot: "voyager1",
          text: {
            ja: "1977年9月5日、ボイジャー1号がタイタン3Eで打ち上げられました。" +
                "重さ 800kg 足らず、直径 3.7m のパラボラアンテナを地球へ向けたまま、" +
                "外惑星へ向かいます。",
            en: "5 September 1977: Voyager 1 lifts off on a Titan IIIE. Under 800 kg, it heads for the " +
                "outer planets with its 3.7 m dish kept pointed back at Earth.",
          },
        },
        {
          sel: null, fit: 6, a: 0.5, y: 0.9, spot: "voyager1", front: null, path: true,
          spd: 45, play: true, until: "1979-03-03",
          text: {
            ja: "火星軌道を越え、小惑星帯を抜けて木星へ。18か月の巡航です。" +
                "軌跡はフライバイの日付と場所を経由点にした近似ですが、" +
                "各惑星に到達する日時は実際の記録どおりです。",
            en: "Past Mars, through the asteroid belt, on to Jupiter — eighteen months of cruise. " +
                "The path here is an interpolation through the flyby waypoints, but the dates and " +
                "places of each encounter are the real ones.",
          },
        },
        {
          // 探査機視点で木星の脇を通り抜ける。最接近 (中心から 34.9万km) の
          // 視直径は 23°、画角は 45°/2.2 = 20° なので画面からはみ出す。
          // 再生速度は距離に比例して落ちる (tourRideCam) ので、最後はゆっくり
          sel: "jupiter", ride: "jupiter", spot: null, mark: false, mag: 2.2, orbits: false, path: false,
          d: "1979-03-03", spd: 0.4, play: true, until: "1979-03-05T07:00", stay: true,
          text: {
            ja: "ここからはボイジャー1号に乗って見てみます。1979年3月5日、木星最接近。" +
                "中心から 34万9千km — 木星の半径の5倍のところをかすめ、" +
                "イオの火山噴火と、木星に薄い環があることを見つけました。" +
                "内側から近づいて外側へ抜けるので、通り過ぎたあとは細い月のように欠けて見えます。",
            en: "Now ride along with Voyager 1. On 5 March 1979 it skims 349,000 km from Jupiter's " +
                "centre — five Jupiter radii — and finds volcanoes erupting on Io and a faint " +
                "ring around the planet. Arriving from the sunward side and leaving outward, it " +
                "watches the planet thin to a crescent behind it.",
          },
        },
        {
          // 引きの画に戻して土星系まで運ぶ。着いたら自動で次 (探査機視点) へ
          sel: null, ride: null, fit: 11, a: 0.5, y: 0.9, mag: 1, orbits: true, path: true,
          spot: "voyager1", stay: false, d: "1979-03-05T07:00",
          spd: 55, play: true, until: "1980-11-11T23:41",
          text: {
            ja: "木星の重力で加速し、進路は土星へ。もう一度引いて眺めます。" +
                "20か月かけて 5.2 au から 9.5 au へ、太陽系の外側半分を渡っていきます。",
            en: "Jupiter's gravity has flung it on toward Saturn. Pulling back again: twenty months " +
                "to cross from 5.2 au to 9.5 au, out through the far half of the Solar System.",
          },
        },
        {
          // タイタンへの最終進入。6時間で 37万km → 6千km まで詰める
          sel: "titan", ride: "titan", mag: 1, spot: null, orbits: false, path: false,
          d: "1980-11-11T23:41", spd: 0.09, play: true, until: "1980-11-12T05:41", stay: true,
          text: {
            ja: "1980年11月12日、まず向かったのはタイタンでした。" +
                "厚い大気を持つ唯一の衛星を間近で調べるため、土星本体より先に、" +
                "中心から 6,490km まで寄ります。オレンジ色の霞に覆われていて、" +
                "地表は最後まで見えませんでした。",
            en: "12 November 1980: Titan came first. To study the only moon with a thick atmosphere, " +
                "Voyager 1 closed to 6,490 km of its centre before reaching Saturn itself. " +
                "The orange haze never cleared — the surface stayed hidden.",
          },
        },
        {
          // カメラは探査機に乗ったまま土星へ向き直る。最接近 18.4万km で
          // 視直径 39°、環は画面からはみ出す
          sel: "saturn", ride: "saturn", d: "1980-11-12T05:41",
          spd: 0.15, play: true, until: "1980-11-12T23:46", stay: true,
          text: {
            ja: "そのまま振り返らずに土星へ。18時間後、中心から 18万4千km まで寄ります。" +
                "タイタンへ寄るために軌道を大きく曲げたので、ここで黄道面を離れることに" +
                "なりました。以後どの惑星にも行けなくなりましたが、" +
                "太陽系の外へ最も速く向かう機体になりました。",
            en: "On to Saturn without looking back — eighteen hours later it passes 184,000 km from " +
                "the planet's centre. The detour to Titan had bent the trajectory hard out of the " +
                "ecliptic plane. That ruled out any further planets, and made it the fastest thing " +
                "leaving the Solar System.",
          },
        },
        {
          // 実際に撮った構図: 40 au の彼方から振り返って地球を見る
          sel: "earth", ride: "earth", mag: 12, lit: false, apart: null, spot: "earth", orbits: false,
          d: "1990-02-14", play: false,
          text: {
            ja: "1990年2月14日、太陽から 40 au。カメラを切る前に振り返り、" +
                "自分が出てきた方を撮りました。地球は 0.12 ピクセルの淡い点 " +
                "— 「ペイル・ブルー・ドット」です。これがボイジャー1号から見た地球です。",
            en: "14 February 1990, 40 au from the Sun. Before its cameras were switched off it turned " +
                "around and photographed where it had come from. Earth came out as a pale dot " +
                "0.12 pixels across — the Pale Blue Dot. This is Earth as Voyager 1 sees it.",
          },
        },
        {
          sel: "voyager1", ride: null, mag: 1, spot: null, orbits: true, fit: 130, a: 0.9, y: 0.9,
          path: true, spd: 400, play: true, until: "2012-08-25",
          text: {
            ja: "そのまま外へ。2012年8月25日、太陽風が星間物質に押し返される境界 " +
                "— ヘリオポーズ — を越え、太陽から約121 au で星間空間に入りました。" +
                "電波が届くまで片道17時間かかります。",
            en: "Outward it goes. On 25 August 2012, at about 121 au, it crossed the heliopause where " +
                "the solar wind gives way to the interstellar medium. A radio signal now takes " +
                "17 hours to reach it.",
          },
        },
        {
          // 内側の道のり (地球→土星) と離脱方向の両方に直交する向きから見ると、
          // 経路全体がほぼ画面の平面に乗る
          sel: null, fit: 8, a: -0.95, y: 1.61, play: false, spot: null, mag: 1,
          d: "2012-08-25",
          text: {
            ja: "たどってきた道のりです。木星と土星ですれ違いざまに進路を曲げてもらい、" +
                "土星では黄道面を大きく外れて北へ抜けました。" +
                "この線は経由点を繋いだ近似で、実際の軌道そのものではありません。",
            en: "The route it took. Jupiter and Saturn each bent its path as it swept past, and " +
                "Saturn threw it far north out of the plane of the planets. The line is an " +
                "interpolation through the waypoints, not the true trajectory.",
          },
        },
      ],
    },
    {
      id: "voyager2",
      manual: true,
      probe: "voyager2",
      title: { ja: "ボイジャー2号の旅", en: "The Voyage of Voyager 2" },
      lead: {
        ja: "176年に一度の惑星配列を使い、木星・土星・天王星・海王星を続けて訪れた唯一の機体です。",
        en: "The only spacecraft to visit Jupiter, Saturn, Uranus and Neptune — riding an alignment that comes once in 176 years.",
      },
      steps: [
        {
          view: "space", sel: "earth", km: 115000, lit: true, apart: "voyager2", mag: 1,
          d: "1977-08-20T00:09", play: false, constel: false, spot: "voyager2",
          text: {
            ja: "1977年8月20日、ボイジャー2号は1号より16日早く打ち上げられました。" +
                "1970年代後半にだけ現れる4惑星の並びを使い、重力アシストを繋いで" +
                "外惑星を一筆書きで回る計画です。",
            en: "20 August 1977: Voyager 2 launches, sixteen days ahead of Voyager 1. The plan is to " +
                "chain gravity assists across an alignment of four giant planets that only occurs " +
                "in the late 1970s.",
          },
        },
        {
          sel: "voyager2", km: 1260000, lit: true, apart: "jupiter", play: false, spot: null,
          d: "1979-07-08T17:55",
          text: {
            ja: "1979年7月9日、木星。エウロパの氷の表面を初めて詳しく写し、" +
                "その下に海がある可能性を示しました。",
            en: "9 July 1979, Jupiter. It returned the first detailed images of Europa's icy shell — " +
                "and the first hints of an ocean beneath it.",
          },
        },
        {
          km: 1400000, lit: true, apart: "saturn", d: "1981-08-24T16:26",
          text: {
            ja: "1981年8月25日、土星。1号と違ってタイタンへは寄らず、" +
                "黄道面に残ったまま土星の重力で天王星へ向かいます。",
            en: "25 August 1981, Saturn. Unlike Voyager 1 it skips Titan, staying near the ecliptic " +
                "so Saturn's gravity can send it on to Uranus.",
          },
        },
        {
          km: 460000, lit: true, apart: "uranus", d: "1986-01-23T22:49",
          text: {
            ja: "1986年1月24日、天王星。横倒しの自転軸を持つこの惑星を訪れた" +
                "唯一の探査機です。10個の新しい衛星と2本の環を見つけました。",
            en: "24 January 1986, Uranus — the only spacecraft ever to visit the tipped-over planet. " +
                "It found ten new moons and two more rings.",
          },
        },
        {
          km: 440000, lit: true, apart: "neptune", d: "1989-08-24T22:54",
          text: {
            ja: "1989年8月25日、海王星。時速2000kmの風と大暗斑を捉え、" +
                "衛星トリトンでは窒素の間欠泉を発見しました。12年におよぶ惑星巡りの終点です。",
            en: "25 August 1989, Neptune. Winds of 2,000 km/h, the Great Dark Spot, and nitrogen " +
                "geysers on Triton. The end of a twelve-year tour of the planets.",
          },
        },
        {
          sel: "voyager2", fit: 130, a: 0.9, y: 0.9, spot: null,
          spd: 400, play: true, until: "2018-11-05",
          text: {
            ja: "海王星の重力で黄道面の下へ押し出され、そのまま南へ抜けていきます。" +
                "2018年11月5日、約119 au でヘリオポーズを越えました。" +
                "1号とはまったく違う方向へ、2機はいまも遠ざかり続けています。",
            en: "Neptune's gravity pushed it below the ecliptic, and south it went. On 5 November 2018, " +
                "at about 119 au, it too crossed the heliopause. The two Voyagers are still receding — " +
                "in completely different directions.",
          },
        },
      ],
    },
    {
      id: "cassini",
      manual: true,
      probe: "cassini",
      title: { ja: "カッシーニの土星", en: "Cassini at Saturn" },
      lead: {
        ja: "金星・地球・木星でスイングバイを重ねて土星へ。13年間の周回と、最後の突入までを辿ります。",
        en: "Swing past Venus, Earth and Jupiter to reach Saturn — then thirteen years in orbit, and a final plunge.",
      },
      steps: [
        {
          view: "space", sel: "earth", km: 115000, lit: true, apart: "cassini", mag: 1,
          d: "1997-10-15T00:08", play: false, constel: false, spot: "cassini",
          text: {
            ja: "1997年10月15日打ち上げ。5.7トンの探査機を土星まで直接送れるロケットは" +
                "当時なく、内側の惑星で重力アシストを重ねて速度を稼ぐ計画が組まれました。",
            en: "Launched 15 October 1997. No rocket of the day could send 5.7 tonnes straight to Saturn, " +
                "so the plan was to borrow speed from the inner planets instead.",
          },
        },
        {
          sel: null, fit: 1.7, a: 0.6, y: 0.9, spot: "cassini",
          spd: 6, play: true, until: "1999-08-18",
          text: {
            ja: "金星を2回、そして地球を1回かすめます。すれ違うたびに惑星の公転運動を" +
                "少しだけ借りて加速し、内側の太陽系で2年近くかけて外へ向かう勢いを溜めました。",
            en: "Twice past Venus, then once past Earth. Each pass borrows a little of the planet's " +
                "orbital motion, and over nearly two years in the inner Solar System it builds up " +
                "the speed to head outward.",
          },
        },
        {
          sel: "cassini", km: 1260000, lit: true, apart: "jupiter", play: false, spot: null,
          d: "2000-12-29T19:03",
          text: {
            ja: "2000年12月30日、木星。最後の重力アシストです。" +
                "このとき木星の周回軌道にはガリレオ探査機がいて、" +
                "通り過ぎるカッシーニと2機で同時に木星を観測しました。",
            en: "30 December 2000, Jupiter — the last gravity assist. Cassini observed the planet " +
                "alongside the Galileo orbiter already in Jovian orbit.",
          },
        },
        {
          km: 1400000, lit: true, apart: "saturn", d: "2004-06-30T16:26",
          text: {
            ja: "2004年7月1日、土星周回軌道へ投入。環の隙間を通り抜けながら逆噴射し、" +
                "土星の重力に捕まりました。打ち上げから6年9か月、35億kmの道のりでした。",
            en: "1 July 2004: orbit insertion. It threaded a gap in the rings, fired its engine, " +
                "and let Saturn capture it — six years nine months and 3.5 billion km after launch.",
          },
        },
        {
          sel: "titan", km: 40000, lit: true, d: "2005-01-14",
          text: {
            ja: "2005年1月14日、切り離された小型機ホイヘンスがタイタンの厚い大気を降下し、" +
                "地表に着陸しました。外惑星系での着陸はこれが唯一です。" +
                "液体メタンが流れた跡のある、石ころだらけの河原が写っていました。",
            en: "14 January 2005: the Huygens probe parachuted through Titan's thick atmosphere and " +
                "landed — still the only landing in the outer Solar System. It photographed a rounded, " +
                "pebble-strewn floodplain carved by liquid methane.",
          },
        },
        {
          sel: "saturn", km: 700000, lit: true, spd: 90, play: true, until: "2017-09-15",
          text: {
            ja: "13年の周回。エンケラドスの氷の裂け目から水が噴き出しているのを見つけ、" +
                "その海に生命の条件が揃っている可能性を示しました。" +
                "燃料が尽きる前に、その海を汚さないよう2017年9月15日に土星の大気へ突入 " +
                "— 最後の瞬間までデータを送り続けました。",
            en: "Thirteen years in orbit. It found water jetting from cracks in the ice of Enceladus, " +
                "and evidence that the ocean beneath could support life. Rather than risk contaminating " +
                "it once the fuel ran out, Cassini was steered into Saturn's atmosphere on " +
                "15 September 2017 — transmitting to the last second.",
          },
        },
      ],
    },
  ];

