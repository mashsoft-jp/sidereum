    varying vec2 vQ;
    varying vec3 vCol;
    uniform sampler2D uPhoto;
    uniform float uCore;
    uniform float uReflection;
    uniform vec2 uTexel;
    void main() {
      vec2 uv = vec2(vQ.x * 0.5 + 0.5, 0.5 - vQ.y * 0.5);
      vec4 texel = texture2D(uPhoto, uv);
      vec3 rgb = texel.rgb;
      float edge = (1.0-smoothstep(0.80,1.0,abs(vQ.x))) * (1.0-smoothstep(0.80,1.0,abs(vQ.y)));
      edge *= mix(1.0, 1.0-smoothstep(0.48,0.90,length(vQ)), uCore);
      if (uReflection > 0.5) {
        // In the space view retain diffuse reflection nebulosity, not the dense
        // photographic background star field. The catalogue supplies the stars.
        vec2 delta = uTexel * 2.0;
        rgb = min(rgb, texture2D(uPhoto, uv + vec2(delta.x,0.0)).rgb);
        rgb = min(rgb, texture2D(uPhoto, uv - vec2(delta.x,0.0)).rgb);
        rgb = min(rgb, texture2D(uPhoto, uv + vec2(0.0,delta.y)).rgb);
        rgb = min(rgb, texture2D(uPhoto, uv - vec2(0.0,delta.y)).rgb);
        edge *= 1.0-smoothstep(0.12,0.92,length((vQ-vec2(0.0,-0.08))*vec2(1.0,0.9)));
        rgb *= 0.32;
      }
      // Remove the JPEG sky pedestal; dark mosaic gaps contribute no light.
      rgb = max(vec3(0.0), rgb - vec3(0.018));
      gl_FragColor = vec4(rgb * vCol * edge * texel.a * 0.8, 0.0);
    }
