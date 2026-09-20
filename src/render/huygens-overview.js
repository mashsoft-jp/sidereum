  // Saturn-relative, Titan-orbit-plane schematic. Uses the same approximate
  // ephemeris and simulation clock as the main view, never a second animation.
  const saturnOverviewCache = new Map();
  function saturnOverviewPoint(key, days) {
    const titan = BODY_BY_KEY.get("titan"), M = titan.M;
    const p = key === "huygens" || key === "cassini"
      ? probeAU(BODY_BY_KEY.get(key), days, [0, 0, 0])
      : wayAU(key, days, [0, 0, 0]);
    if (!p) return null;
    const s = wayAU("saturn", days, [0, 0, 0]);
    const x = (p[0] - s[0]) * AU_KM;
    const y = (p[2] - s[2]) * AU_KM;
    const z = -(p[1] - s[1]) * AU_KM;
    return [x*M[0] + y*M[1] + z*M[2], x*M[8] + y*M[9] + z*M[10]];
  }
  function drawSaturnOverview() {
    if (!tourActive || !tour || tour.id !== "cassini" || (tourIdx !== 9 && tourIdx !== 10)) return;
    const key = tourIdx === 9 ? "huygens" : "cassini";
    if (!saturnOverviewCache.has(key)) {
      const scene = tour.steps[tourIdx];
      const start = wayDays(scene.d), end = wayDays(scene.until);
      const points = [];
      let extent = key === "huygens" ? BODY_BY_KEY.get("titan").aKm : 0;
      const pathEnd = key === "cassini" ? start + 360 : end;
      for (let i = 0; i <= 240; i++) {
        const t = start + (pathEnd-start)*i/240, p = saturnOverviewPoint(key, t);
        if (p) { points.push({t, p}); extent = Math.max(extent, Math.hypot(...p)); }
      }
      saturnOverviewCache.set(key, {start, end, points, extent});
    }
    const data = saturnOverviewCache.get(key);
    const days = Math.max(data.start, Math.min(data.end, simDays));
    const h = saturnOverviewPoint(key, days), titan = saturnOverviewPoint("titan", days);
    if (!h || !titan) return;
    const portrait = H > W;
    const width = Math.min(portrait ? 220 : 280, W - 24);
    const height = portrait ? 190 : 236;
    const clockBottom = document.getElementById("clock").getBoundingClientRect().bottom;
    const left = W - width - 12, top = Math.max(64, clockBottom + 12);
    // On very short displays leave room for the narration and main view.
    if (top + height + 16 > tourBar.getBoundingClientRect().top) return;
    const cx = left + width/2, cy = top + 34 + (height-60)/2;
    const scale = Math.min(width-76, height-72) / (2*data.extent);
    const screen = p => [cx+p[0]*scale, cy-p[1]*scale];
    const ctx = octx;
    ctx.save();
    ctx.fillStyle = "rgba(8,15,28,.86)";
    ctx.strokeStyle = "rgba(129,151,185,.45)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(left, top, width, height, 8); ctx.fill(); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#bcc9dc";
    const title = key === "huygens"
      ? (lang === "ja" ? "タイタンへの航路" : "Route to Titan")
      : (lang === "ja" ? "カッシーニの土星周回" : "Cassini around Saturn");
    ctx.fillText(title, left+12, top+17);
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
    ctx.setLineDash([]); ctx.strokeStyle = "#eab45e"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;
    for (const point of data.points) {
      if (point.t > days) break;
      const [x,y] = screen(point.p);
      if (first) {ctx.moveTo(x,y); first=false;} else ctx.lineTo(x,y);
    }
    const hp = screen(h); ctx.lineTo(...hp); ctx.stroke();
    const labels = [];
    const marker = (p, radius, color, label, above) => {
      const [x,y] = screen(p);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill();
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
    marker([0,0],5,"#ddc89a",lang === "ja" ? "土星" : "Saturn",false);
    if (key === "huygens") marker(titan,3,"#c2d7f5",lang === "ja" ? "タイタン" : "Titan",true);
    marker(h,3,"#ffc35d",key === "huygens" ? (lang === "ja" ? "ホイヘンス" : "Huygens") : (lang === "ja" ? "カッシーニ" : "Cassini"),false);
    ctx.fillStyle = "#8695ab"; ctx.font = "10px sans-serif";
    ctx.fillText(lang === "ja" ? "模式図 · 点の大きさは実寸ではありません" : "Schematic · markers not to scale",left+10,top+height-13);
    ctx.restore();
  }
