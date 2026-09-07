    attribute vec3 aPos;
    uniform mat4 uVP;
    varying float vDepth;
    void main() {
      gl_Position = uVP * vec4(aPos, 1.0);
      vDepth = gl_Position.w;
    }
