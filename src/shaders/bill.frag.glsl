
    varying vec2 vUv;
    uniform vec3 uCol1, uCol2;
    void main() {
      float d = length(vUv);
      float a = pow(max(1.0 - d, 0.0), 2.4);
      vec3 c = mix(uCol1, uCol2, a);
      gl_FragColor = vec4(c * a * 0.9, 0.0);
    }