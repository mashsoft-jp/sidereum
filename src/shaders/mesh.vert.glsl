
    attribute vec3 aPos;
    uniform mat4 uMVP, uModel;
    varying vec3 vW;
    void main() {
      vW = (uModel * vec4(aPos, 1.0)).xyz;
      gl_Position = uMVP * vec4(aPos, 1.0);
    }
