    // 大気減光 (加算で描く光源用)。彗星のコマと尾で共有する。
    //
    // 尾は空を数十度またぐので、核1点の透過率を全体へ掛けると、地平ぎわの
    // 核に合わせて天頂近くの尾まで同じだけ暗くなる。天の川 (sky.frag) と
    // 同じく画素ごとに解く — 地平フレームでは位置ベクトルの y がそのまま
    // 見かけの高度の sin になる。
    //
    // uExtK = 減光係数 [等級/大気路長] (core/math.js の EXT_K)。
    // 大気の無い経路 (宇宙・月面) では 0 を渡す
    uniform vec3 uExtK;
    vec3 extinctAt(vec3 w) {
      if (uExtK.g <= 0.0) return vec3(1.0);
      float h = max(degrees(asin(clamp(normalize(w).y, -1.0, 1.0))), -1.5);
      float X = 1.0 / (sin(radians(h)) + 0.50572 * pow(h + 6.07995, -1.6364));
      return exp2(-1.3287712 * uExtK * (X - 1.0));   // 10^(-0.4 k (X-1))
    }
