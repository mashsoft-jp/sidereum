  // ============================================================
  // 流星群
  // ============================================================
  // 母天体が軌道上に置いていった塵の帯を、地球が横切ると流星群になる。帯は
  // 何百年もかけて軌道一周ぶんに均されているので、地球がその交点を通る位置 —
  // すなわち極大の太陽黄経 λ☉ — は毎年ほぼ変わらない。日付ではなく λ☉ で
  // 持つのはこのため (閏年でも世紀をまたいでもずれない)。分点は J2000 で、
  // アプリの座標系と同じ。
  //
  //   ra/dec 放射点 (J2000) [度]       v    対地速度 [km/s]
  //   zhr    平年の天頂出現数 [個/時]   sl   極大の太陽黄経 [度]
  //   b      λ☉ 1°あたりの減り方。ZHR = zhr × 10^(−b·|Δλ☉|) で、
  //          2·log10(2)/b が半値全幅 [度] ≒ [日]。しぶんぎ座の b=2.2 は
  //          半値全幅 6時間、みずがめ座ηの b=0.08 は7日以上に相当する
  //   burst  当たり年の突発出現 (d: 極大 UTC, z: そのときの ZHR, h: 半値全幅[時間])。
  //          放出されて間もない塵は、まだ均されず細い帯 (ダストトレイル) の
  //          まま軌道上に残っている。そこを直撃した年だけ桁違いに降る
  //
  // ZHR は「放射点が天頂・空が理想的」という基準値で、実際の出現数はここから
  // 放射点の高度・月明かりで落とす (meteorRate)。
  const SHOWERS = [
    { key:"quadrantids", ja:"しぶんぎ座流星群", en:"Quadrantids",
      ra:230.1, dec:49.5, v:41, zhr:110, sl:283.15, b:2.2 },
    { key:"lyrids", ja:"こと座流星群", en:"Lyrids",
      ra:271.4, dec:33.6, v:49, zhr:18, sl:32.32, b:0.22 },
    { key:"etaaqr", ja:"みずがめ座η流星群", en:"Eta Aquariids",
      ra:338.0, dec:-1.0, v:66, zhr:50, sl:45.5, b:0.08 },
    { key:"perseids", ja:"ペルセウス座流星群", en:"Perseids",
      ra:48.2, dec:58.1, v:59, zhr:100, sl:140.0, b:0.2 },
    // りゅう座 (ジャコビニ) は放射点が夕方に高い珍しい群。平年は数個だが、
    // 母彗星 21P の軌道近くを通る年に突発する
    { key:"draconids", ja:"りゅう座流星群", en:"Draconids",
      ra:262.1, dec:54.0, v:20, zhr:5, sl:195.4, b:1.0,
      burst:[ { d:"1946-10-10T03:50", z:6000, h:1.0 },
              { d:"2011-10-08T20:00", z:300, h:1.5 } ] },
    { key:"orionids", ja:"オリオン座流星群", en:"Orionids",
      ra:95.2, dec:15.8, v:66, zhr:20, sl:208.0, b:0.12 },
    // しし座の突発は母彗星 55P の回帰 (33年) の前後に集中する。1966年の
    // 北米、1999年の中東・欧州、2001年の東アジアと、極大の時刻によって
    // 見えた地域が毎回入れ替わっている
    { key:"leonids", ja:"しし座流星群", en:"Leonids",
      ra:154.2, dec:21.6, v:71, zhr:15, sl:235.27, b:0.55,
      burst:[ { d:"1966-11-17T11:45", z:15000, h:0.7 },
              { d:"1999-11-18T02:02", z:3700, h:1.2 },
              { d:"2001-11-18T10:20", z:1600, h:1.6 },
              { d:"2001-11-18T18:15", z:3300, h:1.6 },
              { d:"2002-11-19T04:00", z:2600, h:1.4 },
              { d:"2002-11-19T10:47", z:2900, h:1.4 } ] },
    { key:"geminids", ja:"ふたご座流星群", en:"Geminids",
      ra:112.3, dec:32.5, v:35, zhr:120, sl:262.2, b:0.39 },
    { key:"ursids", ja:"こぐま座流星群", en:"Ursids",
      ra:217.0, dec:75.8, v:33, zhr:10, sl:270.7, b:0.9 },
  ];
  const SHOWER_BY_KEY = new Map(SHOWERS.map((s) => [s.key, s]));
  // 散在流星: どの群にも属さない背景。放射点を持たないので方向はばらばら
  const SPORADIC = { key:"sporadic", ja:"散在流星", en:"Sporadic", v:0, zhr:8 };

  {
    // 放射点をワールド単位方向へ (赤道 → 黄道 → ワールド。sky.js の dirW と同じ)
    const ce = Math.cos(23.4393 * DEG), se = Math.sin(23.4393 * DEG);
    for (const s of SHOWERS) {
      const ra = s.ra * DEG, dec = s.dec * DEG, cd = Math.cos(dec);
      const xq = cd * Math.cos(ra), yq = cd * Math.sin(ra), zq = Math.sin(dec);
      s.dirW = [xq, -yq * se + zq * ce, -(yq * ce + zq * se)];
      s.burstD = (s.burst || []).map((o) => ({ t: wayDays(o.d), z: o.z, h: o.h }));
      s.acc = 0;   // 出現の端数 (1を超えたぶんだけ流す)
    }
    SPORADIC.burstD = [];
    SPORADIC.acc = 0;
  }

  // 太陽黄経 [度]。地球の日心黄経 + 180 (world → 黄道は wEcl と同じ対応)
  function sunLonDeg() {
    const e = posW.get("earth");
    return ((Math.atan2(-e[2], e[0]) / DEG + 180) % 360 + 360) % 360;
  }

  // その日時の ZHR。平年ぶんと突発ぶんの大きいほうを採る
  function showerZhr(s, days, slDeg) {
    const dl = ((slDeg - s.sl + 540) % 360) - 180;
    let z = s.zhr * Math.pow(10, -s.b * Math.abs(dl));
    for (const o of s.burstD) {
      z = Math.max(z, o.z * Math.pow(2, -Math.abs((days - o.t) * 24) / (o.h * 0.5)));
    }
    return z;
  }
