
    // 明るいところだけを抜き出しながら 1/4 に縮小する。
    // 4点をまとめて取るのは、縮小でこぼれた明点がちらつかないようにするため
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uTexel;     // 元画像の 1テクセル
    uniform float uThresh;   // これ以下の明るさは光らせない

    void main() {
      vec3 c = texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
      c *= 0.25;
      // 明るさは最大成分で見る。輝度で見ると、青い大気の縁のように
      // 「特定の色だけが強い」ところを取りこぼす
      float l = max(max(c.r, c.g), c.b);
      // しきい値の前後を滑らかに立ち上げる (硬く切ると滲みの縁が階段状になる)
      gl_FragColor = vec4(c * smoothstep(uThresh, min(uThresh + 0.25, 1.0), l), 1.0);
    }
