    uniform vec3 uEye;
    uniform float uFloor;
    varying vec3 vNormal, vLocal, vPosition;
    varying float vSeed;
    float grain(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    void main() {
      float distanceToEye = length(vPosition - uEye);
      if (uFloor > 0.5) {
        // 遠方だけ、分離できない氷粒子の層へ溶かす。近景に平板を残さない。
        float opacity = smoothstep(9.0, 38.0, distanceToEye) * 0.85;
        float lanes = 0.72 + 0.20 * sin(vPosition.x * 1.7) + 0.08 * sin(vPosition.x * 9.1);
        vec3 c = vec3(0.16, 0.17, 0.18) * lanes;
        gl_FragColor = vec4(c * opacity, opacity);
        return;
      }
      vec3 N = normalize(vNormal), L = normalize(vec3(-0.5, 0.8, 0.35));
      vec3 V = normalize(uEye - vPosition);
      float light = max(0.0, dot(N, L));
      // 透明な宝石ではなく、霜をまとった粗い氷。面ごとの陰影を保つ。
      float frost = grain(floor((vLocal + vSeed) * 95.0));
      float mottling = grain(floor((vLocal + vSeed) * 9.0));
      vec3 ice = mix(vec3(0.48, 0.51, 0.55), vec3(0.84, 0.85, 0.82), vSeed);
      ice *= 0.82 + 0.12 * mottling + 0.06 * frost;
      float sheen = pow(max(0.0, dot(N, normalize(L + V))), 18.0) * 0.10;
      vec3 color = tonemap(ice * (0.018 + light * 0.58) + sheen);
      float fade = 1.0 - smoothstep(32.0, 47.0, abs(vPosition.z));
      gl_FragColor = vec4(color * fade, fade);
    }
