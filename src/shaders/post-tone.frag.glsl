
    // HDR 経路の合成。オフスクリーンへリニアの放射輝度のまま描いたシーンに、
    // 同じくリニアで作った滲みを足してから、まとめてトーンマップする。
    //
    // 足すのがトーンマップの前だという点が WebGL 1 経路との違い。あちらは
    // 画面 (トーンマップ後) へ足すので、明るい背景の上でも同じだけ明るくなる。
    // こちらは目の圧縮を通るので、昼の空の上では控えめに、夜空では強く出る
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform sampler2D uBloom;
    uniform float uAmount;   // 0 = 滲みなし
    void main() {
      vec3 c = texture2D(uTex, vUv).rgb + texture2D(uBloom, vUv).rgb * uAmount;
      gl_FragColor = vec4(tonemap(c), 1.0);
    }
