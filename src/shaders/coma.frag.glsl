
    varying vec2 vP;
    varying vec3 vW;    // 大気減光を画素ごとに解くための位置
    uniform vec3 uCol;
    uniform float uAlpha, uCore, uFacing;
    void main() {
      // 太陽側の圧縮から尾側の伸びまで、核をまたいで連続的に変化させる
      float rearMix = smoothstep(-0.32, 0.42, vP.x);
      float sx = vP.x * mix(1.0, mix(2.4, 0.90, rearMix), uFacing);
      float d2 = sx * sx + vP.y * vP.y * 1.3;
      float glow = exp(-d2 * 3.8);
      float ix = vP.x * mix(1.0, mix(1.5, 0.62, rearMix), uFacing);
      float inner = exp(-(ix * ix + vP.y * vP.y) * 18.0);
      float cx = vP.x * mix(1.0, mix(1.0, 0.70, rearMix), uFacing);
      float core = exp(-(cx * cx + vP.y * vP.y) * 64.0);
      // 遠距離では未解像の明るい頭部、接近時は境界のない淡いガス雲だけを残す
      vec3 light = uCol * (glow * 0.36 + inner * 0.42)
                 + vec3(1.0, 0.98, 0.92) * core * 2.80 * uCore;
      gl_FragColor = vec4(light * uAlpha * extinctAt(vW), 0.0);
    }