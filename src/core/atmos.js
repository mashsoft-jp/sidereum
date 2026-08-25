  // ============================================================
  // 大気の定数と、空の明るさ (スカラー)
  //
  // 定数は shaders/sky-color.glsl と共有する。GLSL 側の const は下の
  // ATM_GLSL を前置きして流し込むので、値の置き場所はここ1つだけ。
  //
  // skyZenithLum() は、その積分を「真上を向いた場合」に絞って JS で解いたもの。
  // 星の見え方・Bloom のしきい値・天体に乗せるエアライトの強さは、どれも
  // 「空がどれだけ明るいか」で決まる。以前はこれを太陽高度の一次式で置いて
  // いたが、それだと薄明が市民薄明 (−6.9°) で打ち切られ、東京では1時間ほど
  // 早く真っ暗になっていた。空の色を出しているのと同じ式から取れば、長さも
  // 曲がり方も勝手に合う。
  // ============================================================
  const ATM = {
    RG: 6360.0,        // 地表 [km]
    RA: 6420.0,        // 大気の上端 [km]
    HR: 8.0,           // レイリーのスケールハイト [km]
    HM: 1.2,           // ミーのスケールハイト [km]
    BR: [0.0058, 0.0135, 0.0331],   // レイリー散乱係数 [1/km]
    BM: 0.0040,        // ミー散乱係数 [1/km]
    G: 0.76,           // ミーの非対称因子 (前方散乱の強さ)
    SUN: 7.0,          // 太陽の強さ (画面の明るさ合わせ)
    MULT: 0.45,        // 多重散乱の近似 (地平の霞)
    // 本影へにじむ多重散乱。単散乱だけだと、視線上の大気がすべて地球の影に
    // 入った時点 (天頂で太陽高度 −8°) で薄明が終わってしまう。実際にそこから
    // 先を照らしているのは、まだ陽の当たっている上層で何度も散乱した光。
    // 影へ食い込んだ深さ [km] に対して指数で落とす — 減衰長 20km・強さ 0.05 で、
    // 天頂の明るさの落ち方が実際の薄明 (日没〜−12° で約4桁) とほぼ重なる
    SHADOW: 20.0,
    LEAK: 0.05,
  };
  const ATM_GLSL =
    "const float ATM_RG = " + ATM.RG.toFixed(1) + ";\n" +
    "const float ATM_RA = " + ATM.RA.toFixed(1) + ";\n" +
    "const float ATM_HR = " + ATM.HR.toFixed(1) + ";\n" +
    "const float ATM_HM = " + ATM.HM.toFixed(1) + ";\n" +
    "const vec3  ATM_BR = vec3(" + ATM.BR.map((v) => v.toFixed(4)).join(", ") + ");\n" +
    "const float ATM_BM = " + ATM.BM.toFixed(4) + ";\n" +
    "const float ATM_G  = " + ATM.G.toFixed(2) + ";\n" +
    "const float ATM_SUN = " + ATM.SUN.toFixed(1) + ";\n" +
    "const float ATM_MULT = " + ATM.MULT.toFixed(2) + ";\n" +
    "const float ATM_SHADOW = " + ATM.SHADOW.toFixed(1) + ";\n" +
    "const float ATM_LEAK = " + ATM.LEAK.toFixed(3) + ";\n";

  // 天頂の空の明るさ (満照のとき)。sy = 太陽の高度の正弦。
  // 視線が鉛直なので地面と交わらず、密度は高度そのままで決まる。色は要らない
  // ので緑の係数を代表値にした1本の値で解く
  function skyZenithLum(sy) {
    const o1 = ATM.RG + 0.5;                    // 観測者の地心距離 (高度 0.5km)
    const seg = (ATM.RA - o1) / 12;
    const cz = Math.sqrt(Math.max(1 - sy * sy, 0));
    let odR = 0, odM = 0, sR = 0, sM = 0, sMS = 0;
    for (let i = 0; i < 12; i++) {
      const py = o1 + seg * (i + 0.5), h = py - ATM.RG;
      const hr = Math.exp(-h / ATM.HR) * seg, hm = Math.exp(-h / ATM.HM) * seg;
      odR += hr; odM += hm;
      const sb = py * sy, d0 = py * cz;         // 太陽への光路の地心最接近距離
      if (sb < 0 && d0 < ATM.RG) {              // 手前で地球に遮られる = 本影
        sMS += Math.exp(-(ATM.BR[1] * odR + ATM.BM * 1.1 * odM)) * hr
             * Math.exp(-(ATM.RG - d0) / ATM.SHADOW) * ATM.LEAK;
        continue;
      }
      const tSun = -sb + Math.sqrt(Math.max(ATM.RA * ATM.RA - d0 * d0, 0));
      const sl = tSun / 4;
      let odRs = 0, odMs = 0;
      for (let j = 0; j < 4; j++) {
        const u = sl * (j + 0.5);
        const hs = Math.sqrt(py * py + 2 * py * sy * u + u * u) - ATM.RG;
        odRs += Math.exp(-hs / ATM.HR) * sl;
        odMs += Math.exp(-hs / ATM.HM) * sl;
      }
      const att = Math.exp(-(ATM.BR[1] * (odR + odRs) + ATM.BM * 1.1 * (odM + odMs)));
      sR += att * hr; sM += att * hm; sMS += att * hr;
    }
    const gg = ATM.G * ATM.G;
    const pR = 0.0596831 * (1 + sy * sy);
    const pM = 0.1193662 * ((1 - gg) * (1 + sy * sy)) /
               ((2 + gg) * Math.pow(Math.max(1 + gg - 2 * ATM.G * sy, 1e-4), 1.5));
    return (sR * ATM.BR[1] * pR + sM * ATM.BM * pM) * ATM.SUN
         + sMS * ATM.BR[1] * 0.0796 * ATM.MULT * ATM.SUN;
  }

  // 明るさ → 「空がどれだけ明るいか」0〜1。目は明るさの対数に反応するので
  // 対数で写す。上端は昼の空、下端は薄明が見えなくなるあたりの値で、
  // そのあいだ5桁ぶんで 1 → 0 になる
  const SKY_LUM_DAY = 3e-2, SKY_LUM_NIGHT = 3e-7;
  const SKY_LUM_LOG = Math.log10(SKY_LUM_DAY) - Math.log10(SKY_LUM_NIGHT);
  function skyLumToDay(L) {
    if (!(L > 0)) return 0;
    return Math.max(0, Math.min(1,
      (Math.log10(L) - Math.log10(SKY_LUM_NIGHT)) / SKY_LUM_LOG));
  }

  // 目の順応。空は日没から薄明の終わりまでに5桁ほど暗くなるが、画面が出せる
  // のは2桁ほどしかない。輝度をそのまま出すと市民薄明のうちに真っ黒になって
  // しまうので、暗いところほど感度を上げて描く。実際に目がしていることでも
  // ある — 薄明の空が「見えている」のは、瞳孔と網膜が開いているから
  const SKY_ADAPT_REF = 1.5e-2;   // これより暗くなったら感度を上げ始める
  const SKY_ADAPT_POW = 0.55;     // 上げ方 (0 = 上げない, 1 = 明るさを一定に保つ)
  const SKY_ADAPT_MAX = 300;      // 上げすぎると夜空にノイズだけが浮く
  function skyAdaptGain(L) {
    return Math.min(SKY_ADAPT_MAX,
      Math.max(1, Math.pow(SKY_ADAPT_REF / Math.max(L, 1e-12), SKY_ADAPT_POW)));
  }
