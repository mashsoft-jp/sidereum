
    // ガウシアンぼかし。横と縦に分けて2回かける。
    // 補間を使って 9タップぶんを 5回の取得で済ませる (係数と位置は既知の組)
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uDir;       // (1/幅, 0) か (0, 1/高さ)

    void main() {
      vec3 c = texture2D(uTex, vUv).rgb * 0.2270270270;
      c += (texture2D(uTex, vUv + uDir * 1.3846153846).rgb
          + texture2D(uTex, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
      c += (texture2D(uTex, vUv + uDir * 3.2307692308).rgb
          + texture2D(uTex, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }
