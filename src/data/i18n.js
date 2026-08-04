  // ============================================================
  // 言語 (日/英)
  // ============================================================
  let lang = localStorage.getItem("ssLang") === "en" ? "en" : "ja";
  const UI = {
    ja: {
      title: "Sidereum (シデレウム β版) — 見上げる空から、太陽系の果てまで",
      betaTag: "(β版)",
      pause: "停止", play: "再生", speed: "速度", distance: "距離", angle: "角度",
      ctrlHide: "操作パネルを隠す", ctrlShow: "操作パネルを表示",
      orbits: "軌道", labels: "名前", constellations: "星座", reset: "全体表示",
      nowBtn: "現在時刻に合わせる", ratePrefix: "1秒 = ",
      viewTop: "真上", viewDef: "デフォルト", viewSide: "真横", camera: "カメラ",
      viewSpace: "宇宙", viewGround: "地上", viewMoon: "月面", gFovLabel: "ズーム", gAzLabel: "方位", gAltLabel: "高度",
      hint: "ドラッグで回転 ・ 右ドラッグ / 2本指で移動 ・ ホイール / ピンチでズーム (Shift+で距離) ・ 天体クリックで接近",
      hintGround: "ドラッグで見回す ・ ホイール / ピンチでズーム ・ 天体タップで選択・追尾",
      noGL: "お使いの環境では WebGL が利用できないため、<br>3D 表示を開始できませんでした。",
      imgPrefix: "画像: ", procTex: "テクスチャ: シェーダによる生成 (実写ではありません)",
      u: { yr: " 年", d: " 日", h: " 時間", min: " 分", s: " 秒" },
      menuLang: "English",
      menuHelp: "操作方法",
      menuTour: "ガイドツアー",
      tourStart: "はじめる", tourSteps: " シーン",
      tourNext: "次へ ▶", tourDone: "終了", tourAuto: "自動送り",
      tourResume: "シーンに戻す", tourExit: "ツアーを終了",
      tourGood: "できました", welcomeTour: "操作を試してみる",
      tourUpdated: "Update!", tourAgain: "もう一度見る", tagNew: "New",
      menuTerrain: "風景",
      menuBloom: "光の滲み",
      menuHiRes: "高解像度テクスチャ",
      menuAbout: "ライセンス・クレジット",
      menuUnitToMi: "距離をマイル表示",
      menuUnitToKm: "距離を km 表示",
      menuShare: "共有リンクをコピー",
      menuShareDone: "コピーしました",
      menuFs: "全画面表示",
      menuFsExit: "全画面を終了",
      menuNavHide: "天体リストを隠す",
      menuNavShow: "天体リストを表示",
      obs: {
        tabFacts: "基本情報", tabObs: "地球から見る",
        loc: "観測地", geo: "現在地", custom: "カスタム",
        N: "北", S: "南", E: "東", W: "西",
        az: "方位", alt: "高度", rise: "出", transit: "南中", set: "入",
        mag: "視等級", phase: "満ち欠け", size: "見かけの大きさ", elong: "太陽離角", dist: "地球からの距離",
        below: "地平線下", noRise: "昇らない", noSet: "沈まない", always: "沈まない",
        note: "※ 視等級・出没時刻は簡易計算による近似値です",
        earth: "地球は観測地点そのものです。ほかの天体を選ぶと、その天体の地球からの見え方を表示します。",
        seenIn: (dir, alt) => dir + "の空、高度 " + alt + "° に見えています",
        seenBelow: "いまは地平線の下にあり、見えません",
        dirs: ["北", "北東", "東", "南東", "南", "南西", "西", "北西"],
      },
    },
    en: {
      title: "Sidereum (Beta) — From tonight's sky to the edge of the Solar System",
      betaTag: "(Beta)",
      pause: "Pause", play: "Play", speed: "Speed", distance: "Distance", angle: "Angle",
      ctrlHide: "Hide controls", ctrlShow: "Show controls",
      orbits: "Orbits", labels: "Labels", constellations: "Consts", reset: "Overview",
      nowBtn: "Set to current time", ratePrefix: "1s = ",
      viewTop: "Top", viewDef: "Default", viewSide: "Side", camera: "Camera",
      viewSpace: "Space", viewGround: "Ground", viewMoon: "Moon", gFovLabel: "Zoom", gAzLabel: "Azimuth", gAltLabel: "Alt",
      hint: "Drag to rotate · Right-drag / two fingers to pan · Wheel / pinch to zoom (Shift for distance) · Click a body to approach",
      hintGround: "Drag to look around · Wheel / pinch to zoom · Tap a body to select & track",
      noGL: "WebGL is not available in this environment,<br>so the 3D view could not be started.",
      imgPrefix: "Imagery: ", procTex: "Texture: procedurally generated (not actual imagery)",
      u: { yr: " yr", d: " days", h: " hr", min: " min", s: " sec" },
      menuLang: "日本語",
      menuHelp: "Controls",
      menuTour: "Guided tour",
      tourStart: "Start", tourSteps: " scenes",
      tourNext: "Next ▶", tourDone: "Finish", tourAuto: "Auto",
      tourResume: "Reset view", tourExit: "Exit tour",
      tourGood: "Nice", welcomeTour: "Try the controls",
      tourUpdated: "Update!", tourAgain: "Watch again", tagNew: "New",
      menuTerrain: "Scenery",
      menuBloom: "Glow",
      menuHiRes: "High-res textures",
      menuAbout: "License & Credits",
      menuUnitToMi: "Distances in miles",
      menuUnitToKm: "Distances in km",
      menuShare: "Copy shareable link",
      menuShareDone: "Copied!",
      menuFs: "Fullscreen",
      menuFsExit: "Exit fullscreen",
      menuNavHide: "Hide body list",
      menuNavShow: "Show body list",
      obs: {
        tabFacts: "Facts", tabObs: "From Earth",
        loc: "Site", geo: "My location", custom: "Custom",
        N: "N", S: "S", E: "E", W: "W",
        az: "Azimuth", alt: "Altitude", rise: "Rise", transit: "Transit", set: "Set",
        mag: "Magnitude", phase: "Illumination", size: "Apparent size", elong: "Elongation", dist: "Distance from Earth",
        below: "below horizon", noRise: "never rises", noSet: "never sets", always: "never sets",
        note: "* Magnitude and rise/set times are approximate.",
        earth: "Earth is the observing site itself. Select another body to see how it appears from Earth.",
        seenIn: (dir, alt) => "In the " + dir + ", altitude " + alt + "°",
        seenBelow: "Currently below the horizon (not visible)",
        dirs: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
      },
    },
  };
  const T = () => UI[lang];
  for (const b of [SUN, ...PLANETS, ...SATELLITES, ...PROBES]) b.nameEn = b.en.charAt(0) + b.en.slice(1).toLowerCase();
  const bName = (b) => (lang === "ja" ? b.name : b.nameEn);

  // 情報パネルの英語データ
  const EN_DATA = {
    sun: {
      rows:[["Diameter","1,392,700 km"],["Mass","1.99×10³⁰ kg"],["Spectral type","G2V"],["Surface temp.","~5,500 ℃"],["Age","~4.6 billion yr"],["Share of system mass","99.86 %"]],
      fact:"The star holding more than 99.8% of the Solar System's mass. Its core fuses about 600 million tons of hydrogen into helium every second." },
    mercury: {
      rows:[["Diameter","4,879 km"],["Mass","3.30×10²³ kg"],["Mean distance","0.39 au"],["Orbital period","88.0 days"],["Rotation period","58.6 days"],["Mean temp.","167 ℃"],["Moons","0"]],
      fact:"With almost no atmosphere, days reach about 430℃ and nights drop to −180℃ — the most extreme temperature swings of any planet." },
    venus: {
      rows:[["Diameter","12,104 km"],["Mass","4.87×10²⁴ kg"],["Mean distance","0.72 au"],["Orbital period","224.7 days"],["Rotation period","243 days (retrograde)"],["Mean temp.","464 ℃"],["Moons","0"]],
      fact:"A runaway greenhouse effect from its thick CO₂ atmosphere makes it hotter than Mercury. It also spins in the opposite direction to the other planets." },
    earth: {
      rows:[["Diameter","12,742 km"],["Mass","5.97×10²⁴ kg"],["Mean distance","1.00 au"],["Orbital period","365.25 days"],["Rotation period","23.9 hours"],["Mean temp.","15 ℃"],["Moons","1 (Moon)"]],
      fact:"About 70% of the surface is covered by liquid water — the only world known to harbor life. Zoom in to see the Moon as well." },
    moon: {
      rows:[["Diameter","3,475 km"],["Mass","7.35×10²² kg"],["Distance from Earth","384,000 km"],["Orbital period","27.3 days"],["Rotation period","27.3 days (synchronous)"],["Mean temp.","−23 ℃"]],
      fact:"Earth's only natural satellite. Tidally locked, it always shows the same face to Earth." },
    mars: {
      rows:[["Diameter","6,779 km"],["Mass","6.42×10²³ kg"],["Mean distance","1.52 au"],["Orbital period","687.0 days"],["Rotation period","24.6 hours"],["Mean temp.","−63 ℃"],["Moons","2"]],
      fact:"The 'Red Planet', covered in iron-oxide dust. Home to Olympus Mons, the largest volcano in the Solar System (about 22 km high)." },
    jupiter: {
      rows:[["Diameter","139,820 km"],["Mass","1.90×10²⁷ kg"],["Mean distance","5.20 au"],["Orbital period","11.86 yr"],["Rotation period","9.9 hours"],["Mean temp.","−108 ℃"],["Moons","95+"]],
      fact:"The largest planet — more than twice as massive as all the others combined. The Great Red Spot is a storm that has raged for over 300 years." },
    saturn: {
      rows:[["Diameter","116,460 km"],["Mass","5.68×10²⁶ kg"],["Mean distance","9.55 au"],["Orbital period","29.4 yr"],["Rotation period","10.7 hours"],["Mean temp.","−139 ℃"],["Moons","270+"]],
      fact:"Famous for its magnificent rings of ice particles. Its mean density is lower than water — in theory, it would float." },
    uranus: {
      rows:[["Diameter","50,724 km"],["Mass","8.68×10²⁵ kg"],["Mean distance","19.2 au"],["Orbital period","84.0 yr"],["Rotation period","17.2 hours (retrograde)"],["Mean temp.","−197 ℃"],["Moons","28"]],
      fact:"Its axis is tilted about 98°, so it orbits the Sun on its side. Methane in the atmosphere absorbs red light, giving it a pale cyan hue." },
    neptune: {
      rows:[["Diameter","49,244 km"],["Mass","1.02×10²⁶ kg"],["Mean distance","30.1 au"],["Orbital period","164.8 yr"],["Rotation period","16.1 hours"],["Mean temp.","−201 ℃"],["Moons","16"]],
      fact:"The outermost planet, whose position was predicted by calculation before it was observed. Its winds exceed 500 m/s — the fastest in the Solar System." },
    pluto: {
      rows:[["Class","Dwarf planet"],["Diameter","2,377 km"],["Mass","1.31×10²² kg"],["Mean distance","39.5 au"],["Orbital period","248.0 yr"],["Rotation period","6.4 days (retrograde)"],["Mean temp.","−229 ℃"],["Moons","5 (incl. Charon)"]],
      fact:"Reclassified as a dwarf planet in 2006. Its eccentric orbit brought it inside Neptune's between 1979 and 1999. Home to the heart-shaped nitrogen-ice plain Sputnik Planitia." },
    ceres: {
      rows:[["Class","Dwarf planet (belt)"],["Diameter","939 km"],["Mass","9.4×10²⁰ kg"],["Mean distance","2.77 au"],["Orbital period","4.60 yr"],["Rotation period","9.1 hours"],["Mean temp.","−105 ℃"]],
      fact:"The largest body in the asteroid belt, holding about a third of its total mass. NASA's Dawn orbiter found bright salt deposits on its surface." },
    vesta: {
      rows:[["Class","Asteroid (#4)"],["Diameter","~525 km"],["Mass","2.6×10²⁰ kg"],["Mean distance","2.36 au"],["Orbital period","3.63 yr"],["Rotation period","5.3 hours"]],
      fact:"The second most massive body in the belt. About 5% of meteorites found on Earth (the HED meteorites) are believed to come from Vesta." },
    pallas: {
      rows:[["Class","Asteroid (#2)"],["Diameter","~512 km"],["Mean distance","2.77 au"],["Orbital period","4.62 yr"],["Inclination","34.8°"]],
      fact:"Discovered in 1802. Its orbit is tilted about 35° from the ecliptic — remarkably steep among the belt's major bodies." },
    juno: {
      rows:[["Class","Asteroid (#3)"],["Diameter","~247 km"],["Mean distance","2.67 au"],["Orbital period","4.36 yr"],["Eccentricity","0.26"]],
      fact:"Discovered in 1804, one of the historic 'big four' asteroids, on a notably eccentric orbit." },
    halley: {
      rows:[["Class","Periodic comet (1P)"],["Nucleus","~15×8 km"],["Perihelion","0.59 au"],["Aphelion","35.1 au"],["Orbital period","~75.3 yr"],["Inclination","162.3° (retrograde)"],["Last perihelion","Feb 1986"],["Next perihelion","c. 2061"]],
      fact:"The most famous periodic comet, returning roughly every 76 years on a retrograde, highly elongated orbit that reaches beyond Neptune. Note: because Jupiter and Saturn shift each return, the timing is matched to the actual perihelion passages (1835, 1910, 1986, 2061, 2134); dates past 2134 are extrapolated." },
    phobos: {
      rows:[["Diameter","~22 km"],["Orbital radius","9,376 km"],["Orbital period","7.66 hours"],["Rotation","synchronous"]],
      fact:"Orbits faster than Mars rotates, so it rises in the west and sets in the east. It is slowly spiraling inward and will eventually crash into Mars." },
    deimos: {
      rows:[["Diameter","~12 km"],["Orbital radius","23,463 km"],["Orbital period","30.3 hours"],["Rotation","synchronous"]],
      fact:"The small outer moon of Mars. Like Phobos, it is thought to be a captured asteroid." },
    io: {
      rows:[["Diameter","3,643 km"],["Orbital radius","421,800 km"],["Orbital period","1.77 days"],["Rotation","synchronous"]],
      fact:"The most volcanically active body in the Solar System, heated by Jupiter's immense tides — home to over 400 active volcanoes." },
    europa: {
      rows:[["Diameter","3,122 km"],["Orbital radius","671,100 km"],["Orbital period","3.55 days"],["Rotation","synchronous"]],
      fact:"A global ocean is believed to lie beneath its icy crust, making it one of the top candidates in the search for extraterrestrial life." },
    ganymede: {
      rows:[["Diameter","5,268 km"],["Orbital radius","1,070,400 km"],["Orbital period","7.15 days"],["Rotation","synchronous"]],
      fact:"The largest moon in the Solar System — bigger than the planet Mercury — and the only moon with its own magnetic field." },
    callisto: {
      rows:[["Diameter","4,821 km"],["Orbital radius","1,882,700 km"],["Orbital period","16.7 days"],["Rotation","synchronous"]],
      fact:"The outermost Galilean moon, and one of the most heavily cratered bodies in the Solar System." },
    titan: {
      rows:[["Diameter","5,150 km"],["Orbital radius","1,221,870 km"],["Orbital period","15.9 days"],["Rotation","synchronous"]],
      fact:"The only moon with a dense nitrogen atmosphere, with lakes and rivers of methane. The Huygens probe landed here in 2005." },
    miranda: {
      rows:[["Diameter","472 km"],["Orbital radius","129,900 km"],["Orbital period","1.41 days"],["Rotation","synchronous"]],
      fact:"A small moon with the 20 km Verona Rupes, the tallest cliff in the Solar System. Its patchwork terrain suggests it may have been broken apart and reassembled." },
    titania: {
      rows:[["Diameter","1,577 km"],["Orbital radius","435,910 km"],["Orbital period","8.71 days"],["Rotation","synchronous"]],
      fact:"The largest moon of Uranus, discovered by William Herschel in 1787. Its orbit is tipped on its side along with Uranus." },
    triton: {
      rows:[["Diameter","2,707 km"],["Orbital radius","354,759 km"],["Orbital period","5.88 days (retrograde)"],["Rotation","synchronous"]],
      fact:"The only large moon orbiting opposite to its planet's rotation. Thought to be a captured Kuiper-belt object, with active nitrogen geysers." },
    charon: {
      rows:[["Diameter","1,212 km"],["Orbital radius","19,591 km"],["Orbital period","6.39 days"],["Rotation","synchronous"]],
      fact:"About half the size of Pluto — a true binary system where both bodies face each other, with a barycenter outside Pluto itself." },
  };

  // テクスチャ出典 (載っていない天体はシェーダによる生成)
  const IMG_CREDIT = {
    mercury: "NASA/Johns Hopkins APL/Carnegie (MESSENGER)",
    venus: "NASA/JPL (Magellan)",
    earth: "NASA Earth Observatory (Blue Marble)",
    moon: "NASA/GSFC/Arizona State Univ. (LRO)",
    mars: "NASA/USGS (Viking)",
    jupiter: "NASA/JPL/Space Science Institute (Cassini)",
    pluto: "NASA/JHUAPL/SwRI (New Horizons)",
    ceres: "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn)",
    vesta: "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn)",
  };

