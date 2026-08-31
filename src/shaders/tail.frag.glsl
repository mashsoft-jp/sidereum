
    varying vec2 vUv;
    varying vec3 vW;    // 大気減光を画素ごとに解くための位置
    uniform vec3 uCol1, uCol2;
    uniform float uAlpha, uKind, uTime, uSeed;
    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }
    float noise1(float x) {
      float i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(hash(i), hash(i + 1.0), f);
    }
    void main() {
      float x = vUv.x, y = vUv.y;
      float flow = max(x, 0.0);
      // 形状は極細幅から開きつつ、密度は核の中心から保って空白を作らない
      float head = 0.72 + 0.28 * smoothstep(0.0, 0.018, x);
      float end = pow(max(1.0 - flow, 0.0), uKind < 0.5 ? 0.68 : 0.76);
      float a;
      if (uKind < 0.5) {
        // イオンテイル: 細い芯と、互いに明滅する数本の青いフィラメント
        float w1 = sin(flow * 30.0 + uSeed * 4.1 + uTime * 0.13) * (0.035 + flow * 0.07);
        float w2 = sin(flow * 19.0 + uSeed * 7.3 - uTime * 0.09) * 0.12 - 0.16;
        float w3 = sin(flow * 23.0 + uSeed * 2.7 + uTime * 0.06) * 0.10 + 0.18;
        // 芯は緩やかに減衰させる。鋭いガウシアンにすると加算合成で軸上だけが
        // 飽和し、光線のような硬い一本線に見えてしまう
        float core = exp(-y * y * 14.0);
        float f1 = exp(-(y - w1) * (y - w1) * 115.0);
        float f2 = exp(-(y - w2) * (y - w2) * 155.0);
        float f3 = exp(-(y - w3) * (y - w3) * 145.0);
        float pulse = 0.80 + 0.20 * noise1(flow * 31.0 + uSeed * 19.0 + uTime * 0.035);
        a = (core * 0.62 + (f1 + f2 + f3) * 0.11) * pulse;
      } else {
        // ダストテイル: 幅広い扇の中に、密度の異なる暖色の筋を作る
        float center = sin(flow * 5.5 + uSeed) * 0.06 * flow;
        float yy = y - center;
        float broad = exp(-yy * yy * 2.15) * pow(max(1.0 - abs(y), 0.0), 1.35);
        float f1 = exp(-(yy - sin(flow * 12.0 + uSeed) * 0.16) *
                       (yy - sin(flow * 12.0 + uSeed) * 0.16) * 36.0);
        float f2 = exp(-(yy + 0.31 - sin(flow * 8.0 - uSeed) * 0.11) *
                       (yy + 0.31 - sin(flow * 8.0 - uSeed) * 0.11) * 42.0);
        float f3 = exp(-(yy - 0.38 - sin(flow * 10.0 + uSeed * 0.7) * 0.09) *
                       (yy - 0.38 - sin(flow * 10.0 + uSeed * 0.7) * 0.09) * 48.0);
        float grain = 0.84 + 0.16 * noise1(flow * 24.0 + y * 3.0 + uSeed * 13.0);
        a = (broad * 0.78 + (f1 + f2 + f3) * 0.09) * grain;
      }
      a *= head * end * uAlpha;
      vec3 col = mix(uCol1, uCol2, smoothstep(0.0, 0.85, flow));
      gl_FragColor = vec4(outAdd(col * a * extinctAt(vW)), 0.0);
    }