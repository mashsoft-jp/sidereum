
    // 昼の空の色 (地上ビュー)。空ドームと、天体に上乗せする大気の光 (エアライト)
    // で同じ式を使うため切り出してある。夜 (day=0) は黒を返すので、そのまま
    // 加算しても夜空を持ち上げない。
    //   d = 視線方向 (地平フレーム [東, 天頂, -北])  s = 太陽方向  day = 昼夜係数
    vec3 skyDayColor(vec3 d, vec3 s, float day) {
      float h = clamp(d.y, 0.0, 1.0);
      vec3 zen = vec3(0.16, 0.34, 0.68);
      vec3 hor = vec3(0.55, 0.70, 0.88);
      vec3 c = mix(hor, zen, pow(h, 0.55));
      // 太陽の方位・高度に近いほど暖色 (低い太陽ほど強く広がる)
      float sd = max(dot(d, normalize(s)), 0.0);
      float low = 1.0 - smoothstep(0.0, 0.35, s.y);
      vec3 warm = mix(vec3(0.95, 0.55, 0.25), vec3(0.85, 0.35, 0.18), low);
      c = mix(c, warm, low * pow(sd, 3.0) * 0.85);
      // 地平近くはうっすら霞む
      c = mix(c, mix(c, vec3(0.72, 0.76, 0.82), 0.35), 1.0 - smoothstep(0.0, 0.18, h));
      return c * day;
    }
