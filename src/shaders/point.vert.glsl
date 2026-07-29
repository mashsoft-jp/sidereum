
    attribute vec3 aPos;
    attribute float aSize;
    attribute vec3 aCol;
    uniform mat4 uVP;
    uniform float uScale;
    varying vec3 vCol;
    void main() {
      vCol = aCol;
      gl_Position = uVP * vec4(aPos, 1.0);
      gl_PointSize = aSize * uScale;
    }