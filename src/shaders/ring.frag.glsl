
    varying float vR;      // 土星の平均半径を 1 とした環上の半径
    varying vec3 vW;
    uniform vec3 uAxis;    // 環面の法線 (= 土星の極方向)
    uniform vec3 uSun;     // 太陽の位置
    uniform vec3 uCam;     // カメラの位置
    uniform vec3 uCenter;  // 土星の中心
    uniform vec2 uRadii;   // 土星の赤道半径・極半径 (ワールド単位)
    uniform vec2 uRingR;   // プロファイルの参照範囲 (内径, 1/(外径-内径))
    uniform sampler2D uProfile;

    void main() {
      // ---- 半径ごとの濃さと色 (実測プロファイル) ----
      vec4 prof = texture2D(uProfile, vec2((vR - uRingR.x) * uRingR.y, 0.5));
      float tau = -log(max(prof.a, 0.0015));      // 透過率 → 光学的厚さ
      if (tau < 0.004) discard;                   // 間隙は完全に素通し

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
          // 実際はほぼ真っ黒になるが、それだと環の構造が読めなくなる。
          // 影と分かる程度に落として、3割の明るさを残す (見やすさを優先)
          shadow = mix(0.30, 1.0, smoothstep(0.90, 1.10, miss));
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
      // 影の中でも真っ黒にはならない (土星本体からの照り返し)
      vec3 c = prof.rgb * (I * 1.9 + 0.012 * alpha);
      gl_FragColor = vec4(c, alpha);
    }
