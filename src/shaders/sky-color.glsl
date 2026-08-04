
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
    // 散乱係数と太陽の強さだけで決まる
    const float ATM_RG = 6360.0;                  // 地表 [km]
    const float ATM_RA = 6420.0;                  // 大気の上端 [km]
    const float ATM_HR = 8.0;                     // レイリーのスケールハイト [km]
    const float ATM_HM = 1.2;                     // ミーのスケールハイト [km]
    const vec3  ATM_BR = vec3(0.0058, 0.0135, 0.0331);   // レイリー散乱係数 [1/km]
    const float ATM_BM = 0.0040;                  // ミー散乱係数 [1/km]
    const float ATM_G  = 0.76;                    // ミーの非対称因子 (前方散乱の強さ)
    const float ATM_SUN = 9.0;                    // 太陽の強さ (画面の明るさ合わせ)
    const float ATM_MULT = 0.55;                   // 多重散乱の近似 (地平の霞)

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

    vec3 skyDayColor(vec3 d, vec3 s, float day) {
      // 宇宙ビュー (day = 0) では大気が無い。GLSL は遅延評価しないので、
      // ここで抜けないと天体の画素すべてで積分を回すことになる
      if (day <= 0.001) return vec3(0.0);

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
      vec3 sumR = vec3(0.0), sumM = vec3(0.0);

      for (int i = 0; i < VIEW_N; i++) {
        vec3 p = o + d * (segLen * (float(i) + 0.5));
        float h = length(p) - ATM_RG;
        float hr = exp(-h / ATM_HR) * segLen;
        float hm = exp(-h / ATM_HM) * segLen;
        odR += hr;
        odM += hm;

        // この点から太陽へ。地球に遮られていれば陽は当たらない
        // (これが地球の影 = 日没後に空が下から暗くなる理由になる)
        vec2 sg = atmSphere(p, sun, ATM_RG);
        if (sg.x < sg.y && sg.y > 0.0) continue;

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
      c += sumR * ATM_BR * 0.0796 * ATM_MULT * ATM_SUN;   // 1/(4π) = 等方
      return c * day;
    }
