
    // 太陽のコロナとグレア (カメラ正対の板、加算合成)。
    // uFall は中心からの落ち方。小さいほど裾が広く残る — コロナは 2.4 で
    // 太陽に貼りつき、グレアの裾は 1 前後にして画面の広い範囲まで届かせる
    varying vec2 vUv;
    uniform vec3 uCol1, uCol2;
    uniform float uFall;
    void main() {
      float d = length(vUv);
      float a = pow(max(1.0 - d, 0.0), uFall);
      vec3 c = mix(uCol1, uCol2, a);
      gl_FragColor = vec4(c * a * 0.9, 0.0);
    }
