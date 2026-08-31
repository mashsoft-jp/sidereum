
    // HDR 経路の合成。オフスクリーンへリニアの放射輝度のまま描いたシーンを、
    // ここでまとめてトーンマップして画面へ出す。
    //
    // WebGL 1 経路ではシェーダごとに tonemap() を呼んでいる。そちらは 1.0 を
    // 超える明るさが各パスの時点で潰れるので、太陽と明るい雲の区別が滲みへ
    // 渡らない。HDR 経路はここまで潰さずに運ぶための入口 (滲み側の利用は次段)
    varying vec2 vUv;
    uniform sampler2D uTex;
    void main() {
      gl_FragColor = vec4(tonemap(texture2D(uTex, vUv).rgb), 1.0);
    }
