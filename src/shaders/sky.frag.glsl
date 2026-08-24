
    // 天の川 (拡散光だけの全天マップ)。赤道座標の正距円筒を天球へ貼る。
    // 加算合成で背景として重ねるだけなので、画面の色を直に書く
    // (点・尾・コマなどの発光パスと同じ扱い。トーンマップは通さない)
    varying vec3 vDir;
    uniform mat3 uEq;        // 描画フレームの方向 → 赤道座標
    uniform float uBright;   // 明るさ (昼は 0 へ落とす)
    uniform sampler2D uTex;

    void main() {
      vec3 q = normalize(uEq * normalize(vDir));
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
      gl_FragColor = vec4(c * uBright, 0.0);   // 乗算済みアルファでの加算
    }
