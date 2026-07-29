
    attribute vec3 aPos;
    attribute float aR;
    uniform mat4 uMVP, uModel;
    varying float vR;
    varying vec3 vW;
    void main() {
      vR = aR;
      vW = (uModel * vec4(aPos, 1.0)).xyz;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }