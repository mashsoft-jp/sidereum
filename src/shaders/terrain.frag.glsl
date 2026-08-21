
    varying vec3 vD;
    uniform vec3 uSun;      // 太陽方向 (地平フレーム [東, 天頂, -北])
    uniform float uMoon;    // 1 = 月面, 0 = 地上
    uniform float uDay;     // 昼夜係数 (0 = 夜, 1 = 昼)
    uniform float uSky;     // 1 = 空ドーム, 0 = 地面ドーム
    uniform float uOcc;     // 日食で隠されずに残っている太陽面の割合 (1 = 食なし)。
                            // 地上は uDay 側へ畳んであるので、ここで使うのは月面だけ

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 x) {
      vec2 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int k = 0; k < 5; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    // ボロノイ。x = 最近セル中心までの距離, y = そのセルの乱数 (クレーターの大小・有無に使う)
    vec2 vor(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      float best = 8.0, bid = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y));
          vec2 cc = i + o;
          vec2 c = o + vec2(hash(cc), hash(cc + vec2(17.3, 31.7)));
          float d = length(f - c);
          if (d < best) { best = d; bid = hash(cc + vec2(5.2, 9.1)); }
        }
      }
      return vec2(best, bid);
    }
    // クレーター1つぶんの陰影。セルごとに直径を変え、一部のセルには作らない
    float crater(vec2 v, float sun) {
      float rad = mix(0.13, 0.34, v.y);                  // セルごとの半径
      float on = smoothstep(0.18, 0.34, v.y);            // 小さすぎるセルは平地のまま
      float d = v.x / max(rad, 0.02);
      float rim = smoothstep(0.78, 1.0, d) * (1.0 - smoothstep(1.0, 1.35, d));
      float bowl = 1.0 - smoothstep(0.0, 0.85, d);
      return on * (0.95 * rim - 1.15 * bowl);
    }

    void main() {
      vec3 d = normalize(vD);

      if (uSky > 0.5) {
        // ---- 大気 (地球のみ)。色は天体のエアライトと共有 (skyDayColor) ----
        vec3 night = vec3(0.0036, 0.0045, 0.0082);   // 画面上の (0.015, 0.02, 0.045)
        gl_FragColor = vec4(tonemap(night * (1.0 - uDay) + skyDayColor(d, uSun, uDay)), 1.0);
        return;
      }

      // ---- 地面。視線を観測者の目線高さの地平面へ投影して遠近感を出す ----
      float dy = max(-d.y, 0.0007);
      float r = 1.7 / dy;                       // 交点までの水平距離 [m 相当]
      vec2 g = d.xz * r;                        // 地面座標
      float fade = 1.0 / (1.0 + r * 0.004);     // 遠いほど細部を潰す (エイリアス防止)

      vec3 col;
      if (uMoon > 0.5) {
        // 月面: レゴリスの粒状感 + 大小のクレーター
        float base = fbm(g * 0.13);
        float grain = fbm(g * 2.2) * fade;
        // 大小2層のクレーター (直径 約8m / 約2m。立った視点で形が分かるスケール)。
        // 遠方ほど fade で弱め、地平線付近のちらつき (エイリアス) を抑える
        float k1 = crater(vor(g * 0.12), uSun.y) * min(1.0, fade * 2.2);
        float k2 = crater(vor(g * 0.5), uSun.y) * fade;
        // 太陽が低いほどクレーターの陰影が強く出る (実際の月面写真と同じ)
        float relief = mix(1.5, 0.75, smoothstep(0.0, 0.5, uSun.y));
        float sh = 0.62 + 0.15 * base + 0.18 * grain + (0.30 * k1 + 0.16 * k2) * relief;
        col = srgbToLinear(vec3(0.56, 0.545, 0.52)) * clamp(sh, 0.04, 1.5);
        // 大気が無いので影は漆黒、日向はコントラストが強い
        float lit = smoothstep(-0.03, 0.06, uSun.y) * uOcc;
        col *= mix(0.04, 1.0, lit);
        col += vec3(0.0061, 0.0090, 0.0152) * (1.0 - lit);   // 地球照のうっすらした青み
      } else {
        // 地上: 土と草地のまだら
        float base = fbm(g * 0.05);
        float patch = fbm(g * 0.22 + 13.0);
        float grain = fbm(g * 1.1) * fade;
        vec3 soil = srgbToLinear(vec3(0.20, 0.17, 0.13));
        vec3 gras = srgbToLinear(vec3(0.13, 0.19, 0.11));
        col = mix(soil, gras, smoothstep(0.35, 0.65, patch));
        col *= 0.72 + 0.34 * base + 0.20 * grain;
        col *= mix(0.12, 1.0, uDay);                       // 夜は暗く、昼は明るく
        col = mix(col, col * vec3(1.25, 0.95, 0.78), (1.0 - smoothstep(0.0, 0.3, uSun.y)) * uDay * 0.7);
      }
      // 地上は大気で地平線へ向かって霞む。月面は大気が無いので霞ませず輪郭を鋭いままにする
      if (uMoon < 0.5) {
        vec3 haze = mix(vec3(0.0061, 0.0069, 0.0104),    // 画面上の (0.03, 0.035, 0.06)
                        vec3(0.0974, 0.1167, 0.1602),    //           (0.42, 0.47, 0.56)
                        uDay);
        col = mix(col, haze, 1.0 - smoothstep(0.0, 0.030, dy));
      }
      gl_FragColor = vec4(tonemap(col), 1.0);
    }