
    varying vec3 vD;
    uniform vec3 uSun;      // 太陽方向 (地平フレーム [東, 天頂, -北])
    uniform float uMoon;    // 1 = 月面, 0 = 地上
    uniform float uDay;     // 直射日光の強さ (0 = 日が沈んでいる, 1 = 昼)。地面用
    uniform float uSkyF;    // 空の明るさ 0〜1 (core/atmos.js の積分から)
    uniform float uFlux;    // 空へ届いている太陽の光量 (日食で落ちる。0 = 大気なし)
    uniform float uSkyGain; // 目の順応 (暗い空ほど感度を上げる)
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
    float fbm(vec2 p, float footprint) {
      float v = 0.0, a = 0.5;
      for (int k = 0; k < 5; k++) {
        // 画素より細かな模様は平均値へ戻す。遠方の縞・カメラ移動時のちらつきを防ぐ。
        float resolved = 1.0 - smoothstep(0.25, 1.0, footprint);
        v += a * mix(0.5, noise(p), resolved);
        p *= 2.03; footprint *= 2.03; a *= 0.5;
      }
      return v;
    }
    float craterShape(float d) {
      float rim = smoothstep(0.78, 1.0, d) * (1.0 - smoothstep(1.0, 1.35, d));
      float bowl = 1.0 - smoothstep(0.0, 0.85, d);
      return 0.10 * rim - 0.42 * bowl;
    }
    // 高さと傾斜を返す。中心探しは一度だけ行い、放射方向の傾斜から法線を作る。
    vec3 crater(vec4 v) {
      float rad = mix(0.08, 0.23, v.y);
      float on = smoothstep(0.18, 0.34, v.y);
      float d = v.x / rad;
      float slope = (craterShape(d + 0.02) - craterShape(max(0.0, d - 0.02))) / (0.04 * rad);
      return vec3(craterShape(d), slope * v.zw / max(v.x, 1e-4)) * on;
    }

    // 中心はセルの内側、外縁も同じセル内へ収める。隣の輪郭とは交差させない。
    vec3 craterField(vec2 p) {
      vec2 cell = floor(p);
      vec2 center = vec2(0.34) + 0.32 * vec2(hash(cell), hash(cell + vec2(17.3, 31.7)));
      vec2 delta = fract(p) - center;
      float dist = length(delta), id = hash(cell + vec2(5.2, 9.1));
      // 最大外縁 0.23 × 1.37 < 0.34。セル境界で高さ・傾斜ともゼロになる。
      return crater(vec4(dist, id, delta));
    }

    void main() {
      vec3 d = normalize(vD);

      if (uSky > 0.5) {
        // ---- 大気 (地球のみ)。色は天体のエアライトと共有 (skyDayColor) ----
        vec3 night = vec3(0.0036, 0.0045, 0.0082);   // 画面上の (0.015, 0.02, 0.045)
        gl_FragColor = vec4(tonemap(night * (1.0 - uSkyF)
                                    + skyDayColor(d, uSun, uFlux) * uSkyGain), 1.0);
        return;
      }

      // ---- 地面。視線を観測者の目線高さの地平面へ投影して遠近感を出す ----
      float dy = max(-d.y, 0.0007);
      float r = 1.7 / dy;                       // 交点までの水平距離 [m 相当]
      vec2 g = d.xz * r;                        // 地面座標
      float footprint = r * 0.006;              // 微分拡張が無い端末の保守的な近似
#ifdef TERRAIN_DERIV
      footprint = max(length(dFdx(g)), length(dFdy(g)));
#endif
      float fade = 1.0 / (1.0 + r * 0.004);     // 遠いほど細部を潰す (エイリアス防止)

      vec3 col;
      if (uMoon > 0.5) {
        // 月面: レゴリスの粒状感 + 大小のクレーター
        float base = fbm(g * 0.13, footprint * 0.13);
        float grain = fbm(g * 2.2, footprint * 2.2) * fade;
        // 半径を変えた一層のクレーター。別スケールの輪郭を上乗せしない。
        // 遠方は画素サイズに合わせて弱め、地平線付近のちらつきを抑える
        vec3 k1 = craterField(g * 0.12) * (1.0 - smoothstep(0.3, 1.2, footprint * 0.12));
        vec2 slope = k1.yz * 0.12 * 0.30;
        vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
        float sh = 0.68 + 0.15 * base + 0.12 * grain;
        // 凹部をわずかに暗くし、縁の向きに応じた直射光で起伏を見せる。
        sh *= 1.0 + min(0.0, k1.x) * 0.3;
        col = srgbToLinear(vec3(0.56, 0.545, 0.52)) * sh;
        float lit = smoothstep(-0.03, 0.06, uSun.y) * uOcc;
        float direct = max(dot(normal, uSun), 0.0);
        col *= 0.025 + lit * direct * 1.15;
        col += vec3(0.0061, 0.0090, 0.0152) * (1.0 - lit);   // 地球照のうっすらした青み
      } else {
        // 地上: 土と草地のまだら
        float base = fbm(g * 0.05, footprint * 0.05);
        // patch は GLSL ES 3.00 の予約語 (?gl=2 で通らなくなる) なので使わない
        float mottle = fbm(g * 0.22 + 13.0, footprint * 0.22);
        float grain = fbm(g * 1.1, footprint * 1.1) * fade;
        vec3 soil = srgbToLinear(vec3(0.28, 0.25, 0.20));
        vec3 gras = srgbToLinear(vec3(0.22, 0.27, 0.15));
        col = mix(soil, gras, smoothstep(0.35, 0.65, mottle));
        col *= 0.72 + 0.34 * base + 0.20 * grain;
        col *= mix(0.12, 1.0, uDay);                       // 夜は暗く、昼は明るく
        col = mix(col, col * vec3(1.25, 0.95, 0.78), (1.0 - smoothstep(0.0, 0.3, uSun.y)) * uDay * 0.7);
      }
      // 遠景は地面の投影から独立した山並み。整数倍音で方位の継ぎ目を閉じる。
      float az = atan(d.x + 1e-7, -d.z);
      float mid = 0.003 + 0.004 * sin(az * 5.0 + 1.2) + 0.002 * sin(az * 11.0);
      float nearRidge = -0.012 + 0.006 * sin(az * 4.0 + 0.4) + 0.003 * sin(az * 9.0);
      if (uMoon < 0.5) {
        float twilight = (1.0 - smoothstep(-0.12, 0.25, uSun.y)) * uSkyF;
        float towardSun = pow(max(dot((vec3(d.x, 0.0, d.z) / max(length(d.xz), 1e-5)), uSun), 0.0), 4.0);
        vec3 haze = mix(vec3(0.004, 0.005, 0.009), vec3(0.075, 0.105, 0.14), uSkyF);
        haze = mix(haze, vec3(0.18, 0.085, 0.045), twilight * towardSun * 0.65);
        vec3 farHill = mix(vec3(0.002, 0.003, 0.005), vec3(0.035, 0.050, 0.060), uSkyF);
        vec3 midHill = mix(vec3(0.0015, 0.002, 0.003), vec3(0.024, 0.035, 0.025), uSkyF);
        float layer = smoothstep(mid - 0.0008, mid + 0.0008, d.y);
        vec3 hills = mix(midHill, mix(farHill, haze, 0.32), layer);
        // 手前ほど地面の色が残り、遠い稜線ほど空の色を帯びる。
        col = mix(col, haze, (1.0 - exp(-r * 0.00045)) * 0.45);
        col = mix(col, hills, smoothstep(nearRidge - 0.001, nearRidge + 0.001, d.y));
      } else {
        // 月面に霞は足さず、遠いクレーター縁を硬い明暗で残す。
        float face = 0.35 + 0.65 * max(dot(normalize(vec3(-d.x * 0.3, 1.0, -d.z * 0.3)), uSun), 0.0);
        vec3 ridge = vec3(0.10, 0.095, 0.087) * (0.025 + face * smoothstep(-0.03, 0.06, uSun.y) * uOcc);
        ridge += vec3(0.003, 0.004, 0.006) * (1.0 - smoothstep(-0.03, 0.06, uSun.y));
        col = mix(col, ridge, smoothstep(-0.009, 0.002, d.y));
      }
      gl_FragColor = vec4(tonemap(col), 1.0);
    }