
    // 銀河系を上から見た絵。初回に一度だけ流す導入で使う。
    // 実測の地図ではなく、対数らせんの腕・中心のふくらみ・暗黒帯・星の粒を
    // 重ねた描き絵。寄るほど細かい星の段が効くので、そのまま星空へ繋がる。
    // 加算ではなく通常のアルファ合成で、描き終えたシーンの上に乗せて消す
    varying vec2 vUv;
    uniform vec2 uRes;
    uniform float uZoom;    // 1 = 銀河系ぜんぶ、大きいほど寄る
    uniform float uSpin;    // 円盤の回転 [rad]
    uniform float uFade;    // 1 = 見えている、0 = 消えた
    uniform vec2 uAim;      // 寄っていく先 (円盤座標。太陽系のあたり)

    float ihash(vec2 p) {
      p = fract(p * vec2(127.31, 311.7));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(ihash(i), ihash(i + vec2(1.0, 0.0)), f.x),
                 mix(ihash(i + vec2(0.0, 1.0)), ihash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.07; a *= 0.5; }
      return s;
    }
    // 星の層。格子の間隔を円盤座標で渡すので、寄りに合わせて半分ずつ細かく
    // していけば、画面上の粒の密度は変わらないまま新しい星が湧いてくる
    float starLayer(vec2 q, float cell, float seed) {
      vec2 g = q / cell, i = floor(g), f = fract(g);
      float h = ihash(i + seed);
      if (h < 0.70) return 0.0;                       // 疎らに散らす
      vec2 c = vec2(ihash(i + seed + 3.7), ihash(i + seed + 9.1));
      float b = fract(h * 91.7);
      return smoothstep(0.10 + 0.10 * b, 0.0, length(f - c)) * (0.15 + 0.85 * b * b);
    }

    void main() {
      vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.3;
      // 寄りが進むにつれて、画面の中心を銀河の中心から太陽系のあたりへ移す。
      // 出だしは全景、着くころには目的地が真ん中に来る
      vec2 c = uAim * clamp((uZoom - 1.0) * 0.5, 0.0, 1.0);
      float cs = cos(uSpin), sn = sin(uSpin);
      vec2 q = c + mat2(cs, -sn, sn, cs) * (p / uZoom);
      float r = length(q), a = atan(q.y, q.x);
      // 対数らせんの腕。主 2本に、弱い 4本を重ねて枝分かれに見せる
      float t = a + log(max(r, 0.03)) / 0.30;
      float s2 = pow(0.5 + 0.5 * cos(2.0 * t), 2.0);
      float s4 = pow(0.5 + 0.5 * cos(4.0 * t + 1.1), 3.0) * 0.45;
      // むらと暗黒帯は円盤座標のノイズを、らせんに沿って歪ませて引く。腕の
      // 位相 t を軸に使うと ±π の継ぎ目で切れてしまうので、周期の合う
      // (cos 2t, sin 2t) でずらす — こちらは一周して必ず元に戻る
      vec2 warp = vec2(cos(2.0 * t), sin(2.0 * t));
      float arms = (s2 + s4) * (0.40 + 0.95 * fbm(q * 6.0 + warp * 1.7 + 4.3));
      float disc = exp(-r * 2.6) * smoothstep(1.30, 0.70, r);
      // 中心は棒 (天の川は棒渦巻銀河)。腕の巻き始めがここに繋がる
      vec2 bq = mat2(0.87, -0.50, 0.50, 0.87) * q;
      float rb = length(vec2(bq.x * 0.55, bq.y * 1.5));
      float bulge = exp(-rb * rb * 30.0) * 0.95 + exp(-r * 6.0) * 0.28;
      float lum = disc * (0.22 + 1.30 * arms) + bulge;
      // 暗黒帯は腕の内側に沿って濃くなるので、腕の位相をずらして引く。
      // 中心のふくらみは手前に出ているので、そこには掛けない
      float dust = smoothstep(0.28, 0.82, fbm(q * 10.0 + warp * 2.6 + 21.0))
                 * (0.25 + 0.75 * pow(0.5 + 0.5 * cos(2.0 * t + 0.7), 2.0));
      lum *= 1.0 - clamp(dust, 0.0, 0.78) * smoothstep(0.06, 0.30, r);
      // 中心のふくらみは古い星で黄色く、腕は若い星で青い
      vec3 col = mix(vec3(0.46, 0.60, 1.00), vec3(1.00, 0.78, 0.44),
                     clamp(bulge * 1.1 + smoothstep(0.48, 0.04, r) * 0.55, 0.0, 1.0));
      col += vec3(1.00, 0.28, 0.36) * step(0.76, fbm(q * 18.0 + warp * 3.2 + 8.7)) * s2 * disc * 1.6;
      // 銀河の滑らかな光は、分けきれていない星そのもの。寄って星が分かれて
      // くるぶんだけ滑らかな側を引く — 最後は「黒い空に星」になるので、
      // 本編の星空へそのまま重なる
      float res = clamp(1.0 - (log2(max(uZoom, 1.0)) - 2.5) / 6.0, 0.0, 1.0);
      vec3 lin = col * lum * res;
      // 星の粒。寄りに合わせて 1段ずつ細かい層を足していく (混ぜるのではなく
      // 足す — 粗い層の星は寄っても消えず、近づいてくるだけのため)
      float lod = max(log2(uZoom), 0.0);
      float li = floor(lod), lf = lod - li;
      float c0 = 0.05 * exp2(-li);
      float st = starLayer(q, c0, li) + starLayer(q, c0 * 0.5, li + 1.0) * lf;
      // 星の色は青白と橙のあいだ。位置で決めるので、寄っても同じ星は同じ色
      vec3 sc = mix(vec3(0.78, 0.86, 1.00), vec3(1.00, 0.80, 0.55),
                    vnoise(q * 37.0 + 5.5));
      lin += sc * st * clamp(lum * 1.8, 0.0, 1.0) * (0.7 + 0.5 * (1.0 - res));
      gl_FragColor = vec4(tonemap(lin), uFade);
    }
