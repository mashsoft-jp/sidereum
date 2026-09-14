    uniform vec3 uEye;
    uniform float uFloor;
    varying vec3 vNormal, vLocal, vPosition;
    varying float vSeed;
    float grain(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float iceNoise(vec3 p) {
      vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(grain(i),grain(i+vec3(1,0,0)),f.x),
                     mix(grain(i+vec3(0,1,0)),grain(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(grain(i+vec3(0,0,1)),grain(i+vec3(1,0,1)),f.x),
                     mix(grain(i+vec3(0,1,1)),grain(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
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
      // 模様を面の明暗にだけ載せず、霜の凹凸を画素単位の法線へ反映する。
      vec3 p=vLocal*24.0+vSeed*71.0;
      float frost=iceNoise(p);
      vec3 gradient=vec3(iceNoise(p+vec3(.12,0,0)),iceNoise(p+vec3(0,.12,0)),iceNoise(p+vec3(0,0,.12)))-frost;
      float detail=1.0-smoothstep(8.0,28.0,distanceToEye);
      N=normalize(N-(gradient-N*dot(gradient,N))*1.7*detail);
      float light = max(0.0, dot(N, L));
      float mottling = iceNoise(vLocal*6.0+vSeed*43.0);
      vec3 ice = mix(vec3(0.57,0.65,0.70),vec3(.86,.88,.86),vSeed);
      ice *= .80+.16*mottling+.04*frost;
      float sheen = pow(max(0.0, dot(N, normalize(L + V))), 26.0) * .08;
      float scatter=pow(max(0.0,dot(-L,V)),3.0)*.045;
      vec3 color=tonemap(ice*(.024+light*.58+scatter)+sheen);
      float fade = 1.0 - smoothstep(32.0, 47.0, abs(vPosition.z));
      gl_FragColor = vec4(color * fade, fade);
    }
