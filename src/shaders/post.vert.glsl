
    // 画面全体を覆う三角形1枚 (2枚の四角より速く、継ぎ目も出ない)。
    // はみ出した部分はラスタライザが切るので、実際に塗られるのは画面内だけ
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
