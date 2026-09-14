
    varying float vR;      // 土星の平均半径を 1 とした環上の半径
    varying vec3 vW;
    uniform vec3 uAxis;    // 環面の法線 (= 土星の極方向)
    uniform vec3 uSun;     // 太陽の位置
    uniform vec3 uCam;     // カメラの位置
    uniform vec3 uCenter;  // 土星の中心
    uniform vec2 uRadii;   // 土星の赤道半径・極半径 (ワールド単位)
    uniform vec2 uRingR;   // プロファイルの参照範囲 (内径, 1/(外径-内径))
    uniform sampler2D uProfile;
    // 地上ビューの大気。本体 (body.frag) と対で扱う — 減光だけ掛けて
    // エアライトを足さないと、環だけが空に溶けずに浮く
    uniform vec3 uExt;     // 大気減光の透過率 (宇宙・月面では 1,1,1)
    uniform vec3 uAirSun;  // エアライト用の太陽方向
    uniform float uAirFlux, uAirGain;

    uniform float uKind; // 0: 土星、1: 天王星、2: 木星
    uniform float uSoft; // 1画素未満の細環を面積を保って平滑化
    float narrowRing(float radius, float width, float strength) {
      float w = sqrt(width * width + uSoft * uSoft);
      float d = (vR - radius) / w;
      return strength * width / w * exp(-0.5 * d * d);
    }
    void main() {
      // ---- 半径ごとの濃さと色 (実測プロファイル) ----
      vec4 prof = texture2D(uProfile, vec2((vR - uRingR.x) * uRingR.y, 0.5));
      float tau = -log(max(prof.a, 0.0015));      // 透過率 → 光学的厚さ
      // 実半径の配置を基にした鑑賞用の模式表現。幅と光量は可視性のため強調。
      // NASA Voyager: science.nasa.gov/photojournal/uranus-rings/
      // NASA Galileo: science.nasa.gov/photojournal/jupiters-main-ring-and-halo/
      if (uKind > 0.5 && uKind < 1.5) {
        tau = narrowRing(2.012, 0.004, 0.55)
            + narrowRing(1.902, 0.002, 0.20)
            + narrowRing(1.874, 0.002, 0.16)
            + narrowRing(1.858, 0.002, 0.12)
            + narrowRing(1.800, 0.003, 0.22)
            + narrowRing(1.763, 0.003, 0.20)
            + narrowRing(1.676, 0.002, 0.10)
            + narrowRing(1.663, 0.002, 0.08)
            + narrowRing(1.648, 0.002, 0.08);
        prof.rgb = vec3(0.42, 0.43, 0.44);
      } else if (uKind > 1.5) {
        // 木星の主環: 中心から約122,500〜129,000 km。外側は明瞭、内側は拡散。
        tau = 0.028 * smoothstep(1.745, 1.80, vR) * (1.0 - smoothstep(1.837, 1.849, vR));
        prof.rgb = vec3(0.46, 0.40, 0.34);
      }
      if (tau < (uKind < 0.5 ? 0.004 : 0.001)) discard;                   // 間隙は完全に素通し

      vec3 L = normalize(uSun - vW);
      vec3 V = normalize(uCam - vW);
      float ca = dot(uAxis, L), cv = dot(uAxis, V);
      float mu0 = max(abs(ca), 0.02);             // 太陽と環面のなす角
      float mu = max(abs(cv), 0.02);              // 視線と環面のなす角

      // ---- 土星本体が環へ落とす影 ----
      // 環の点から太陽へ伸ばした線が回転楕円体と交わるかを解く。極方向と
      // 赤道方向をそれぞれの半径で割ると単位球になるので、あとは球との交差判定
      float shadow = 1.0;
      {
        vec3 o = vW - uCenter;
        float oa = dot(o, uAxis), da = dot(L, uAxis);
        vec3 O = (o - uAxis * oa) / uRadii.x + uAxis * (oa / uRadii.y);
        vec3 D = (L - uAxis * da) / uRadii.x + uAxis * (da / uRadii.y);
        float b = dot(O, D);
        if (b < 0.0) {                            // 太陽の方へ近づいていく場合だけ
          float miss = dot(O, O) - b * b / dot(D, D);   // 最接近距離² (球の半径 = 1)
          // 影の縁を締め、影の中も環の構造がわずかに読める明るさを残す。
          shadow = mix(0.12, 1.0, smoothstep(0.985, 1.015, miss));
        }
      }

      // ---- 単散乱 ----
      // 明るい側から見ているか、影の側から透かして見ているかで式が変わる。
      // 透かすと濃いB環が暗く、薄いC環やカッシーニの間隙が明るくなる
      // (実際の逆光の写真と同じ反転が起きる)
      float I;
      if (ca * cv > 0.0) {
        I = mu0 / (mu + mu0) * (1.0 - exp(-tau * (1.0 / mu + 1.0 / mu0)));
      } else {
        float dm = mu0 - mu;
        I = abs(dm) < 0.002
          ? (tau / mu) * exp(-tau / mu)
          : mu0 / dm * (exp(-tau / mu0) - exp(-tau / mu));
      }
      I = max(I, 0.0) * shadow;

      float alpha = 1.0 - exp(-tau / mu);         // 背景をどれだけ隠すか
      // 影の中でも真っ黒にはならない (土星本体からの照り返し)。
      // プロファイルの色だけ sRGB なのでリニアへ戻す (a の透過率はリニア値)
      vec3 c = srgbToLinear(prof.rgb) * (I * 1.3 + 0.010 * alpha);
      // 大気減光は「環から届く光」に、エアライトは「環と目のあいだの大気」に。
      // エアライトへ alpha を掛けるのは、背景の空を隠したぶんだけ足し戻す
      // ため (乗算済みアルファ。隠していない画素の空はそのまま背後に残る)
      c = c * uExt + skyDayColor(normalize(vW), uAirSun, uAirFlux) * uAirGain * alpha;
      // c は透過率込みの光。非線形のトーンマップ後に乗算済みアルファへ戻す。
      // 先に alpha を掛けたまま変換すると、薄い C 環まで白く浮いてしまう。
      // 薄い環を真横から見るときは、サブピクセルの破線が目立たないよう消す。
      float edgeFade = uKind > 0.5 ? smoothstep(0.008, 0.045, abs(cv)) : 1.0;
      gl_FragColor = vec4(tonemap(c / max(alpha, 1e-4)) * alpha, alpha) * edgeFade;
    }
