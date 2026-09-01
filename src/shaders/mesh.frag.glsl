
    varying vec3 vW;
    varying vec3 vL;
    uniform vec3 uSun, uCol;
    // 機体の塗り分け。モデル座標を uAxis に射影した値で3色に分ける
    // (皿・機体・その他)。テクスチャも頂点色も持たないモデルなので、
    // 部位の色はこの区切りだけで与える
    uniform vec3 uAxis, uC1, uC2;
    uniform vec2 uCut;
    uniform float uFlat;   // 1 = 面の微分で法線を出せる (拡張が使える)
    void main() {
      // 法線は頂点に持たせず、面の微分から求める。機械物は面ごとの平坦
      // シェーディングの方が形が読め、データも小さくなる
      vec3 n = uFlat > 0.5
        ? normalize(cross(dFdx(vW), dFdy(vW)))
        : vec3(0.0, 0.0, 1.0);
      vec3 l = normalize(uSun - vW);
      // 裏返っても暗くならないよう、法線の向きは絶対値で扱う
      float d = uFlat > 0.5 ? abs(dot(n, l)) : 1.0;
      float t = dot(vL, uAxis);
      float hi = smoothstep(uCut.y - 0.02, uCut.y + 0.02, t);
      vec3 mat = mix(uCol, uC1, smoothstep(uCut.x - 0.02, uCut.x + 0.02, t));
      mat = mix(mat, uC2, hi);
      // 皿より下で軸から離れたところ (ブームの先の機器・電源) は暗い側へ寄せる。
      // ここを金色のままにすると、機体が金一色に見えてしまう
      mat = mix(mat, uCol, smoothstep(0.26, 0.34, length(vL - uAxis * t)) * (1.0 - hi));
      gl_FragColor = vec4(tonemap(srgbToLinear(mat) * (0.28 + 0.85 * d)), 1.0);
    }
