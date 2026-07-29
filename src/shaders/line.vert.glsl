
    attribute vec3 aPos;
    uniform mat4 uVP;
    void main() { gl_Position = uVP * vec4(aPos, 1.0); }