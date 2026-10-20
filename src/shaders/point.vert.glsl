
    attribute vec3 aPos;
    attribute float aSize;
    attribute vec3 aCol;
    uniform mat4 uVP;
    uniform float uScale;
    varying vec3 vCol;
    varying float vSize;
    void main() {
      vCol = aCol;
      vSize = aSize;
      gl_Position = uVP * vec4(aPos, 1.0);
      gl_PointSize = aSize * uScale;
    }