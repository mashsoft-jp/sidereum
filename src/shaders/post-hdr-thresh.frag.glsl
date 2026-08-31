
    // HDR 経路のしきい値。リニアの放射輝度から「1.0 を超えたぶん」だけを
    // 取り出しながら 1/4 に縮小する。
    //
    // WebGL 1 経路 (post-thresh) は表示色に対して 0.72 で切っていた。そちらは
    // トーンマップ後の画面を見ているので、太陽も明るい雲も 1.0 に潰れていて
    // 区別できず、昼は空そのものがしきい値を超えるため skyDayF で持ち上げる
    // 細工が要った。リニアなら「1.0 = 正面から照らされた白い面」が基準なので、
    // 昼の空 (0.2 前後) は自然に外れ、太陽 (8 前後) だけが残る。
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uTexel;     // 元画像の 1テクセル
    uniform float uThresh;   // これを超えたぶんだけ滲ませる [リニア]

    void main() {
      vec3 c = texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb
             + texture2D(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
      c *= 0.25;
      // 硬く切らず、超えたぶんをそのまま渡す。リニアなので階段は出ない
      gl_FragColor = vec4(max(c - uThresh, 0.0), 1.0);
    }
