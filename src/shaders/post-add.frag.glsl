
    // ぼかした光を画面へ加算で戻す。アルファ 0 は、このアプリの合成規約
    // (乗算済みアルファ) で「背景をそのまま残して足すだけ」を意味する
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform sampler2D uScene; // 滲ませる前の画面
    uniform float uAmount;

    void main() {
      vec3 glow = texture2D(uTex, vUv).rgb * uAmount;
      vec3 scene = texture2D(uScene, vUv).rgb;
      // スクリーン合成の差分だけを加算する。明るい面ほど追加量が減り、
      // 雲や砂漠の階調を白へ押し潰さず、暗い背景には柔らかな滲みを残す。
      gl_FragColor = vec4(glow * (1.0 - scene), 0.0);
    }
