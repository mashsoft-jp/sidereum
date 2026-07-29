
    attribute vec3 aPos;
    uniform mat4 uVP;
    varying vec3 vD;
    void main() { vD = aPos; gl_Position = uVP * vec4(aPos, 1.0); }