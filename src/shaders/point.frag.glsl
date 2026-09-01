
    varying vec3 vCol;
    uniform float uAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.12, d) * uAlpha;
      if (a < 0.01) discard;
      // アルファ 0 = 乗算済みアルファでの加算 (blendFunc は ONE, ONE_MINUS_SRC_ALPHA)。
      // 点で描くのは光源なので、背景へ足すのが正しい。アルファを載せると
      // 「背景を置き換える」ことになり、暗い光源が明るい背景に穴を開ける —
      // 夕空の太陽が黒い円盤になっていたのはこれ。夜空 (背景がほぼ 0) では
      // どちらの式も同じ値になるので、星の見え方は変わらない
      gl_FragColor = vec4(vCol * a, 0.0);
    }