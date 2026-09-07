    uniform vec4 uColor;
    uniform float uFade;
    uniform vec2 uDepthFade; // 中心の視線方向距離、軌道半径の逆数。0 は奥行き効果なし
    varying float vDepth;
    void main() {
      float front = clamp(0.5 + (uDepthFade.x - vDepth) * uDepthFade.y * 0.5, 0.0, 1.0);
      float depth = mix(1.0, mix(0.50, 1.0, front), step(0.0000001, uDepthFade.y));
      // ONE ブレンドでは alpha だけを下げても線は暗くならない。
      // 既存の線の色を基準に、発色と被覆率を同じ率で落とす。
      gl_FragColor = uColor * (uFade * depth);
    }
