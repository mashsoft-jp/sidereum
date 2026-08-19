
    attribute vec3 aPos;
    uniform mat4 uMVP, uModel;
    varying vec3 vW;
    varying vec3 vL;
    void main() {
      vW = (uModel * vec4(aPos, 1.0)).xyz;
      vL = aPos;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }
