  // 土星主環の局所的な鑑賞用模式景。粒子の個体形状は実測復元ではない。
  // NASA: https://science.nasa.gov/mission/cassini/science/rings/
  let ringExplore = null, ringCloseMesh = null;

  function makeRingFragments(count = 680) {
    let seed = 61723;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const unit = p => { const n = Math.hypot(...p); return p.map(v => v / n); };
    const phi = (1 + Math.sqrt(5)) / 2;
    const original = [[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],
      [0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(unit);
    const faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],
      [10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    const verts = original.slice(), triangles = [], midpoints = new Map();
    const midpoint = (a,b) => {
      const key = [Math.min(a,b),Math.max(a,b)].join(':');
      if (!midpoints.has(key)) { midpoints.set(key, verts.length); verts.push(unit(verts[a].map((v,i)=>(v+verts[b][i])/2))); }
      return midpoints.get(key);
    };
    for (const [a,b,c] of faces) {
      const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
      triangles.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    const data = [], pieces = [];
    for (let n=0;n<count;n++) {
      const size = .09 + Math.pow(random(), 2.6) * .90;
      const center = [(random()-.5)*44, -.25 + random()*.45, (random()-.5)*96];
      const stretch = [.65+random()*.95, .25+random()*.50, .55+random()*.95];
      const angle=random()*Math.PI*2, ca=Math.cos(angle),sa=Math.sin(angle), tint=random();
      const shape = verts.map(v => {
        const r = size*(.72+random()*.48);
        const x=v[0]*stretch[0]*r,z=v[2]*stretch[2]*r;
        return [x*ca-z*sa,v[1]*stretch[1]*r,x*sa+z*ca];
      });
      pieces.push({center,size,shape});
      for (const face of triangles) {
        const [a,b,c]=face.map(i=>shape[i]);
        const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
        const normal=unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);
        for (const p of [a,b,c]) {
          const radial=unit(p);
          const worn=unit(normal.map((v,i)=>v*.72+radial[i]*.28));
          data.push(...p,...worn,...center,tint);
        }
      }
    }
    return {data:new Float32Array(data),pieces};
  }

  function initRingCloseMesh() {
    if (ringCloseMesh) return;
    const fragments=makeRingFragments();
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,fragments.data,gl.STATIC_DRAW);
    const floor=gl.createBuffer(), data=[];
    for(const p of [[-160,-.45,-160],[160,-.45,-160],[-160,-.45,160],[-160,-.45,160],[160,-.45,-160],[160,-.45,160]])
      data.push(...p,0,1,0,0,0,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,floor);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    ringCloseMesh={buffer,floor,count:fragments.data.length/10};
  }

  function stepRingExplore(dt) {
    if (!ringExplore || enjoymentPaused || document.hidden || snapPending || snapDlgEl.classList.contains('open')) return;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) ringExplore.travel=(ringExplore.travel+dt*.65)%96;
  }

  function renderRingExplore() {
    initRingCloseMesh();
    const s=ringExplore,eye=[0,s.height,0];
    const cp=Math.cos(s.pitch),direction=[Math.sin(s.yaw)*cp,Math.sin(s.pitch),-Math.cos(s.yaw)*cp];
    const view=mLookAt(eye,eye.map((v,i)=>v+direction[i]),UP3);
    const projection=mPersp(58*DEG,W/H,.06,450);
    const vp=mMul(projection,view);
    skyDayF=0;
    gl.depthMask(true);gl.clearColor(.008,.011,.018,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    drawMilkyWay(vp,mwEqSpace(),200,.07,0);
    // 背景の土星は角直径を環内の観測者に合わせる。粒子の距離スケールとは分離。
    const sat=BODY_BY_KEY.get('saturn');
    const model=mTRS([-35,0,-105],mRotX(0),55);
    bodyRenderer.beginPass({time:0,cameraPosition:eye,depthTest:true,depthWrite:true});
    bodyRenderer.draw({body:sat,model,mvp:mMul(vp,model),sunPosition:[-500,800,350],radiusPx:H*.55});
    bodyRenderer.endPass();
    gl.useProgram(ringCloseP.pr);
    gl.uniformMatrix4fv(ringCloseP.u.uVP,false,vp);
    gl.uniform3f(ringCloseP.u.uEye,...eye);
    gl.uniform1f(ringCloseP.u.uTravel,s.travel);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    const bind=buffer=>{
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [name,size,offset] of [['aPos',3,0],['aNormal',3,12],['aCenter',3,24],['aSeed',1,36]]) {
        gl.enableVertexAttribArray(ringCloseP.a[name]);gl.vertexAttribPointer(ringCloseP.a[name],size,gl.FLOAT,false,40,offset);
      }
    };
    bind(ringCloseMesh.floor);gl.uniform1f(ringCloseP.u.uFloor,1);gl.drawArrays(gl.TRIANGLES,0,6);
    gl.depthMask(true);bind(ringCloseMesh.buffer);gl.uniform1f(ringCloseP.u.uFloor,0);
    gl.drawArrays(gl.TRIANGLES,0,ringCloseMesh.count);
    gl.disable(gl.BLEND);gl.depthMask(true);
  }

  function drawRingExploreCaption() {
    octx.save();octx.textAlign='center';octx.shadowColor='rgba(0,0,0,.9)';octx.shadowBlur=6;
    octx.fillStyle='rgba(225,232,239,.88)';octx.font='16px sans-serif';
    octx.fillText(lang==='ja'?'土星の環を探る':'Inside Saturn’s rings',W/2,42);
    octx.font='11px sans-serif';octx.fillStyle='rgba(180,193,207,.8)';
    octx.fillText(lang==='ja'?'氷粒子の形・大きさ・間隔を強調したイメージ':'Illustration · particle shapes, sizes and spacing enhanced',W/2,64);
    octx.fillText(lang==='ja'?'ドラッグで見回す':'Drag to look around',W/2,84);
    octx.restore();
  }
