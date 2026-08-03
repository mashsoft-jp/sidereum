
    varying vec3 vL, vW, vN;
    uniform float uType, uTime, uHasTex, uComet, uAmb;
    uniform vec3 uCam, uSun, uColA, uColB, uColC, uRim;
    uniform vec3 uAirSun;   // 大気の光の計算に使う太陽方向 (地平フレーム)
    uniform float uAirDay;  // 昼夜係数。宇宙ビューは 0 (大気が無い)
    uniform vec4 uParams;
    uniform sampler2D uTex;
    uniform mat4 uModel;        // 中心・極方向・スケールを取り出すのに使う
    uniform float uRingOn;      // 環を持つ天体 (土星) だけ 1
    uniform vec2 uRingR;        // 環プロファイルの参照範囲 (内径, 1/(外径-内径))
    uniform sampler2D uRing;
    uniform sampler2D uCloud;   // 地球の雲 (被覆率。グレースケール)
    uniform sampler2D uNight;   // 地球の夜景 (街灯りの強さ。グレースケール)
    uniform float uCloudRot;    // 雲の経度オフセット。地表と別に流すため

    float hash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
        f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int k = 0; k < 5; k++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 p = normalize(vL);
      vec3 N = normalize(vN);
      vec3 V = normalize(uCam - vW);

      if (uType < 0.5) {
        // ---- 太陽 ----
        // 光球は照らされる面ではなく自発光なので、アルベドではなく放射輝度を直に
        // 置く。赤だけトーンマップの肩を大きく超えさせるのがコツで、そうしないと
        // ACES が彩度を落として白い円盤になる (実際に露出過多の太陽は白く写る)。
        // ここの2色は、従来の見た目 (画面上の (0.99,0.72,0.26) と (1.0,0.94,0.66))
        // をトーンマップ後に再現するリニア値
        vec3 cA = vec3(3.729, 0.291, 0.050);
        vec3 cB = vec3(8.000, 1.239, 0.230);
        float n = fbm(p * 4.0 + vec3(0.0, uTime * 0.05, uTime * 0.02));
        float g = noise(p * 22.0 + uTime * 0.25);
        vec3 c = mix(cA, cB, smoothstep(0.2, 0.85, n + g * 0.18));
        float mu = max(dot(N, V), 0.0);
        c *= 0.22 + 0.78 * mu;                     // 周縁減光
        c += cB * pow(1.0 - mu, 2.0) * 0.35;       // 縁の輝き
        gl_FragColor = vec4(tonemap(c), 1.0);
        return;
      }

      vec3 L = normalize(uSun - vW);                // 光源 = 太陽 (カメラ相対座標)
      float dif = max(dot(N, L), 0.0);

      // ---- 環が本体へ落とす影 (土星のみ) ----
      // 地表の点から太陽へ線を伸ばし、環面 (赤道面) との交点の半径を求めて、
      // その半径の透過率で日射を弱める。斜めに抜けるぶん経路長は 1/|cos| 倍
      if (uRingOn > 0.5 && dif > 0.0) {
        vec3 ctr = uModel[3].xyz;                   // 天体の中心
        vec3 axis = normalize(uModel[1].xyz);       // 自転軸 = 環面の法線
        float scl = length(uModel[0].xyz);          // ワールド単位での平均半径
        vec3 P = vW - ctr;
        float pa = dot(P, axis), la = dot(L, axis);
        if (abs(la) > 0.002) {
          float t = -pa / la;                       // 環面まで太陽方向に伸ばす長さ
          if (t > 0.0) {
            float u = (length(P + L * t) / scl - uRingR.x) * uRingR.y;
            if (u > 0.0 && u < 1.0) {
              float tr = texture2D(uRing, vec2(u, 0.5)).a;
              // 環と同じく、影は真っ黒にせず 3割の明るさを残す。B環の影は
              // 実際にはほぼ完全な暗黒だが、雲の模様が見えなくなってしまう
              dif *= mix(0.30, 1.0, pow(max(tr, 0.0015), 1.0 / abs(la)));
            }
          }
        }
      }
      float lat = p.y;
      // アルベドは以降すべてリニア。uColA/B/C・uRim・uAmb は CPU 側で変換済み、
      // テクスチャと即値だけここで戻す
      vec3 alb = vec3(0.5);
      float spec = 0.0;
      // 地球だけ、地表のあとに雲・夜景・大気を重ねる。そのぶんの持ち回り
      float isEarth = step(3.5, uType) * step(uType, 4.5) * uHasTex;
      float cloud = 0.0;
      vec2 uv = vec2(0.0);

      if (uComet > 0.5) {
        // ---- 彗星核: 自発光しない、煤と有機物に覆われた非常に暗い表面 ----
        float rock = fbm(p * 6.0 + 2.0);
        float pits = fbm(p * 18.0 - 4.0);
        alb = mix(vec3(0.00310, 0.00334, 0.00359),    // sRGB (0.040,0.043,0.046)
                  vec3(0.04696, 0.03157, 0.01848), rock);  //      (0.240,0.195,0.145)
        alb *= 0.58 + 0.52 * smoothstep(0.28, 0.76, pits);
      } else if (uHasTex > 0.5) {
        // ---- 実テクスチャ (NASA/USGS 全球マップ) ----
        uv = vec2(0.5 - atan(p.z, p.x) / 6.2831853,
                  acos(clamp(p.y, -1.0, 1.0)) / 3.14159265);
#ifdef TEXLOD
        // 経度は継ぎ目 (atan の折り返し) で 1→0 に飛ぶ。そのままだと継ぎ目を
        // またぐ画素の微分が 1周ぶんになり、ミップ段が最粗まで落ちて縦縞が出る。
        // 連続な p の微分から連鎖律で uv の微分を出し、折り返しを避けて渡す
        vec3 px = dFdx(p), py = dFdy(p);
        float r2 = max(p.x * p.x + p.z * p.z, 1e-8);                // ∂atan の分母
        float sv = 3.14159265 * sqrt(max(1.0 - p.y * p.y, 1e-8));   // ∂acos の分母
        vec2 dux = vec2(-(p.x * px.z - p.z * px.x) / (r2 * 6.2831853), -px.y / sv);
        vec2 duy = vec2(-(p.x * py.z - p.z * py.x) / (r2 * 6.2831853), -py.y / sv);
        alb = srgbToLinear(texture2DGradEXT(uTex, uv, dux, duy).rgb);
#else
        alb = srgbToLinear(texture2D(uTex, uv).rgb);
#endif
        if (uType > 3.5 && uType < 4.5) {
          // ---- 地球: 雲・雲の影・海面の反射 ----
          // 雲は地表とは別に、ゆっくり東へ流す
          vec2 cuv = vec2(fract(uv.x + uCloudRot), uv.y);
          cloud = texture2D(uCloud, cuv).r;

          // 雲が地表へ落とす影。雲層は地表より CLOUD_H だけ高いので、地表の点から
          // 太陽へ伸ばした線が雲層を横切る位置は接平面方向へ CLOUD_H/cosθ ずれる。
          // 太陽が低いほど影が長く伸びる (朝夕の斜光と同じ)
          float ndl = max(dot(p, L), 0.08);
          vec3 Lt = L - p * dot(L, p);                        // 太陽方向の接平面成分
          vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), p));
          vec3 north = cross(p, east);
          float k = 0.0016 / ndl;                             // 弧長 (地球半径 = 1)
          float cosLat = max(sqrt(max(1.0 - p.y * p.y, 0.0)), 0.15);
          vec2 suv = vec2(fract(cuv.x + dot(Lt, east) * k / cosLat / 6.2831853),
                          clamp(cuv.y - dot(Lt, north) * k / 3.14159265, 0.0, 1.0));
          alb *= 1.0 - 0.55 * texture2D(uCloud, suv).r;

          // 海面。雲より先に、地表の色が青く偏っているかで判定する
          float ocean = smoothstep(0.004, 0.03, alb.b - alb.r) * smoothstep(0.004, 0.03, alb.b - alb.g);
          spec = pow(max(dot(reflect(-L, N), V), 0.0), 60.0) * ocean * (1.0 - cloud) * 1.1;

          alb = mix(alb, vec3(0.90), cloud);
        }
      } else if (uType < 1.5) {
        // ---- 岩石 (テクスチャ無し小天体) ----
        float m = fbm(p * 5.0);
        float cr = fbm(p * 16.0 + 5.0);
        alb = mix(uColB, uColA, m);
        alb *= 0.82 + 0.36 * smoothstep(0.35, 0.75, cr);
      } else if (uType < 2.5) {
        // ---- 火星 ----
        alb = mix(uColA, uColB, fbm(p * 4.0));
        alb *= 0.8 + 0.4 * fbm(p * 9.0 + 2.0);
        alb = mix(alb, vec3(0.84809, 0.86890, 0.89001),   // sRGB (0.93,0.94,0.95)
                  smoothstep(0.84, 0.92, abs(lat) + 0.05 * fbm(p * 6.0)));
      } else if (uType < 3.5) {
        // ---- 金星 (雲) ----
        float sw = fbm(vec3(p.x * 2.2, p.y * 6.5, p.z * 2.2) + vec3(uTime * 0.02, 0.0, 0.0));
        alb = mix(uColA, uColB, sw);
      } else {
        // ---- ガス惑星 / 氷惑星 ----
        float d = fbm(p * vec3(3.0, 8.0, 3.0)) * uParams.y;
        float band = sin(lat * uParams.x * 3.14159 + d * 4.0) * 0.5 + 0.5;
        alb = mix(uColA, uColB, band);
        alb = mix(alb, uColC, smoothstep(0.62, 0.95, fbm(p * vec3(2.0, 9.0, 2.0) + 7.0)) * 0.4);
        if (uParams.z > 0.5) {
          // 大赤斑
          float sd = distance(p, normalize(vec3(0.78, -0.32, 0.53)));
          alb = mix(vec3(0.46236, 0.07324, 0.02721),      // sRGB (0.71,0.30,0.18)
                    alb, smoothstep(0.07, 0.17, sd));
        }
      }

      // 昼の空では、光が当たっていない側はエアライトに埋もれて見えない。
      // 環境光とリム光の「光が当たっていないぶん」を落として空に溶け込ませる
      float dayFade = 1.0 - 0.92 * uAirDay;
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
      alb += uRim * fres * (0.25 * dayFade + 0.75 * dif) * 0.55;

      // uAmb = 夜側の明るさ。呼び出し側が見かけの大きさから決める。点にしか
      // 見えない遠くの天体は見失わないよう明るく、円盤として分解できる大きさ
      // では暗くして満ち欠けを見せる。昼側の明るさは uAmb によらず一定に保つ
      float ambient = uAmb * dayFade;
      float direct = mix(1.0, 1.03, uComet) - ambient;
      vec3 c = alb * (ambient + dif * direct) + vec3(spec) * dif;

      if (isEarth > 0.5) {
        float ndl = dot(N, L);
        // ---- 大気 ----
        // 縁ほど大気を長く見通すので青みが強い。太陽が向こう側にあるとき
        // (視線と太陽が同じ側 = 前方散乱) は明け方の空のように暖色へ振れる
        float limb = pow(1.0 - max(dot(N, V), 0.0), 3.2);
        float fwd = pow(max(dot(-V, L), 0.0), 6.0);
        vec3 air = mix(vec3(0.052, 0.135, 0.360),    // レイリー (青)
                       vec3(0.420, 0.180, 0.070),    // 前方散乱 (夕焼け色)
                       fwd * 0.75);
        c += air * limb * smoothstep(-0.28, 0.22, ndl) * (1.0 - uAirDay);

        // ---- 夜景 ----
        // 昼夜境界の内側だけ。雲の下は遮られ、地上ビューの昼空では見えない
        float night = smoothstep(0.10, -0.12, ndl);
        c += vec3(1.0, 0.78, 0.45) * texture2D(uNight, uv).r
             * night * (1.0 - cloud * 0.85) * 0.55 * (1.0 - uAirDay);
      }
      // 地上ビューの昼間は、天体との間の大気そのものが光っている (エアライト)。
      // 大気は天体より手前にあるので色を上乗せする。これが無いと、新月ごろの月が
      // 青空に黒い円盤として浮いてしまう (実際は夜側は空と見分けがつかない)。
      // 空ドームと同じリニア値のまま足し、最後にまとめてトーンマップする
      c += skyDayColor(normalize(vW), uAirSun, uAirDay);
      gl_FragColor = vec4(tonemap(c), 1.0);
    }