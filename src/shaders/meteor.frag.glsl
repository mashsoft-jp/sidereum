
    // 流星の光跡。加算合成 (アルファ0) のパスなので、色は画面値を直に書く
    // (トーンマップは通さない — point / bill / coma / tail / line と同じ扱い)。
    // 長さ方向の減衰は頂点色に焼き込んであり、ここでは幅方向だけぼかす
    varying vec3 vCol;
    varying float vY;
    void main() {
      float a = exp(-vY * vY * 3.2);
      gl_FragColor = vec4(vCol * a, 0.0);
    }