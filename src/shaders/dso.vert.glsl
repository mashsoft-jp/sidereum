
    // 星雲・星団。板の頂点はすでにワールド座標で組んであるので、ここでは
    // 変換するだけ (楕円の形と位置角は CPU 側で入れてある)
    attribute vec3 aPos;
    attribute vec2 aQuad;    // 板の隅 (-1〜1)。減衰に使う
    attribute vec3 aCol;     // 中心の明るさ (画面色)
    uniform mat4 uVP;
    varying vec2 vQ;
    varying vec3 vCol;
    void main() {
      vQ = aQuad;
      vCol = aCol;
      gl_Position = uVP * vec4(aPos, 1.0);
    }
