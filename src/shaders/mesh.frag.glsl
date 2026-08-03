
    varying vec3 vW;
    uniform vec3 uSun, uCol;
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
      gl_FragColor = vec4(tonemap(srgbToLinear(uCol) * (0.28 + 0.85 * d)), 1.0);
    }
