
    attribute vec3 aPos;
    attribute vec3 aCol;
    attribute float aY;          // 光跡の断面座標 (-1..1)
    uniform mat4 uVP;
    varying vec3 vCol;
    varying float vY;
    void main() {
      vCol = aCol;
      vY = aY;
      gl_Position = uVP * vec4(aPos, 1.0);
    }