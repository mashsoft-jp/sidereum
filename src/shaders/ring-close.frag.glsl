    uniform vec3 uEye;
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
      vec3 N = normalize(vNormal), L = normalize(vec3(-0.6, 0.5, -0.15));
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
