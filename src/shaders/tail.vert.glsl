
    attribute vec2 aCorner;
    uniform mat4 uVP;
    uniform vec3 uHead, uAxis, uCurve, uSide;
    uniform vec2 uDim;                  // x: 長さ  y: 半幅
    varying vec2 vUv;
    void main() {
      float x = aCorner.x * 0.5 + 0.5;
      float flow = x;
      // 尾は核を頂点とする円錐として開かせる。根元に一定の幅を残すと、そこは
      // 「軸方向の長さより幅の方が広い」板になり、核の真横へ光を噴き出して
      // いるように見えてしまう。写真の彗星は頭部から細く出て徐々に広がる
      float fan = mix(0.012, 1.0, pow(flow, 0.85));
      vec3 w = uHead + uAxis * (x * uDim.x)
             + uCurve * (flow * flow * uDim.x)
             + uSide * (aCorner.y * uDim.y * fan);
      vUv = vec2(x, aCorner.y);
      gl_Position = uVP * vec4(w, 1.0);
    }