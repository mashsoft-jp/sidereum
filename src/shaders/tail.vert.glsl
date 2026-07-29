
    attribute vec2 aCorner;
    uniform mat4 uVP;
    uniform vec3 uHead, uAxis, uCurve, uSide;
    uniform vec2 uDim;                  // x: 長さ  y: 半幅
    varying vec2 vUv;
    void main() {
      float x = aCorner.x * 0.5 + 0.5;
      float flow = x;
      // 核では極細幅に絞り、コマの内部で開くことで根元の断面を見せない
      float rootOpen = 0.18 + 0.82 * smoothstep(0.0, 0.014, x);
      float fan = rootOpen * mix(0.13, 1.0, smoothstep(0.0, 1.0, flow));
      vec3 w = uHead + uAxis * (x * uDim.x)
             + uCurve * (flow * flow * uDim.x)
             + uSide * (aCorner.y * uDim.y * fan);
      vUv = vec2(x, aCorner.y);
      gl_Position = uVP * vec4(w, 1.0);
    }