
    attribute vec3 aPos;
    uniform mat4 uVP;
    uniform float uRadius;
    varying vec3 vDir;
    void main() {
      vDir = aPos;                       // 単位球なので頂点位置がそのまま方向
      gl_Position = uVP * vec4(aPos * uRadius, 1.0);
    }
