  const copyRingCamera = source => Object.fromEntries(Object.entries(source).map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));
  let ringReturnFade = null;
  const ringReturnVeil = document.getElementById('ringReturnVeil');
  const frameRingBtn = document.getElementById('frameRing');
  function beginRingExplore() {
    if (groundView || tourActive || selected?.key !== 'saturn' || ringExplore || ringReturnFade) return;
    const saved = {cam: copyRingCamera(cam),
      zoom:camZoom,zoomTgt:camZoomTgt,playing,layout:{...frameLayout}};
    setImmersive(true);
    cameraFlight=null;
    Object.assign(cam,copyRingCamera(saved.cam));
    camZoom=saved.zoom;camZoomTgt=saved.zoomTgt;
    frameLayout.fit=null;
    const radius=bodyR(selected), center=posW.get('saturn'), pole=planetRingPole(selected);
    const direction=[Math.cos(cam.pitch)*Math.cos(cam.yaw),Math.sin(cam.pitch),Math.cos(cam.pitch)*Math.sin(cam.yaw)];
    const dot=direction.reduce((sum,v,i)=>sum+v*pole[i],0);
    let radial=direction.map((v,i)=>v-dot*pole[i]);
    let length=Math.hypot(...radial);
    if(length<.01){radial=[SAT_ROT[0],SAT_ROT[1],SAT_ROT[2]];length=Math.hypot(...radial);}
    const near=copyRingCamera(cam);
    near.focus=near.focusTgt=center.map((v,i)=>v+radial[i]/length*radius*1.9);
    near.panOff=near.panOffTgt=[0,0,0]; near.dist=near.distTgt=radius*1.3;
    ringExplore={saved,near,travel:0,yaw:0,pitch:-.13,pointer:null,
      phase:matchMedia('(prefers-reduced-motion: reduce)').matches?'inside':'approach',elapsed:0,shade:0};
    setPlaying(false);
    syncFramingUI();
  }
  function endRingExplore() {
    if (!ringExplore) return;
    const saved=ringExplore.saved;
    ringExplore=null;
    Object.assign(cam,copyRingCamera(saved.cam));
    camZoom=saved.zoom;camZoomTgt=saved.zoomTgt;
    Object.assign(frameLayout,saved.layout);
    cameraFlight=null;
    setPlaying(saved.playing);
  }
  function requestRingExit() {
    if(!ringExplore || ringExplore.saver)return false;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
    if(ringExplore.phase==='exitFade')return true;
    ringExplore.exitFromSpace=ringExplore.phase==='approach';
    if(ringExplore.exitFromSpace)ringExplore.near=copyRingCamera(cam);
    ringExplore.exitShade=ringExplore.shade;
    ringExplore.phase='exitFade';ringExplore.elapsed=0;
    return true;
  }
  function ringSpaceView() {
    return ringExplore && (ringExplore.phase==='approach' || (ringExplore.phase==='exitFade' && ringExplore.exitFromSpace));
  }
  function stepRingTransition(dt) {
    if(ringReturnFade) {
      ringReturnFade.elapsed+=dt;
      const t=Math.min(1,ringReturnFade.elapsed/.65);
      Object.assign(cam,copyRingCamera(ringReturnFade.cam));
      ringReturnVeil.style.opacity=String(1-t*t*(3-2*t));
      if(t===1){ringReturnFade=null;ringReturnVeil.hidden=true;}
      return;
    }
    const s=ringExplore;
    if(!s || s.saver || s.phase==='inside')return;
    s.elapsed+=dt;
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    if(s.phase==='approach') {
      const t=Math.min(1,s.elapsed/2.8),e=smooth(t);
      cam.dist=cam.distTgt=1/((1-e)/s.saved.cam.dist+e/s.near.dist);
      const offset=s.saved.cam.focus.map((v,i)=>v-s.near.focus[i]);
      const span=Math.hypot(...offset.map((v,i)=>v+s.saved.cam.panOff[i]));
      const residual=span>1e-12?cam.dist*Math.tan(Math.atan2(span,s.saved.cam.dist)*(1-e))/span:(1-e)*cam.dist/s.saved.cam.dist;
      cam.focus=s.near.focus.map((v,i)=>v+offset[i]*residual);cam.focusTgt=cam.focus.slice();
      cam.panOff=s.saved.cam.panOff.map(v=>v*residual);cam.panOffTgt=cam.panOff.slice();
      cam.yaw=cam.yawTgt=s.saved.cam.yaw;cam.pitch=cam.pitchTgt=s.saved.cam.pitch;
      camZoom=camZoomTgt=s.saved.zoom+(1-s.saved.zoom)*e;
      s.shade=smooth((t-.75)/.25);
      if(t===1){s.phase='reveal';s.elapsed=0;}
    } else if(s.phase==='reveal') {
      s.shade=1-smooth(s.elapsed/.75);
      if(s.elapsed>=.75){s.phase='inside';s.shade=0;}
    } else if(s.phase==='exitFade') {
      if(s.exitFromSpace)Object.assign(cam,copyRingCamera(s.near));
      s.shade=s.exitShade+(1-s.exitShade)*smooth(s.elapsed/.5);
      if(s.elapsed>=.5){
        ringReturnVeil.hidden=false;ringReturnVeil.style.opacity='1';
        endRingExplore();setImmersive(false);
        ringReturnFade={elapsed:0,cam:copyRingCamera(cam)};
        frameRingBtn.focus({preventScroll:true});
      }
    }
  }
  frameRingBtn.addEventListener('click',beginRingExplore);
  const ringCanvasEvent=e=>ringExplore && (e.target===glc || e.target===ovl);
  frameApp.addEventListener('pointerdown',e=>{
    if(!ringCanvasEvent(e))return;
    e.preventDefault();e.stopImmediatePropagation();
    ringExplore.pointer={id:e.pointerId,x:e.clientX,y:e.clientY};
    e.target.setPointerCapture(e.pointerId);
  },true);
  frameApp.addEventListener('pointermove',e=>{
    if(!ringCanvasEvent(e))return;
    e.preventDefault();e.stopImmediatePropagation();
    const p=ringExplore.pointer;
    if(!p || p.id!==e.pointerId)return;
    ringExplore.yaw=Math.max(-1.0,Math.min(1.0,ringExplore.yaw-(e.clientX-p.x)*.003));
    ringExplore.pitch=Math.max(-.55,Math.min(.35,ringExplore.pitch+(e.clientY-p.y)*.003));
    p.x=e.clientX;p.y=e.clientY;
  },true);
  for(const type of ['pointerup','pointercancel','click','dblclick'])frameApp.addEventListener(type,e=>{
    if(!ringCanvasEvent(e))return;
    e.preventDefault();e.stopImmediatePropagation();
    ringExplore.pointer=null;
  },true);
  frameApp.addEventListener('wheel',e=>{
    if(!ringCanvasEvent(e))return;
    e.preventDefault();e.stopImmediatePropagation();
  },{capture:true,passive:false});
