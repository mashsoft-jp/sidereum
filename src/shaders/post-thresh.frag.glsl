
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
      // 一色だけ強い大気の縁や惑星の色を、白い光源と同じ強さで滲ませない。
      // ここは表示済みの色から抽出する LDR Bloom。知覚的な明るさで選ぶ。
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // しきい値の前後を滑らかに立ち上げる (硬く切ると滲みの縁が階段状になる)
      gl_FragColor = vec4(c * smoothstep(uThresh, min(uThresh + 0.25, 1.0), l), 1.0);
    }
