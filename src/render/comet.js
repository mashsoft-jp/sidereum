  // 彗星のコマ・尾 (加算合成)。宇宙ビューと地上/月面ビューで共用するため、
  // 視点フレームへ変換済みのベクトルを受け取る。
  //   h*: カメラ(原点)から核へのベクトル  a*: 反太陽方向  v*: 進行方向
  //   rgt*: 画面右方向 (尾を正面から見て軸が縮退したときの予備軸)
  //   scl: ジオメトリを原点まわりに一様縮小した倍率。地上ビューでは天球ドーム上に
  //        置くため 1 未満になる。一様縮小は方向を変えないので見た目の角度は不変
  function drawCometFX(c, act, VPm, tSec, hx, hy, hz, ax, ay, az, vx, vy, vz,
                       fpxV, rgtx, rgty, rgtz, scl) {
    {
      {
        // 遠方では写真のような未解像の頭部と尾、接近時は暗い核と局所ジェットへ遷移
        const camCometDist = Math.hypot(hx, hy, hz) || 1;
        const nucleusPx = bodyR(c) * scl * fpxV / camCometDist;
        const nearT = Math.min(1, Math.max(0, (nucleusPx - 0.7) / 3.3));
        const pixelLod = nearT * nearT * (3 - 2 * nearT);
        const camCometKm = camCometDist / scl / KM2W;   // 実距離に戻して判定
        const distT = Math.min(1, Math.max(0,
          (Math.log(1000000) - Math.log(Math.max(1, camCometKm))) / Math.log(100)));
        const distLod = distT * distT * (3 - 2 * distT);
        const nearLod = Math.max(pixelLod, distLod);
        // 尾を正面・背面から見るとリボンの投影が破綻するため、軸の画面投影量で減衰
        const viewX = hx / camCometDist, viewY = hy / camCometDist, viewZ = hz / camCometDist;
        const axisViewDot = ax * viewX + ay * viewY + az * viewZ;
        const tailFacing = Math.sqrt(Math.max(0, 1 - axisViewDot * axisViewDot));
        const angleT = Math.min(1, Math.max(0, (tailFacing - 0.05) / 0.20));
        const angleVis = angleT * angleT * (3 - 2 * angleT);
        const tailVis = (1 - nearLod) * (1 - nearLod) * angleVis;
        // 核が未解像なら位置を見失わない程度の小さなコマを残し、核が見えたら消す
        const comaVis = (1 - pixelLod) * (1 - distLod * 0.55) + 0.12 * nearLod;
        const jetT = Math.min(1, Math.max(0, (nucleusPx - 1.0) / 3.0));
        const jetVis = Math.max(jetT * jetT * (3 - 2 * jetT), distLod);
        // 尾の幅方向 = 軸×視線 (カメラに正対する帯)
        const sideOf = (bx, by, bz) => {
          let sx = by * hz - bz * hy, sy = bz * hx - bx * hz, sz = bx * hy - by * hx;
          const sl = Math.hypot(sx, sy, sz);
          if (sl < 1e-9) { sx = 0; sy = 1; sz = 0; } else { sx /= sl; sy /= sl; sz /= sl; }
          return [sx, sy, sz];
        };
        // 尾の基準長。実際の彗星の尾は 10^7〜10^8 km (0.07〜0.67 au) で、
        // 大彗星でも 0.5 au 程度が上限。1910年の「尾が空を100〜150°横切った」
        // という記録は、地球が尾のほぼ内部にいたための遠近効果によるもので、
        // 物理長がそれほど必要なわけではない
        const L = act * act * 0.45 * K_REAL * scl;               // 近日点で約 0.45au
        // ダストの湾曲方向 (尾とジェットの両方で使うのでここで求めておく)
        const av = ax * vx + ay * vy + az * vz;
        let cvx = vx - ax * av, cvy = vy - ay * av, cvz = vz - az * av;
        const cvl = Math.hypot(cvx, cvy, cvz) || 1;
        cvx /= cvl; cvy /= cvl; cvz /= cvl;
        let s;
        gl.useProgram(tailP.pr);
        gl.uniformMatrix4fv(tailP.u.uVP, false, VPm);
        gl.uniform3f(tailP.u.uHead, hx, hy, hz);
        gl.uniform1f(tailP.u.uTime, tSec);
        gl.bindBuffer(gl.ARRAY_BUFFER, tailVB);
        gl.enableVertexAttribArray(tailP.a.aCorner);
        gl.vertexAttribPointer(tailP.a.aCorner, 2, gl.FLOAT, false, 0, 0);
        // 尾がほぼ見えない向き・距離なら4層ぶんの描画をまとめて省く
        if (tailVis > 0.004) {
          // ダストテイル。反太陽方向から徐々に進行方向の後方へ曲がる。
          // 太陽光の反射なので先端まで黄白のまま、薄くなるだけ (青くはならない)
          const curve = 0.16;
          s = sideOf(ax - cvx * curve, ay - cvy * curve, az - cvz * curve);
          gl.uniform3f(tailP.u.uAxis, ax, ay, az);
          gl.uniform3f(tailP.u.uCurve, -cvx * curve, -cvy * curve, -cvz * curve);
          gl.uniform3f(tailP.u.uSide, s[0], s[1], s[2]);
          // ダストは放出速度が遅く広い角度に散るため扇状に広がる (全開角 約32°)。
          // 細い直線状なのはイオンテイルの方
          gl.uniform2f(tailP.u.uDim, L * 0.74, L * 0.21);
          gl.uniform3f(tailP.u.uCol1, 1.0, 0.95, 0.86);
          gl.uniform3f(tailP.u.uCol2, 0.74, 0.66, 0.54);
          gl.uniform1f(tailP.u.uKind, 1);
          gl.uniform1f(tailP.u.uSeed, 2.7);
          gl.uniform1f(tailP.u.uAlpha, 0.46 * act * tailVis);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, TAIL_VERTS);
          // ダストの内層を重ね、コマから続く明るい流れを作る
          gl.uniform2f(tailP.u.uDim, L * 0.68, L * 0.15);
          gl.uniform3f(tailP.u.uCol1, 1.0, 0.99, 0.94);
          gl.uniform3f(tailP.u.uCol2, 0.84, 0.78, 0.66);
          gl.uniform1f(tailP.u.uSeed, 7.1);
          gl.uniform1f(tailP.u.uAlpha, 0.34 * act * tailVis);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, TAIL_VERTS);
          // イオンテイルの外層 (青白, 反太陽方向にほぼ直線)
          s = sideOf(ax, ay, az);
          gl.uniform3f(tailP.u.uAxis, ax, ay, az);
          gl.uniform3f(tailP.u.uCurve, 0, 0, 0);
          gl.uniform3f(tailP.u.uSide, s[0], s[1], s[2]);
          gl.uniform2f(tailP.u.uDim, L * 1.18, L * 0.042);
          gl.uniform3f(tailP.u.uCol1, 0.68, 0.90, 1.0);
          gl.uniform3f(tailP.u.uCol2, 0.18, 0.38, 1.0);
          gl.uniform1f(tailP.u.uKind, 0);
          gl.uniform1f(tailP.u.uSeed, 4.3);
          gl.uniform1f(tailP.u.uAlpha, 0.30 * act * tailVis);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, TAIL_VERTS);
          // イオンテイルの細い発光芯
          gl.uniform2f(tailP.u.uDim, L * 1.08, L * 0.024);
          gl.uniform3f(tailP.u.uCol1, 0.88, 0.98, 1.0);
          gl.uniform3f(tailP.u.uCol2, 0.28, 0.52, 1.0);
          gl.uniform1f(tailP.u.uSeed, 9.4);
          gl.uniform1f(tailP.u.uAlpha, 0.22 * act * tailVis);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, TAIL_VERTS);
        }
        // 接近時: 太陽に熱せられた核表面から噴き、反太陽方向へ曲げられる局所ジェット
        if (jetVis > 0.01) {
          let qx = ay * cvz - az * cvy, qy = az * cvx - ax * cvz, qz = ax * cvy - ay * cvx;
          const ql = Math.hypot(qx, qy, qz) || 1;
          qx /= ql; qy /= ql; qz /= ql;
          const jetLen = bodyR(c) * scl * (28 + 12 * act);
          const drawJet = (jx0, jy0, jz0, spread, seed, alpha) => {
            const jl = Math.hypot(jx0, jy0, jz0) || 1;
            const jx = jx0 / jl, jy = jy0 / jl, jz = jz0 / jl;
            const js = sideOf(jx, jy, jz);
            gl.uniform3f(tailP.u.uAxis, jx, jy, jz);
            gl.uniform3f(tailP.u.uCurve, ax * 0.42, ay * 0.42, az * 0.42);
            gl.uniform3f(tailP.u.uSide, js[0], js[1], js[2]);
            gl.uniform2f(tailP.u.uDim, jetLen, bodyR(c) * scl * spread);
            gl.uniform3f(tailP.u.uCol1, 0.92, 0.90, 0.82);
            gl.uniform3f(tailP.u.uCol2, 0.36, 0.43, 0.52);
            gl.uniform1f(tailP.u.uKind, 1);
            gl.uniform1f(tailP.u.uSeed, seed);
            gl.uniform1f(tailP.u.uAlpha, alpha * act * jetVis);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, TAIL_VERTS);
          };
          drawJet(-ax + cvx * 0.28 + qx * 0.10,
                  -ay + cvy * 0.28 + qy * 0.10,
                  -az + cvz * 0.28 + qz * 0.10, 3.0, 3.2, 0.34);
          drawJet(-ax - cvx * 0.18 - qx * 0.22,
                  -ay - cvy * 0.18 - qy * 0.22,
                  -az - cvz * 0.18 - qz * 0.22, 2.2, 8.6, 0.24);
        }
        // コマ (太陽側が圧縮された涙滴型。反太陽側はそのまま尾に連続する)
        gl.useProgram(comaP.pr);
        gl.uniformMatrix4fv(comaP.u.uVP, false, VPm);
        gl.uniform3f(comaP.u.uHead, hx, hy, hz);
        gl.uniform1f(comaP.u.uCore, 1 - pixelLod);
        // コマは投影した尾方向を使う。正面視ではカメラ正対の円形へ滑らかに移行
        const comaT = Math.min(1, Math.max(0, (tailFacing - 0.03) / 0.30));
        const comaFacing = comaT * comaT * (3 - 2 * comaT);
        let pax = ax - viewX * axisViewDot;
        let pay = ay - viewY * axisViewDot;
        let paz = az - viewZ * axisViewDot;
        const pal = Math.hypot(pax, pay, paz);
        if (pal < 1e-5) {
          pax = rgtx; pay = rgty; paz = rgtz;
        } else {
          pax /= pal; pay /= pal; paz /= pal;
        }
        s = sideOf(pax, pay, paz);
        gl.uniform3f(comaP.u.uAxis, pax, pay, paz);
        gl.uniform3f(comaP.u.uSide, s[0], s[1], s[2]);
        gl.uniform1f(comaP.u.uFacing, comaFacing);
        const comaFar = (1 - distLod) * (1 - distLod);
        const comaCloseXpx = Math.max(8, nucleusPx * 2.2);
        const comaCloseYpx = Math.max(6, nucleusPx * 1.6);
        // 係数は L を短くしたぶんを打ち消してあり、遠方でのコマの見かけの
        // 大きさは尾の長さ変更前と同じになる (0.72*0.014 = 0.45*0.0224)
        const comaX = L * 0.0224 * comaFar + camCometDist / fpxV * comaCloseXpx * (1 - comaFar);
        const comaY = L * 0.0144 * comaFar + camCometDist / fpxV * comaCloseYpx * (1 - comaFar);
        const comaProjX = comaY + (comaX - comaY) * comaFacing;
        gl.uniform2f(comaP.u.uDim, comaProjX, comaY);
        gl.uniform3f(comaP.u.uCol, 0.70, 0.78, 0.86);
        gl.uniform1f(comaP.u.uAlpha, 0.92 * act * comaVis);
        gl.bindBuffer(gl.ARRAY_BUFFER, billVB);
        gl.enableVertexAttribArray(comaP.a.aCorner);
        gl.vertexAttribPointer(comaP.a.aCorner, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

  // 彗星の活動度 (0=不活発, 1=近日点)。氷の昇華は境界で突然始まらないため滑らかに
  function cometAct(c) {
    const pa = posAU.get(c.key);
    const rau = Math.hypot(pa[0], pa[1], pa[2]);
    const t = Math.min(1, Math.max(0, (3 - rau) / 2.4));
    return t * t * (3 - 2 * t);
  }

