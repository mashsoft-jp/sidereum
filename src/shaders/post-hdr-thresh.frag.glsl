
    // HDR 経路のしきい値。1/4 に縮小しながら、滲ませる画素を選ぶ。
    //
    // 選ぶ基準は「トーンマップ後の明るさ」= 画面でどう見えるか。リニア値で
    // 切ってはいけない — トーンマップは強い圧縮なので、地平の太陽 (リニア
    // 0.56) は画面では 0.75 の明るい画素になる。リニアの 1.0 で切ると、
    // 見た目には眩しい夕日が滲みに拾われない。
    //
    // 渡すのはリニアの色そのもの。選ぶのは表示、運ぶのはエネルギー。これで
    // 「拾う画素は WebGL 1 と同じ、滲みの強さは本来の明るさに比例」になる。
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uTexel;     // 元画像の 1テクセル
    uniform float uThresh;   // これ以下の明るさは光らせない [表示]

    void main() {
      vec3 c = texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
      c *= 0.25;
      // 明るさは最大成分で見る。輝度で見ると、青い大気の縁のように
      // 「特定の色だけが強い」ところを取りこぼす
      vec3 d = tonemap(c);
      float l = max(max(d.r, d.g), d.b);
      gl_FragColor = vec4(c * smoothstep(uThresh, min(uThresh + 0.25, 1.0), l), 1.0);
    }
