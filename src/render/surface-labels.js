  // 地名と中心座標: USGS/IAU Gazetteer of Planetary Nomenclature (2026-09-23確認)。
  // 文章・地図画像の転載ではなく、少数の地名・座標を個別に採用。
  // source は https://planetarynames.wr.usgs.gov/Feature/<id>。
  // 使用中の全球画像で経度の起点を確認。月・火星は-180°、他は0°。
  const SURFACE_FEATURES = {
    moon: [
      {ja:"ティコ",en:"Tycho",lat:-43.30,lon:-11.22,source:6163},
      {ja:"静かの海",en:"Mare Tranquillitatis",lat:8.35,lon:30.83,source:3691},
    ],
    mars: [
      {ja:"オリンポス山",en:"Olympus Mons",lat:18.40,lon:226.00,source:4453},
      {ja:"マリネリス峡谷",en:"Valles Marineris",lat:-13.74,lon:300.80,source:6288},
    ],
    mercury: [{ja:"カロリス平原",en:"Caloris Planitia",lat:31.65,lon:161.98,source:979}],
    pluto: [{ja:"スプートニク平原",en:"Sputnik Planitia",lat:19.51,lon:178.69,source:15669}],
    ceres: [{ja:"オッカトル",en:"Occator",lat:19.82,lon:239.33,source:15341}],
  };
  function surfaceFeatureLocal(key, feature) {
    const start = key === "moon" || key === "mars" ? -180 : 0;
    const u = ((feature.lon-start)%360+360)%360/360;
    const lon = (.5-u)*Math.PI*2, lat = feature.lat*Math.PI/180;
    return [Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)];
  }
  function surfaceLabelOpacity(radiusPx, facing, light, age, transient) {
    const clamp = n => Math.max(0,Math.min(1,n));
    return .85 * clamp((radiusPx-95)/65) * clamp((facing-.15)/.25) * clamp((light-.025)/.15)
      * (transient ? clamp(age/1.2)*clamp((12-age)/2) : 1);
  }
  let surfaceLabelContext = "";
  const surfaceLabelTimes = new Map();
  function drawSurfaceLabels() {
    const body = selected, features = SURFACE_FEATURES[body?.key];
    const context = (body?.key || "") + ":" + immersiveView + ":" + (saverState?.kind || "");
    if (surfaceLabelContext !== context) { surfaceLabelTimes.clear(); surfaceLabelContext = context; }
    if (!features || groundView || tourActive || ringExplore || (!immersiveView && !body.showLabel) || !texLoaded.has(body.key)) return;
    if (saverState && !["body","terminator"].includes(saverState.kind)) return;
    const sp = screenPos.get(body.key);
    if (!sp || sp.hidden || sp.r < 95) { surfaceLabelTimes.clear(); return; }
    const center = posW.get(body.key), sun = posW.get("sun"), radius = bodyR(body);
    const model = bodyModel(body,1), obl = body.obl || [1,1,1];
    const rotate = v => [0,1,2].map(i=>model[i]*v[0]+model[4+i]*v[1]+model[8+i]*v[2]);
    const unit = v => { const n=Math.hypot(...v);return v.map(x=>x/n); };
    const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
    const now = performance.now()/1000;
    for (const feature of features) {
      const local = surfaceFeatureLocal(body.key,feature);
      const offset = rotate(local.map((v,i)=>v*obl[i]*radius));
      const point = center.map((v,i)=>v+offset[i]);
      const normal = unit(rotate(local.map((v,i)=>v/obl[i])));
      const facing = dot(normal,unit(EYE.map((v,i)=>v-point[i])));
      const light = dot(normal,unit(sun.map((v,i)=>v-point[i])));
      const pr = facing > .15 && light > .025 ? project(point) : null;
      if (!pr || pr.x < 70 || pr.x > W-70 || pr.y < 40 || pr.y > H-90) {
        const seen=surfaceLabelTimes.get(feature.source);
        if (seen && now-seen.last > 2) surfaceLabelTimes.delete(feature.source);
        continue;
      }
      let seen = surfaceLabelTimes.get(feature.source);
      if (!seen) { seen={start:now,last:now};surfaceLabelTimes.set(feature.source,seen); }
      seen.last=now;
      const alpha=surfaceLabelOpacity(sp.r,facing,light,now-seen.start,immersiveView);
      if (alpha < .02) continue;
      octx.save();octx.globalAlpha=alpha*.65;octx.strokeStyle="#d6deea";octx.lineWidth=.75;
      octx.beginPath();octx.arc(pr.x,pr.y,2,0,Math.PI*2);octx.moveTo(pr.x,pr.y-4);octx.lineTo(pr.x,pr.y-15);octx.stroke();octx.restore();
      lblPut(lang === "ja" ? feature.ja : feature.en,pr.x,pr.y-20,LBL_BODY,"#d6deea",LF11,alpha);
    }
  }
