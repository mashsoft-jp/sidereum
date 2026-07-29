
    varying float vR;
    varying vec3 vW;
    uniform vec3 uAxis, uSun;
    void main() {
      float t = (vR - 1.35) / 1.15;
      float bands = 0.55 + 0.45 * sin(vR * 68.0) * sin(vR * 23.0 + 1.7);
      float gap = smoothstep(0.02, 0.075, abs(t - 0.56));
      float a = (0.30 + 0.55 * bands) * gap;
      a *= smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.9, t);
      vec3 L = normalize(uSun - vW);
      float lit = 0.35 + 0.65 * abs(dot(uAxis, L));
      vec3 c = mix(vec3(0.62, 0.55, 0.42), vec3(0.93, 0.87, 0.72), bands) * lit;
      gl_FragColor = vec4(c * a, a);
    }