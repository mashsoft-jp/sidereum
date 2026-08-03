
    attribute vec3 aPos;
    uniform mat4 uMVP, uModel;
    uniform float uComet;
    uniform vec3 uOblate;              // 赤道/極の伸縮 (真球なら 1,1,1)
    varying vec3 vL, vW, vN;
    void main() {
      vec3 q = aPos;
      vec3 nrm = aPos;                 // 単位球なので既定では位置がそのまま法線
      vL = aPos;                       // 模様とテクスチャは単位球の向きで引く
      if (uComet > 0.5) {
        // ハレー核の実測に近い細長い比率と、低ポリ化せず分かる程度の凹凸
        vec3 s = vec3(1.28, 0.72, 0.82);
        q *= s;
        float rough = 1.0 + sin(q.x * 19.0 + q.y * 13.0) *
                            sin(q.z * 17.0 - q.x * 7.0) * 0.055;
        q *= rough;
        // 非等方スケール後は「位置 = 法線」が成り立たない。楕円体の法線は
        // 逆数スケールに比例する (位置を使うと明暗境界が最大30°ずれる)。
        // 凹凸ぶんの傾きは頂点シェーダでは出せないため近似のまま
        nrm = normalize(aPos / s);
        vL = q;                        // 彗星だけは歪んだ形そのものを模様の座標にする
      } else {
        // 自転で赤道方向に膨らんだ回転楕円体。非等方スケールなので法線は
        // 逆数スケールで出す (位置をそのまま使うと明暗境界がずれる)
        q = aPos * uOblate;
        nrm = normalize(aPos / uOblate);
      }
      vW = (uModel * vec4(q, 1.0)).xyz;
      vN = normalize((uModel * vec4(nrm, 0.0)).xyz);
      gl_Position = uMVP * vec4(q, 1.0);
    }