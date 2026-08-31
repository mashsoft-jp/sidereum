
    // 天の川 (拡散光だけの全天マップ)。赤道座標の正距円筒を天球へ貼る。
    // 加算合成で背景として重ねるだけなので、画面の色を直に書く
    // (点・尾・コマなどの発光パスと同じ扱い。トーンマップは通さない)
    varying vec3 vDir;
    uniform mat3 uEq;        // 描画フレームの方向 → 赤道座標
    uniform float uBright;   // 明るさ (昼は 0 へ落とす)
    uniform float uRefr;     // 1 = 地上ビュー (大気差を戻してから地図を引く)
    uniform vec3 uExtK;      // 大気減光 [等級/大気路長]。大気の無い経路では 0
    uniform sampler2D uTex;

    void main() {
      vec3 dir = normalize(vDir);
      float aAlt = degrees(asin(clamp(dir.y, -1.0, 1.0)));   // 見かけの高度 (減光に使う)
      if (uRefr > 0.5) {
        // この画素が指しているのは「見かけの向き」なので、地図を引く前に
        // 大気差ぶん下げる。恒星・星座線を持ち上げているのと同じ量だけずらす
        // (Bennett の式。見かけの高度 → 大気差 [分角])
        float ha = degrees(asin(clamp(dir.y, -1.0, 1.0)));
        float hc = max(ha, -1.0);
        float r = 1.0 / tan(radians(hc + 7.31 / (hc + 4.4))) / 60.0;
        r *= clamp(1.0 + (ha + 1.0) / 3.0, 0.0, 1.0);      // 地平線の下では効かせない
        float h2 = radians(ha - r), ch = cos(radians(ha));
        float k = ch > 1e-6 ? cos(h2) / ch : 1.0;
        dir = vec3(dir.x * k, sin(h2), dir.z * k);
      }
      vec3 q = normalize(uEq * dir);
      // 地図は左端が赤経 0h、上端が赤緯 +90°。赤経は負側へ回っても REPEAT が畳む
      vec2 uv = vec2(atan(q.y, q.x) * 0.15915494,
                     0.5 - asin(clamp(q.z, -1.0, 1.0)) * 0.31830989);
#ifdef TEXLOD
      // 赤経は uv の継ぎ目で 1→0 に飛ぶ。自動微分に任せるとその1列だけミップ段が
      // 最粗まで落ちて空を縦に切る縞が出るので、折り返しを含まない微分を作って渡す
      // (天体テクスチャと同じ理由。詳しくは body.frag の SAMPLE)
      vec3 dx = dFdx(q), dy = dFdy(q);
      float r2 = max(q.x * q.x + q.y * q.y, 1e-8);
      float sv = 3.14159265 * sqrt(max(1.0 - q.z * q.z, 1e-8));
      vec2 dux = vec2((q.x * dx.y - q.y * dx.x) / (r2 * 6.2831853), -dx.z / sv);
      vec2 duy = vec2((q.x * dy.y - q.y * dy.x) / (r2 * 6.2831853), -dy.z / sv);
      vec3 c = texture2DGradEXT(uTex, uv, dux, duy).rgb;
#else
      vec3 c = texture2D(uTex, uv).rgb;
#endif
      // 大気減光。地平ぎわの天の川は青から失われ、薄れて消える。
      // 恒星に掛けているのと同じ式 (core/math.js の EXT_K)
      if (uExtK.g > 0.0) {
        float h = max(aAlt, -1.5);
        float X = 1.0 / (sin(radians(h)) + 0.50572 * pow(h + 6.07995, -1.6364));
        c *= exp2(-1.3287712 * uExtK * (X - 1.0));   // 10^(-0.4 k (X-1))
      }
      gl_FragColor = vec4(outAdd(c * uBright), 0.0);   // 乗算済みアルファでの加算
    }
