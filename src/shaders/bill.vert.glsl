
    attribute vec2 aCorner;
    uniform mat4 uVP;
    uniform vec3 uCenter, uRight, uUp;
    uniform float uSize;
    varying vec2 vUv;
    void main() {
      vUv = aCorner;
      vec3 w = uCenter + (uRight * aCorner.x + uUp * aCorner.y) * uSize;
      gl_Position = uVP * vec4(w, 1.0);
    }