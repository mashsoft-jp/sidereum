
    // ぼかした光を画面へ加算で戻す。アルファ 0 は、このアプリの合成規約
    // (乗算済みアルファ) で「背景をそのまま残して足すだけ」を意味する
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform float uAmount;

    void main() {
      gl_FragColor = vec4(texture2D(uTex, vUv).rgb * uAmount, 0.0);
    }
