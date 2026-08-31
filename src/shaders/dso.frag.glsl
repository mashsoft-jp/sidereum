
    // 中心が明るく、縁でぼやけて消える。星雲・星団・銀河はどれも境目が
    // 無いので、ガウシアン1本で足りる。r = 1 でちょうど 0 になるよう
    // 裾の値 (e^-3.2) を引いておく — 引かないと板の縁が四角く見える
    varying vec2 vQ;
    varying vec3 vCol;
    void main() {
      float r2 = dot(vQ, vQ);
      if (r2 > 1.0) discard;
      float a = exp(-3.2 * r2) - 0.040762;
      gl_FragColor = vec4(outAdd(vCol * max(a, 0.0)), 0.0);   // 乗算済みアルファでの加算
    }
