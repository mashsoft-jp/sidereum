
    // HDR 経路の合成。オフスクリーンへリニアの放射輝度のまま描いたシーンを
    // トーンマップし、そこへ滲みを足して画面へ出す。
    //
    // 滲みは**トーンマップの後**に足す。前に足すと、明るい空はすでに曲線の
    // 寝たところにいるので、どれだけエネルギーを積んでも表示値が伸びない
    // (強さを 1.2 → 8.0 と 6倍以上振っても暈がほとんど変わらなかった)。
    // このアプリは目の順応を露出ではなく空の計算の中に入れていて (skyAdaptGain)、
    // EXPOSURE は固定なので、前に足す形とは噛み合わない。
    //
    // 「どの画素を光らせるか」と「どれだけのエネルギーか」は HDR で判定した
    // ままなので、太陽と明るい雲を区別できるという利得は残る — 桁違いに
    // 明るいものほど、滲みが飽和したまま遠くまで届く
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform sampler2D uBloom;
    uniform float uAmount;   // 0 = 滲みなし
    void main() {
      vec3 c = tonemap(texture2D(uTex, vUv).rgb)
             + tonemap(texture2D(uBloom, vUv).rgb) * uAmount;
      gl_FragColor = vec4(c, 1.0);
    }
