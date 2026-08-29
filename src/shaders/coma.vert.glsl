
    attribute vec2 aCorner;
    uniform mat4 uVP;
    uniform vec3 uHead, uAxis, uSide;
    uniform vec2 uDim;                  // x: 軸方向スケール  y: 半幅
    varying vec2 vP;                    // x: 軸方向 (太陽側が負)  y: 横方向
    varying vec3 vW;                    // 大気減光を画素ごとに解くための位置
    void main() {
      float x = mix(-1.2, 1.2, aCorner.x * 0.5 + 0.5);
      vP = vec2(x, aCorner.y);
      vec3 w = uHead + uAxis * (x * uDim.x) + uSide * (aCorner.y * uDim.y);
      vW = w;
      gl_Position = uVP * vec4(w, 1.0);
    }