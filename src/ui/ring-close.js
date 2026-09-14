  const copyRingCamera = source => Object.fromEntries(Object.entries(source).map(([k,v])=>[k,Array.isArray(v)?v.slice():v]));
  const frameRingBtn = document.getElementById('frameRing');
  function beginRingExplore() {
    if (groundView || tourActive || selected?.key !== 'saturn' || ringExplore) return;
    const saved = {cam: copyRingCamera(cam),
      zoom:camZoom,zoomTgt:camZoomTgt,playing,layout:{...frameLayout}};
    setImmersive(true);
    cameraFlight=null;
    Object.assign(cam,copyRingCamera(saved.cam));
    camZoom=saved.zoom;camZoomTgt=saved.zoomTgt;
    frameLayout.fit=null;
    ringExplore={saved,travel:0,yaw:0,pitch:-.13,height:2.2,pointer:null};
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
    ringExplore.height=Math.max(1.7,Math.min(6,ringExplore.height+e.deltaY*.003));
  },{capture:true,passive:false});
