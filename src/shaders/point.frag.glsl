
    varying vec3 vCol;
    uniform float uAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.12, d) * uAlpha;
      if (a < 0.01) discard;
      gl_FragColor = vec4(vCol * a, a);
    }