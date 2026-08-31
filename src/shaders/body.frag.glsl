
    varying vec3 vL, vW, vN;
    uniform float uType, uTime, uHasTex, uComet, uAmb;
    uniform vec3 uCam, uSun, uColA, uColB, uColC, uRim;
    uniform vec3 uAirSun;   // 大気の光の計算に使う太陽方向 (地平フレーム)
    uniform float uAirDay;  // 空の明るさ 0〜1。宇宙ビューは 0 (大気が無い)
    uniform float uAirFlux; // 大気へ届いている太陽の光量 (0 = 大気が無い)
    uniform float uAirGain; // 目の順応 (空ドームと同じ値)
    uniform vec3 uExt;      // 大気減光の透過率 (RGB)。大気が無い経路では 1
    uniform vec4 uParams;
    uniform sampler2D uTex;
    uniform mat4 uModel;        // 中心・極方向・スケールを取り出すのに使う
    uniform float uRingOn;      // 環を持つ天体 (土星) だけ 1
    uniform vec2 uRingR;        // 環プロファイルの参照範囲 (内径, 1/(外径-内径))
    uniform sampler2D uRing;
    uniform sampler2D uCloud;   // 地球の雲 (被覆率。グレースケール)
    uniform sampler2D uNight;   // 地球の夜景 (街灯りの強さ。グレースケール)
    // 地球照 (月の暗い側を照らす地球の光)。uEsCol = 色と強さ、0 なら無し。
    // uEsDir = 天体から見た地球の方向 (uSun と同じ座標系の単位ベクトル)
    uniform vec3 uEsCol, uEsDir;
    uniform float uCloudRot;    // 雲の経度オフセット。地表と別に流すため
    uniform float uSunT;        // 黒点の世代を決める暦の時刻 [日]
    uniform sampler2D uNrm;     // 実測標高から作った接空間の法線 (月・水星・火星)
    uniform float uNrmAmt;      // その強さ。0 = 法線マップを持たない天体
    uniform float uAtmos;       // 1 = 大気シェルとして描く (本体ではなく)
    uniform float uAtmosT;      // シェルの厚み (天体半径を 1 とした比)
    uniform vec3 uEclC;         // 食: 遮蔽体の中心 (uSun と同じ座標系)
    uniform vec2 uEclR;         // x = 遮蔽体の半径 (同じ単位。0 = 食なし), y = 太陽の視半径 [rad]
    uniform vec3 uEclCol;       // 皆既のとき遮蔽体の大気を回り込んで届く光 (リニア)

    // 全球マップの取得はすべてこれを通す。経度方向は必ずどこかで折り返すので、
    // 微分を自動で取らせるとその1列でミップ段が最粗まで落ちて縦縞になる。
    // 折り返しを含まない微分 (dux/duy) を呼び出し側で用意して渡す
#ifdef TEXLOD
    #define SAMPLE(t, c) texture2DGradEXT(t, c, dux, duy)
#else
    #define SAMPLE(t, c) texture2D(t, c)
#endif

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

      if (uAtmos > 0.5) {
        // ---- 大気シェル ----
        // 本体より一回り大きい球を加算で重ね、円盤の外へはみ出す光の輪を出す。
        // 描くのはシェルの手前側の面だけで、視線が大気の中を通る長さはここで
        // 解析的に求める (天体半径を 1 とした単位で計算する)
        vec3 ctr = uModel[3].xyz;
        float ro = 1.0 + uAtmosT;                     // シェルの外径
        float R = length(uModel[0].xyz) / ro;         // 天体の半径 (ワールド)
        vec3 P = (vW - ctr) / R;
        vec3 C = P - V * dot(P, V);                   // 視線の最接近点
        float b = length(C);                          // 最接近距離 (= 見かけの高度)
        float outer = sqrt(max(ro * ro - b * b, 0.0));
        float inner = sqrt(max(1.0 - b * b, 0.0));
        // 円盤に重なる視線は地表で止まる。外れる視線は大気を貫いて反対側へ抜ける
        float path = b < 1.0 ? outer - inner : 2.0 * outer;
        // 実際の大気は上へ行くほど薄い。指数で落として縁に張り付く輪にする
        float tau = path * 5.5 * exp(-max(b - 1.0, 0.0) / 0.006);
        // 円盤の内側は本体側でもエアライトを足しているので、二重に乗らないよう薄く
        tau *= mix(0.30, 1.0, smoothstep(0.97, 1.02, b));

        vec3 Ld = normalize(uSun - vW);
        float sun = smoothstep(-0.30, 0.25, dot(normalize(C + vec3(1e-6)), Ld));
        float fwd = pow(max(dot(-V, Ld), 0.0), 8.0);  // 太陽が向こう側にあるほど強い
        vec3 col = mix(vec3(0.055, 0.145, 0.400),     // レイリー (青)
                       vec3(0.520, 0.220, 0.080),     // 前方散乱 (朝焼け色)
                       fwd * 0.7)
                 * (1.0 - exp(-tau)) * sun;
        gl_FragColor = vec4(outLit(col * uExt), 0.0);   // 乗算済みアルファでの加算
        return;
      }

      if (uType < 0.5) {
        // ---- 太陽 ----
        // 光球は照らされる面ではなく自発光なので、アルベドではなく放射輝度を直に
        // 置く。赤だけトーンマップの肩を大きく超えさせるのがコツで、そうしないと
        // ACES が彩度を落として白い円盤になる (実際に露出過多の太陽は白く写る)。
        // ここの2色は、画面上の (0.99,0.72,0.26) と (1.0,0.94,0.66) を
        // トーンマップ後に再現するリニア値
        vec3 cA = vec3(3.729, 0.291, 0.050);
        vec3 cB = vec3(8.000, 1.239, 0.230);
        float mu = max(dot(N, V), 0.0);

        // ---- 粒状斑 ----
        // 対流セルなので、明るいセルの中心と暗い境目でできている。大・中・小の
        // 3スケールを重ね、細かいほど速く入れ替わるようにして沸き立たせる
        float g1 = fbm(p * 5.0  + vec3(0.0, uTime * 0.020, uTime * 0.008));
        float g2 = fbm(p * 26.0 + vec3(uTime * 0.05, 0.0, uTime * 0.03));
        float g3 = noise(p * 90.0 + uTime * 0.30);
        float gran = g1 * 0.46 + g2 * 0.34 + g3 * 0.20;
        // 境目 (暗いレーン) を少し立たせる。遠目には効かないので縁では薄める
        gran += (smoothstep(0.42, 0.5, g2) - smoothstep(0.5, 0.58, g2)) * -0.10 * mu;

        // ---- 黒点と白斑 ----
        // 群は緯度 ±30° あたりに現れ、数十日かけて出て消える。世代を暦の時刻から
        // 決めるので、停止中は動かず、同じ日付なら同じ配置になる
        float spot = 0.0, fac = 0.0;
        for (int i = 0; i < 11; i++) {
          float fi = float(i);
          float ph = uSunT / 41.0 + fi * 0.43;
          float gen = floor(ph), age = fract(ph);
          float h1 = hash(vec3(fi, gen, 1.7));
          float h2 = hash(vec3(fi, gen, 5.3));
          float h3 = hash(vec3(fi, gen, 9.1));
          float h4 = hash(vec3(fi, gen, 13.9));
          // 出現から成長し、やがて崩れて消える。3割の世代は群ができない
          float life = smoothstep(0.0, 0.15, age) * (1.0 - smoothstep(0.55, 1.0, age))
                     * step(0.16, h3);
          float lat = (h1 - 0.5) * 0.60;                 // ±約17°
          float lon = h2 * 6.2831853;
          float cl = cos(lat);
          float d = distance(p, vec3(cl * cos(lon), sin(lat), cl * sin(lon)));
          // life=0 のとき smoothstep の両端が一致すると結果が未定義になるので下限を置く
          float sz = max((0.030 + 0.075 * h4) * life, 1e-4);
          float umb = 1.0 - smoothstep(sz * 0.40, sz * 0.62, d);   // 暗部
          float pen = 1.0 - smoothstep(sz * 0.95, sz * 1.20, d);   // 半暗部
          spot = max(spot, umb * 0.90 + (pen - umb) * 0.52);
          // 白斑は群のまわり。縁に近いほど目立つ (実際の観測と同じ)
          fac = max(fac, (1.0 - smoothstep(sz * 1.3, sz * 2.6, d)) * (1.0 - pen) * life);
        }

        // 3スケールを足すと分散が下がるので、閾を狭めてコントラストを戻す
        vec3 c = mix(cA, cB, smoothstep(0.33, 0.71, gran));
        c *= 1.0 - spot * 0.88;
        c += cB * fac * 0.28 * (1.0 - mu * 0.75);        // 白斑
        c *= mix(0.30, 1.0, pow(mu, 0.55));              // 周縁減光
        // ---- 彩層とプロミネンス ----
        // 光球のすぐ外側の薄い層。縁だけに赤い縁取りとして出て、ところどころ
        // 炎のように立ち上がる
        float rim = 1.0 - smoothstep(0.0, 0.22, mu);
        float flame = fbm(p * 9.0 + vec3(uTime * 0.03, 0.0, 0.0));
        c += vec3(2.30, 0.30, 0.16) * pow(rim, 2.2) * (0.35 + 0.9 * flame);
        // 大気減光。日の出入りの太陽が赤く、直視できるほど暗いのはこれ。
        // そのうえでエアライトを足す — 太陽と目のあいだの大気が光っているぶんで、
        // 空や他の天体には足しているのにここだけ抜けていた。無いと、減光された
        // 円盤より周りの空の方が明るくなり、夕日が空に開いた黒い穴になる
        // (下の天体の経路にある「新月の月が黒い円盤になる」のと同じ話)
        gl_FragColor = vec4(outLit(c * uExt + skyDayColor(normalize(vW), uAirSun, uAirFlux) * uAirGain), 1.0);
        return;
      }

      // ---- 全球マップの uv と、その折り返しを含まない微分 ----
      // 法線マップを照明より先に当てたいので、テクスチャの分岐より上で作る
      vec2 uv = vec2(0.5 - atan(p.z, p.x) / 6.2831853,
                     acos(clamp(p.y, -1.0, 1.0)) / 3.14159265);
      vec2 dux = vec2(0.0), duy = vec2(0.0);
#ifdef TEXLOD
      // 経度は継ぎ目 (atan の折り返し) で 1→0 に飛ぶ。連続な p の微分から
      // 連鎖律で uv の微分を出し、折り返しを含まない値を SAMPLE へ渡す
      {
        vec3 px = dFdx(p), py = dFdy(p);
        float r2 = max(p.x * p.x + p.z * p.z, 1e-8);                // ∂atan の分母
        float sv = 3.14159265 * sqrt(max(1.0 - p.y * p.y, 1e-8));   // ∂acos の分母
        dux = vec2(-(p.x * px.z - p.z * px.x) / (r2 * 6.2831853), -px.y / sv);
        duy = vec2(-(p.x * py.z - p.z * py.x) / (r2 * 6.2831853), -py.y / sv);
      }
#endif

      // ---- 法線マップ (月・水星・火星) ----
      // 実測の標高から作った接空間の法線を、球の法線へ乗せる。アルベド図は
      // 一定の照明で正規化されていて起伏が焼き込まれているため、これが無いと
      // 太陽が動いてもクレーターの陰影が変わらず、のっぺりして見える
      if (uNrmAmt > 0.0) {
        vec3 t = SAMPLE(uNrm, uv).rgb * 2.0 - 1.0;
        // 接基底。極では東西方向が縮退するので、そこは素の法線のままにする
        vec3 e = cross(vec3(0.0, 1.0, 0.0), p);
        float el = length(e);
        if (el > 0.02) {
          e /= el;
          N = normalize(N + (e * t.x + cross(p, e) * t.y) * uNrmAmt);
        }
      }

      vec3 L = normalize(uSun - vW);                // 光源 = 太陽 (カメラ相対座標)
      float mu0 = max(dot(N, L), 0.0);              // 入射角の cos
      float muV = max(dot(N, V), 0.0);              // 出射角の cos

      // ---- 反射のしかた ----
      // 大気の無い岩の天体 (uType = 1: 月・水星・小惑星・氷衛星) は
      // Lommel-Seeliger。粗いレゴリスは来た方向へ光を返すので、Lambert の
      // ような cos 落ちにならない。満 (位相角 0) では μ0 = μ になって式が
      // 定数へ落ち、円盤が縁まで一様に光る — **満月が球ではなく平たい円盤に
      // 見えるのはこれ**で、縁を明るくする係数を手で置く必要がない。
      // Lambert のままだと、誰もが知っている満月の見え方と食い違う。
      //
      // 厳密には単散乱の極限なので、アルベドの高い氷衛星 (エウロパなど) は
      // 多重散乱のぶん Lambert 寄りに戻る。それでも Lambert よりは近い。
      // 大気を持つ天体 (地球・金星・タイタン・ガス惑星) は Lambert のまま。
      //
      // 正規化は「正面から見た直下点で 1」= Lambert のピークに合わせてある
      float dif = uType < 1.5 ? 2.0 * mu0 / (mu0 + muV + 1e-4) : mu0;

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
      // ---- 食: 他の天体が太陽面を隠す ----
      // 月食 (地球の影に入る月)・日食 (地球へ落ちる月の影)・木星面を渡る
      // ガリレオ衛星の影は、どれも「その点から見て太陽面の何割が遮蔽体に
      // 隠れたか」で決まる。2円の重なり面積をここで解く。遮蔽体の選定は
      // CPU 側 (core/eclipse.js)
      vec3 eclLight = vec3(0.0);
      if (uEclR.x > 0.0) {
        vec3 D = uEclC - vW;
        float d = length(D);
        float ro = asin(clamp(uEclR.x / d, 0.0, 1.0));        // 遮蔽体の視半径
        float rs = uEclR.y;                                   // 太陽の視半径
        float sep = acos(clamp(dot(D / d, L), -1.0, 1.0));    // 中心どうしの離角
        float cov = 0.0;
        if (sep < rs + ro) {
          if (sep <= ro - rs) {
            cov = 1.0;                                        // 皆既
          } else if (sep <= rs - ro) {
            cov = (ro * ro) / (rs * rs);                      // 金環
          } else {
            float ca = clamp((sep*sep + rs*rs - ro*ro) / (2.0*sep*rs), -1.0, 1.0);
            float cb = clamp((sep*sep + ro*ro - rs*rs) / (2.0*sep*ro), -1.0, 1.0);
            cov = (rs*rs * (acos(ca) - ca * sqrt(max(1.0 - ca*ca, 0.0)))
                 + ro*ro * (acos(cb) - cb * sqrt(max(1.0 - cb*cb, 0.0))))
                / (3.14159265 * rs * rs);
          }
        }
        // 本影の中へ届くのは、遮蔽体の大気を回り込んだ光だけ (皆既月食の赤銅色)。
        // 本影の縁ほど明るく中心ほど暗いので、離角で暗くする。大気を持たない
        // 遮蔽体は uEclCol = 0 なので、この項は消える
        float t = clamp(sep / max(ro - rs, 1e-6), 0.0, 1.0);  // 0 = 本影の中心
        eclLight = uEclCol * dif * cov * mix(0.22, 1.0, t * t);
        dif *= 1.0 - cov;
      }

      float lat = p.y;
      // アルベドは以降すべてリニア。uColA/B/C・uRim・uAmb は CPU 側で変換済み、
      // テクスチャと即値だけここで戻す
      vec3 alb = vec3(0.5);
      float spec = 0.0;
      // 地球だけ、地表のあとに雲・夜景・大気を重ねる。そのぶんの持ち回り
      float isEarth = step(3.5, uType) * step(uType, 4.5) * uHasTex;
      float cloud = 0.0;

      if (uComet > 0.5) {
        // ---- 彗星核: 自発光しない、煤と有機物に覆われた非常に暗い表面 ----
        float rock = fbm(p * 6.0 + 2.0);
        float pits = fbm(p * 18.0 - 4.0);
        alb = mix(vec3(0.00310, 0.00334, 0.00359),    // sRGB (0.040,0.043,0.046)
                  vec3(0.04696, 0.03157, 0.01848), rock);  //      (0.240,0.195,0.145)
        alb *= 0.58 + 0.52 * smoothstep(0.28, 0.76, pits);
      } else if (uHasTex > 0.5) {
        // ---- 実テクスチャ (NASA/USGS 全球マップ) ----
        alb = srgbToLinear(SAMPLE(uTex, uv).rgb);
        if (uType > 3.5 && uType < 4.5) {
          // ---- 地球: 雲・雲の影・海面の反射 ----
          // 雲は地表とは別に、ゆっくり東へ流す。1 を超えたぶんは REPEAT に任せる
          // (fract で畳むと、そこで微分が飛んでヨーロッパ〜アフリカに縦縞が出た)
          vec2 cuv = vec2(uv.x + uCloudRot, uv.y);
          cloud = SAMPLE(uCloud, cuv).r;

          // 雲が地表へ落とす影。雲層は地表より CLOUD_H だけ高いので、地表の点から
          // 太陽へ伸ばした線が雲層を横切る位置は接平面方向へ CLOUD_H/cosθ ずれる。
          // 太陽が低いほど影が長く伸びる (朝夕の斜光と同じ)
          float ndl = max(dot(p, L), 0.08);
          vec3 Lt = L - p * dot(L, p);                        // 太陽方向の接平面成分
          vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), p));
          vec3 north = cross(p, east);
          float k = 0.0016 / ndl;                             // 弧長 (地球半径 = 1)
          float cosLat = max(sqrt(max(1.0 - p.y * p.y, 0.0)), 0.15);
          vec2 suv = vec2(cuv.x + dot(Lt, east) * k / cosLat / 6.2831853,
                          clamp(cuv.y - dot(Lt, north) * k / 3.14159265, 0.0, 1.0));
          alb *= 1.0 - 0.55 * SAMPLE(uCloud, suv).r;

          // 海面の太陽反射 (サングリント)。実物の写真にも写るが、水の正面反射率は
          // 2% しかないので、正面から見ているうちはほとんど光らない。フレネルを
          // 入れずに強度だけで出すと、満に近い画で円盤の真ん中に大きな艶が乗り、
          // 地球儀の照り返しのような見た目になる。
          //   - フレネルは Schlick 近似 (水の F0 = 0.02)。斜めから見るほど強い
          //   - ローブ幅は Cox-Munk の波面傾斜 (σ ≒ 10°) 相当。Blinn の指数は
          //     Phong のおよそ4倍で同じ広さになるので 240
          //   - 最大でもリニア 0.08 程度に収める。Bloom の閾値 (画面輝度 0.72) を
          //     超えると滲みに拾われ、円盤の 1/3 を覆う白い靄になる
          float ocean = smoothstep(0.004, 0.03, alb.b - alb.r) * smoothstep(0.004, 0.03, alb.b - alb.g);
          vec3 Hv = normalize(L + V);
          float fWater = 0.02 + 0.98 * pow(1.0 - max(dot(L, Hv), 0.0), 5.0);
          spec = pow(max(dot(N, Hv), 0.0), 240.0) * fWater * ocean * (1.0 - cloud) * 4.0;

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
      // リム光は縁を持ち上げる見た目の項なので、Lommel-Seeliger の dif ではなく
      // 素の cos で重みを付ける。dif は縁で 1 を超えうるので、そのまま掛けると
      // 縁の光を二重に強めることになる (リムを持つのは冥王星と小惑星のいくつか)
      alb += uRim * fres * (0.25 * dayFade + 0.75 * mu0) * 0.55;

      // uAmb = 夜側の明るさ。呼び出し側が見かけの大きさから決める。点にしか
      // 見えない遠くの天体は見失わないよう明るく、円盤として分解できる大きさ
      // では暗くして満ち欠けを見せる。昼側の明るさは uAmb によらず一定に保つ
      float ambient = uAmb * dayFade;
      float direct = mix(1.0, 1.03, uComet) - ambient;

      // ---- 地球照 ----
      // 月の暗い側がぼんやり光って見えるのは、そこに地球が昇っていて
      // 地面を照らしているから。強さは「月から見た地球の位相」で決まり、
      // 新月のころ (地球は満ちて見える) が最も明るく、満月では消える。
      // 照らす向きは地球なので、地球から眺めているかぎり本体と同じ
      // Lommel-Seeliger が μ0 = μ に落ちて円盤が一様に光る — 実際の地球照も
      // のっぺりした灰色の面に見える。昼の空では見えないので dayFade を掛ける
      vec3 esLight = vec3(0.0);
      if (uEsCol.g > 0.0) {
        float me = max(dot(N, uEsDir), 0.0);
        esLight = uEsCol * (2.0 * me / (me + muV + 1e-4)) * dayFade;
      }

      vec3 c = alb * (ambient + dif * direct + eclLight + esLight) + vec3(spec) * dif;

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
        c += vec3(1.0, 0.78, 0.45) * SAMPLE(uNight, uv).r
             * night * (1.0 - cloud * 0.85) * 0.55 * (1.0 - uAirDay);
      }
      // 地上ビューの昼間は、天体との間の大気そのものが光っている (エアライト)。
      // 大気は天体より手前にあるので色を上乗せする。これが無いと、新月ごろの月が
      // 青空に黒い円盤として浮いてしまう (実際は夜側は空と見分けがつかない)。
      // 空ドームと同じリニア値のまま足し、最後にまとめてトーンマップする
      // 大気減光。ここまでが「天体から届く光」なので、まとめて減らす。
      // 続くエアライトは大気そのものが光っているぶんなので掛けない
      // (掛けると二重に減ることになる)
      c *= uExt;
      c += skyDayColor(normalize(vW), uAirSun, uAirFlux) * uAirGain;
      gl_FragColor = vec4(outLit(c), 1.0);
    }