
    // 昼の空の色 (地上ビュー)。空ドームと、天体に上乗せする大気の光 (エアライト)
    // で同じ式を使うため切り出してある。
    //   d = 視線方向 (地平フレーム [東, 天頂, -北])  s = 太陽方向  day = 昼夜係数
    //
    // 大気散乱 (単散乱) を視線に沿って積分する。以前は色を手で置いていたが、
    // 「夕焼けは地平に沿った帯」「沈む太陽は赤い」といった性質をいちいち手で
    // 作り込むことになり、しかも中間の時刻で嘘が出た。散乱を解けばどれも
    // 式から出てくる。
    //
    //   レイリー散乱 … 空気分子。断面積が波長の4乗に反比例するので青が強い。
    //                  太陽が低いと光路が延び、青が散乱しきって赤だけ残る = 夕焼け
    //   ミー散乱     … エアロゾル。波長依存が弱く前方に強い = 太陽まわりの白い暈
    //
    // 地球を球として扱うので、光路長が高度で正しく延びる。平行平面の近似だと
    // 日の入りぎわで発散して破綻する。
    //
    // 返すのはリニアの放射輝度 (呼び出し側で tonemap する)。色定数は無い —
    // 散乱係数と太陽の強さだけで決まる。
    // ATM_* の定数は core/atmos.js から前置きされる (JS 側でも同じ積分を天頂に
    // ついてだけ解いており、値を2箇所に持たないため)

    // 中心 (地球の中心) を原点とする球と ray の交点。手前の解と奥の解を返す。
    // 交わらないときは x > y になる
    vec2 atmSphere(vec3 o, vec3 d, float r) {
      float b = dot(o, d);
      float c = dot(o, o) - r * r;
      float disc = b * b - c;
      if (disc < 0.0) return vec2(1.0, -1.0);
      float sq = sqrt(disc);
      return vec2(-b - sq, -b + sq);
    }

    // flux = 届いている太陽の光量 (1 = 満照、0 = 大気が無い/積分しない)。
    // 単散乱は入射光量に比例するので、最後に掛けるだけで日食の暗転になる
    vec3 skyDayColor(vec3 d, vec3 s, float flux) {
      // 宇宙ビュー・月面 (flux = 0) では大気が無い。GLSL は遅延評価しないので、
      // ここで抜けないと天体の画素すべてで積分を回すことになる
      if (flux <= 0.0005) return vec3(0.0);

      vec3 sun = normalize(s);
      vec3 o = vec3(0.0, ATM_RG + 0.5, 0.0);      // 観測者 (高度 0.5km ≒ 地表)

      // 視線が大気を抜けるまで。地面に当たるならそこで打ち切る
      // (地平線より下を向いたときのエアライトが空と同じ明るさにならないように)
      float tMax = atmSphere(o, d, ATM_RA).y;
      if (tMax <= 0.0) return vec3(0.0);
      vec2 g = atmSphere(o, d, ATM_RG);
      if (g.x < g.y && g.x > 0.0) tMax = min(tMax, g.x);

      const int VIEW_N = 12;
      const int SUN_N = 4;
      float segLen = tMax / float(VIEW_N);
      float odR = 0.0, odM = 0.0;                 // 視線に沿った光学的厚さ
      vec3 sumR = vec3(0.0), sumM = vec3(0.0), sumMS = vec3(0.0);

      for (int i = 0; i < VIEW_N; i++) {
        vec3 p = o + d * (segLen * (float(i) + 0.5));
        float h = length(p) - ATM_RG;
        float hr = exp(-h / ATM_HR) * segLen;
        float hm = exp(-h / ATM_HM) * segLen;
        odR += hr;
        odM += hm;

        // この点から太陽へ。地球に遮られていれば直射は当たらない
        // (これが地球の影 = 日没後に空が下から暗くなる理由になる)
        float sb = dot(p, sun);
        float d0 = sqrt(max(dot(p, p) - sb * sb, 0.0));   // 光路の地心最接近距離
        if (sb < 0.0 && d0 < ATM_RG) {
          // 本影の中。直射は届かないが、まだ陽の当たっている上層で何度も
          // 散乱した光がにじみ込む。これが無いと、視線上の大気がすべて影に
          // 入った時点 (天頂で太陽高度 −8°) で薄明が終わってしまう。
          // 影へ食い込んだ深さで指数的に落とす (行きの減衰は使えない —
          // 光はその光路を通ってきていない)
          sumMS += exp(-(ATM_BR.g * odR + ATM_BM * 1.1 * odM)) * hr
                 * exp(-(ATM_RG - d0) / ATM_SHADOW) * ATM_LEAK;
          continue;
        }

        float tSun = atmSphere(p, sun, ATM_RA).y;
        float sLen = tSun / float(SUN_N);
        float odRs = 0.0, odMs = 0.0;
        for (int j = 0; j < SUN_N; j++) {
          vec3 q = p + sun * (sLen * (float(j) + 0.5));
          float hs = length(q) - ATM_RG;
          odRs += exp(-hs / ATM_HR) * sLen;
          odMs += exp(-hs / ATM_HM) * sLen;
        }
        // 行き (太陽 → 散乱点) と帰り (散乱点 → 目) の減衰。
        // ミーの消散はおよそ散乱の 1.1倍 (吸収ぶん)
        vec3 att = exp(-(ATM_BR * (odR + odRs) + ATM_BM * 1.1 * (odM + odMs)));
        sumR += att * hr;
        sumM += att * hm;
        // 多重散乱ぶんの積算。減衰を「灰色」で掛けるのが要点。
        //   - 単散乱と同じ波長ごとの減衰を掛けると、同じだけ赤くなって
        //     「青を戻す」働きをしない (地平がいつ見ても黄色くなる)
        //   - かといって減衰を弱めると、飽和する光路長が遠のいて白む範囲が
        //     空の高いところまで伸びる (実際の白い帯は地平から10度ほど)
        // 波長依存だけ外し、厚みは本来のまま (緑の係数を代表値に) 積む。
        // 色は掛け先の ATM_BR が青寄りなので、単散乱の黄色を打ち消して白くなる
        float attG = exp(-(ATM_BR.g * (odR + odRs) + ATM_BM * 1.1 * (odM + odMs)));
        sumMS += attG * hr;
      }

      // 位相関数 (散乱角ごとの配分)
      float mu = dot(d, sun);
      float pR = 0.0596831 * (1.0 + mu * mu);     // 3/(16π)
      float gg = ATM_G * ATM_G;
      float pM = 0.1193662 * ((1.0 - gg) * (1.0 + mu * mu)) /
                 ((2.0 + gg) * pow(max(1.0 + gg - 2.0 * ATM_G * mu, 1e-4), 1.5));

      vec3 c = (sumR * ATM_BR * pR + sumM * ATM_BM * pM) * ATM_SUN;
      // 多重散乱の近似。単散乱だけだと地平がいつも金色に寄る — 実際は何度も
      // 散乱した光が青を戻し、昼の地平は白っぽい霞になる。きちんと解くには
      // 事前計算テーブルが要るので、単散乱と同じ形の等方成分を足して代える
      c += sumMS * ATM_BR * 0.0796 * ATM_MULT * ATM_SUN;   // 1/(4π) = 等方
      return c * flux;
    }
