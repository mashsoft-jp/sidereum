    attribute vec3 aPos, aNormal, aCenter;
    attribute float aSeed;
    uniform mat4 uVP;
    uniform float uTravel, uFloor;
    varying vec3 vNormal, vLocal, vPosition;
    varying float vSeed;
    void main() {
      vec3 center = aCenter;
      if (uFloor < 0.5) center.z = mod(center.z + uTravel + 48.0, 96.0) - 48.0;
      vPosition = aPos + center;
      vLocal = aPos;
      vNormal = aNormal;
      vSeed = aSeed;
      gl_Position = uVP * vec4(vPosition, 1.0);
    }
