  // Planet-relative route schematic. Uses the same approximate
  // ephemeris and simulation clock as the main view, never a second animation.
  const saturnOverviewCache = new Map();
  const overviewClose = document.getElementById("overviewClose");
  let overviewDismissed = false;
  function resetTourOverview() { overviewDismissed = false; overviewClose.hidden = true; }
  overviewClose.addEventListener("click", e => {
    e.stopPropagation(); overviewDismissed = true; overviewClose.hidden = true;
  });
  overviewClose.addEventListener("pointerdown", e => e.stopPropagation());
  function tourOverviewScene() {
    if (!tourActive || !tour || overviewDismissed) return null;
    const scene = tour.steps[tourIdx];
    if (tour.id === "cassini" && (tourIdx === 9 || tourIdx === 10))
      return {key: tourIdx === 9 ? "huygens" : "cassini", center: "saturn", plane: true, scene};
    if ((tour.id === "voyager1" || tour.id === "voyager2") &&
        ["jupiter","saturn","uranus","neptune"].includes(scene.ride) && scene.d && scene.until)
      return {key: tour.id, center: scene.ride, plane: false, scene};
    return null;
  }
  function saturnOverviewPoint(key, days, center = "saturn", plane = true) {
    const titan = BODY_BY_KEY.get("titan"), M = titan.M;
    const p = BODY_BY_KEY.get(key)?.pts
      ? probeAU(BODY_BY_KEY.get(key), days, [0, 0, 0])
      : wayAU(key, days, [0, 0, 0]);
    if (!p) return null;
    const s = wayAU(center, days, [0, 0, 0]);
    if (!plane) return [(p[0]-s[0])*AU_KM, (p[1]-s[1])*AU_KM];
    const x = (p[0] - s[0]) * AU_KM;
    const y = (p[2] - s[2]) * AU_KM;
    const z = -(p[1] - s[1]) * AU_KM;
    return [x*M[0] + y*M[1] + z*M[2], x*M[8] + y*M[9] + z*M[10]];
  }
  // Direction comes from the projected ephemeris, not the camera or playback speed.
  function saturnOverviewHeading(key, days, start, end, center, plane) {
    const before = saturnOverviewPoint(key, Math.max(start, days-.005), center, plane);
    const after = saturnOverviewPoint(key, Math.min(end, days+.005), center, plane);
    if (!before || !after) return null;
    const dx = after[0]-before[0], dy = -(after[1]-before[1]);
    return Math.hypot(dx,dy) > 1e-6 ? Math.atan2(dy,dx) : null;
  }
  function drawSaturnOverview() {
    const config = tourOverviewScene();
    if (!config) { overviewClose.hidden = true; return; }
    const {key, center, plane, scene} = config;
    const cacheKey = tour.id+":"+tourIdx;
    if (!saturnOverviewCache.has(cacheKey)) {
      const start = wayDays(scene.d), end = wayDays(scene.until);
      const points = [];
      let extent = key === "huygens" ? BODY_BY_KEY.get("titan").aKm : 0;
      const pathEnd = key === "cassini" ? start + 360 : end;
      for (let i = 0; i <= 240; i++) {
        const t = start + (pathEnd-start)*i/240, p = saturnOverviewPoint(key, t, center, plane);
        if (p) { points.push({t, p}); extent = Math.max(extent, Math.hypot(...p)); }
      }
      saturnOverviewCache.set(cacheKey, {start, end, points, extent});
    }
    const data = saturnOverviewCache.get(cacheKey);
    const days = Math.max(data.start, Math.min(data.end, simDays));
    const h = saturnOverviewPoint(key, days, center, plane), titan = saturnOverviewPoint("titan", days);
    if (!h || !titan) return;
    const portrait = H > W;
    const width = Math.min(portrait ? 220 : 280, W - 24);
    const height = portrait ? 190 : 236;
    const clockBottom = document.getElementById("clock").getBoundingClientRect().bottom;
    const left = W - width - 12, top = Math.max(64, clockBottom + 12);
    // On very short displays leave room for the narration and main view.
    if (top + height + 16 > tourBar.getBoundingClientRect().top) return;
    overviewClose.hidden = false;
    overviewClose.style.left = (left+width-32)+"px"; overviewClose.style.top = (top+4)+"px";
    overviewClose.setAttribute("aria-label",lang === "ja" ? "航路図を閉じる" : "Hide route map");
    const cx = left + width/2, cy = top + 20 + (height-46)/2;
    const scale = Math.min(width-76, height-72) / (2*data.extent);
    const screen = p => [cx+p[0]*scale, cy-p[1]*scale];
    const ctx = octx;
    ctx.save();
    ctx.fillStyle = "rgba(8,15,28,.86)";
    ctx.strokeStyle = "rgba(129,151,185,.45)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(left, top, width, height, 8); ctx.fill(); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#bcc9dc";
    ctx.strokeStyle = "rgba(158,181,213,.48)"; ctx.setLineDash([3,4]);
    ctx.beginPath();
    if (key === "huygens") {
      ctx.arc(cx,cy,BODY_BY_KEY.get("titan").aKm*scale,0,Math.PI*2);
    } else {
      data.points.forEach((point,i) => {
        const p = screen(point.p);
        if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p);
      });
    }
    ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1.6; ctx.lineCap = "round";
    const trail = data.points.filter(point => point.t < days).map(point => screen(point.p));
    const hp = screen(h); trail.push(hp);
    // The last 22 screen pixels are brighter; the older trail remains visible.
    let behind = 0;
    for (let i = trail.length-1; i > 0; i--) {
      const a = trail[i-1], b = trail[i];
      const length = Math.hypot(b[0]-a[0],b[1]-a[1]);
      const glow = Math.max(0,1-behind/22);
      ctx.strokeStyle = glow > 0 ? "rgba(255,205,116,"+(.4+.55*glow)+")" : "rgba(211,156,72,.4)";
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      behind += length;
    }
    const heading = saturnOverviewHeading(key, days, data.start, data.end, center, plane);
    const labels = [];
    const marker = (p, radius, color, label, above, shape = "dot") => {
      const [x,y] = screen(p);
      ctx.fillStyle = color;
      if (shape === "probe" && heading !== null) {
        ctx.save(); ctx.translate(x,y); ctx.rotate(heading);
        ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,-3.5);
        ctx.lineTo(-2,0); ctx.lineTo(-4,3.5); ctx.closePath();
        ctx.strokeStyle = "#111b2a"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fill(); ctx.restore();
      } else {
        if (shape === "saturn") {
          ctx.strokeStyle = "#a58c60"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(x,y,10,3.6,-.4,0,Math.PI*2); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
        if (shape === "saturn") {
          ctx.strokeStyle = "#e6cea0";
          ctx.beginPath(); ctx.ellipse(x,y,10,3.6,-.4,0,Math.PI); ctx.stroke();
        }
      }
      const labelWidth = ctx.measureText(label).width;
      const tx = Math.max(left+8, Math.min(left+width-8-labelWidth, x+7));
      let ty = y+(above ? -12 : 13);
      for (let attempt=0; attempt<8; attempt++) {
        if (!labels.some(r => tx < r.x+r.w+4 && tx+labelWidth+4 > r.x && Math.abs(ty-r.y)<14)) break;
        ty += above ? -14 : 14;
      }
      labels.push({x:tx,y:ty,w:labelWidth});
      ctx.fillText(label, tx, ty);
    };
    marker([0,0],5,"#ddc89a",bName(BODY_BY_KEY.get(center)),false,center === "saturn" ? "saturn" : "dot");
    if (key === "huygens") marker(titan,3,"#c2d7f5",lang === "ja" ? "タイタン" : "Titan",true);
    marker(h,3,"#ffc35d",bName(BODY_BY_KEY.get(key)),false,"probe");
    ctx.fillStyle = "#8695ab"; ctx.font = "10px sans-serif";
    ctx.fillText(lang === "ja" ? "模式図 · 点の大きさは実寸ではありません" : "Schematic · markers not to scale",left+10,top+height-13);
    ctx.restore();
  }
