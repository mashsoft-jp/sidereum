
    varying vec3 vL, vW, vN;
    uniform float uType, uTime, uHasTex, uComet;
    uniform vec3 uCam, uSun, uColA, uColB, uColC, uRim;
    uniform vec4 uParams;
    uniform sampler2D uTex;

    float hash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
        f.z);
    }
    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int k = 0; k < 5; k++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 p = normalize(vL);
      vec3 N = normalize(vN);
      vec3 V = normalize(uCam - vW);

      if (uType < 0.5) {
        // ---- 太陽 ----
        float n = fbm(p * 4.0 + vec3(0.0, uTime * 0.05, uTime * 0.02));
        float g = noise(p * 22.0 + uTime * 0.25);
        vec3 c = mix(uColA, uColB, smoothstep(0.2, 0.85, n + g * 0.18));
        float mu = max(dot(N, V), 0.0);
        c *= 0.5 + 0.6 * mu;                       // 周縁減光
        c += uColB * pow(1.0 - mu, 2.0) * 0.6;     // 縁の輝き
        gl_FragColor = vec4(c * 1.25, 1.0);
        return;
      }

      vec3 L = normalize(uSun - vW);                // 光源 = 太陽 (カメラ相対座標)
      float dif = max(dot(N, L), 0.0);
      float lat = p.y;
      vec3 alb = vec3(0.5);
      float spec = 0.0;

      if (uComet > 0.5) {
        // ---- 彗星核: 自発光しない、煤と有機物に覆われた非常に暗い表面 ----
        float rock = fbm(p * 6.0 + 2.0);
        float pits = fbm(p * 18.0 - 4.0);
        alb = mix(vec3(0.040, 0.043, 0.046), vec3(0.240, 0.195, 0.145), rock);
        alb *= 0.58 + 0.52 * smoothstep(0.28, 0.76, pits);
      } else if (uHasTex > 0.5) {
        // ---- 実テクスチャ (NASA/USGS 全球マップ) ----
        vec2 uv = vec2(0.5 - atan(p.z, p.x) / 6.2831853,
                       acos(clamp(p.y, -1.0, 1.0)) / 3.14159265);
        alb = texture2D(uTex, uv).rgb;
        if (uType > 3.5 && uType < 4.5) {
          // 地球のみ: 雲と海面の鏡面反射を重ねる
          float ocean = smoothstep(0.02, 0.12, alb.b - alb.r) * smoothstep(0.02, 0.12, alb.b - alb.g);
          float cl = smoothstep(0.55, 0.78, fbm(p * 4.5 + vec3(uTime * 0.02, 0.0, uTime * 0.007)));
          alb = mix(alb, vec3(1.0), cl * 0.7);
          spec = pow(max(dot(reflect(-L, N), V), 0.0), 42.0) * ocean * (1.0 - cl) * 0.55;
        }
      } else if (uType < 1.5) {
        // ---- 岩石 (テクスチャ無し小天体) ----
        float m = fbm(p * 5.0);
        float cr = fbm(p * 16.0 + 5.0);
        alb = mix(uColB, uColA, m);
        alb *= 0.82 + 0.36 * smoothstep(0.35, 0.75, cr);
      } else if (uType < 2.5) {
        // ---- 火星 ----
        alb = mix(uColA, uColB, fbm(p * 4.0));
        alb *= 0.8 + 0.4 * fbm(p * 9.0 + 2.0);
        alb = mix(alb, vec3(0.93, 0.94, 0.95), smoothstep(0.84, 0.92, abs(lat) + 0.05 * fbm(p * 6.0)));
      } else if (uType < 3.5) {
        // ---- 金星 (雲) ----
        float sw = fbm(vec3(p.x * 2.2, p.y * 6.5, p.z * 2.2) + vec3(uTime * 0.02, 0.0, 0.0));
        alb = mix(uColA, uColB, sw);
      } else {
        // ---- ガス惑星 / 氷惑星 ----
        float d = fbm(p * vec3(3.0, 8.0, 3.0)) * uParams.y;
        float band = sin(lat * uParams.x * 3.14159 + d * 4.0) * 0.5 + 0.5;
        alb = mix(uColA, uColB, band);
        alb = mix(alb, uColC, smoothstep(0.62, 0.95, fbm(p * vec3(2.0, 9.0, 2.0) + 7.0)) * 0.4);
        if (uParams.z > 0.5) {
          // 大赤斑
          float sd = distance(p, normalize(vec3(0.78, -0.32, 0.53)));
          alb = mix(vec3(0.71, 0.30, 0.18), alb, smoothstep(0.07, 0.17, sd));
        }
      }

      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
      alb += uRim * fres * (0.25 + 0.75 * dif) * 0.55;

      // 彗星核だけは宇宙空間らしく夜側をほぼ黒くし、他天体は従来の視認性を保つ
      float ambient = mix(0.3, 0.150, uComet);
      float direct = mix(0.9, 1.08, uComet);
      vec3 c = alb * (ambient + dif * direct) + vec3(spec) * dif;
      gl_FragColor = vec4(pow(c, vec3(0.92)), 1.0);
    }