  // Photographs are fixed to the equatorial sky, independent of camera roll.
  // Each image uses its own footprint, not the object's catalogue diameter.
  let dsoPhotoVisible = [];
  let dsoPhotoVB = null;
  const dsoPhotoVertices = new Float32Array(6 * 8);
  function dsoPhotoDirection(p, x, y) {
    const ra = p.ra * DEG, dec = p.dec * DEG, a = p.north * DEG;
    const xx = x * Math.tan(p.w * DEG / 120), yy = y * Math.tan(p.h * DEG / 120);
    const east = -xx * Math.cos(a) + yy * Math.sin(a);
    const north = xx * Math.sin(a) + yy * Math.cos(a);
    const cd = Math.cos(dec), sd = Math.sin(dec), cr = Math.cos(ra), sr = Math.sin(ra);
    const q = [cd * cr - east * sr - north * sd * cr,
               cd * sr + east * cr - north * sd * sr, sd + north * cd];
    const len = Math.hypot(...q);
    return eqToWorld(q[0]/len, q[1]/len, q[2]/len, [0,0,0]);
  }
  // Fade inward from missing mosaic tiles, without inventing unobserved pixels.
  function featherDsoMosaic(canvas) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const pixels = ctx.getImageData(0,0,w,h), rgba = pixels.data;
    const dist = new Float32Array(w*h);
    for (let i=0;i<dist.length;i++) dist[i] = rgba[i*4]+rgba[i*4+1]+rgba[i*4+2] <= 3 ? 0 : w+h;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const i=y*w+x;
      dist[i]=Math.min(dist[i],x?dist[i-1]+1:0,y?dist[i-w]+1:0);
    }
    for (let y=h-1;y>=0;y--) for (let x=w-1;x>=0;x--) {
      const i=y*w+x;
      dist[i]=Math.min(dist[i],x<w-1?dist[i+1]+1:0,y<h-1?dist[i+w]+1:0);
      const t=Math.min(1,dist[i]/(h*0.11));
      rgba[i*4+3]=Math.round(255*t*t*(3-2*t));
    }
    ctx.putImageData(pixels,0,0);
  }
  function loadDsoPhoto(p) {
    if (p.loading || p.texture || p.failed) return;
    p.loading = true;
    const img = new Image();
    img.onload = () => {
      try {
        const limit = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
        const scale = Math.min(1, limit / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        if (p.m === 31) featherDsoMosaic(canvas);
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // UV's top is 0; leave the provider's JPEG unmodified on disk.
        const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        p.texture = texture; p.texel = [1/canvas.width, 1/canvas.height]; p.readyAt = performance.now();
      } catch (_) { p.failed = true; }
      p.loading = false;
    };
    img.onerror = () => { p.loading = false; p.failed = true; };
    img.src = p.file;
  }
  function dsoPhotoPoint(dir, radius, ground) {
    const out = [0,0,0,1,1,1];
    if (ground) {
      if (!groundSkyPoint(dir[0], dir[1], dir[2], out)) return null;
    } else {
      for (let j=0;j<3;j++) out[j] = dir[j] * radius;
    }
    return out;
  }
  function dsoPhotoInFrame(points, vp) {
    const clip = points.map(p => [
      vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12],
      vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13],
      vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15]
    ]);
    if (clip.every(c => c[2] <= 0)) return false;
    return ![[-1,0],[1,0],[-1,1],[1,1]].some(([sign,axis]) => clip.every(c => sign*c[axis] > c[2]));
  }
  function prepareDsoPhotos(vp, radius, vis, halfFov, halfH, ground) {
    dsoPhotoVisible = [];
    for (const p of DSO_PHOTOS) {
      p.alpha = 0;
      const pixels = Math.min(p.w,p.h) * DEG / 60 / (2 * Math.tan(halfFov)) * halfH * 2;
      const zoom = Math.max(0, Math.min(1, (pixels - 18) / 100));
      if (!dsoOn || vis <= 0.04 || !zoom) continue;
      if (!p.directions) p.directions = [[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y]) => dsoPhotoDirection(p,x,y));
      const points = p.directions.map(d => dsoPhotoPoint(d, radius, ground));
      // A complete image is faded out at the horizon rather than stretched across it.
      if (points.some(p => !p) || !dsoPhotoInFrame(points, vp)) continue;
      loadDsoPhoto(p);
      if (!p.texture) continue;
      p.alpha = zoom * Math.min(1, (performance.now() - p.readyAt) / 700) * vis;
      if (p.alpha <= 0) continue;
      p.points = points; p.spaceReflection = p.m === 45 && !ground;
      dsoPhotoVisible.push(p);
    }
  }
  function drawDsoPhotos(vp) {
    if (!dsoPhotoVisible.length) return;
    if (!dsoPhotoVB) dsoPhotoVB = gl.createBuffer();
    gl.useProgram(dsoPhotoP.pr);
    gl.uniformMatrix4fv(dsoPhotoP.u.uVP, false, vp);
    gl.uniform1i(dsoPhotoP.u.uPhoto, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.ARRAY_BUFFER, dsoPhotoVB);
    const attrs = dsoPhotoP.a;
    for (const name of ['aPos','aQuad','aCol']) gl.enableVertexAttribArray(attrs[name]);
    gl.vertexAttribPointer(attrs.aPos, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(attrs.aQuad, 2, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(attrs.aCol, 3, gl.FLOAT, false, 32, 20);
    for (const p of dsoPhotoVisible) {
      gl.uniform1f(dsoPhotoP.u.uCore, p.m === 13 ? 1 : 0);
      gl.uniform1f(dsoPhotoP.u.uReflection, p.spaceReflection ? 1 : 0);
      gl.uniform2f(dsoPhotoP.u.uTexel, p.texel[0], p.texel[1]);
      [0,1,2,2,1,3].forEach((i,k) => {
        const pt=p.points[i], offset=k*8;
        dsoPhotoVertices.set(pt.slice(0,3), offset);
        dsoPhotoVertices[offset+3] = i%2 ? 1 : -1;
        dsoPhotoVertices[offset+4] = i>=2 ? 1 : -1;
        for (let j=0;j<3;j++) dsoPhotoVertices[offset+5+j]=pt[3+j]*p.alpha;
      });
      gl.bufferData(gl.ARRAY_BUFFER, dsoPhotoVertices, gl.DYNAMIC_DRAW);
      gl.bindTexture(gl.TEXTURE_2D, p.texture);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
  function dsoPhotoCreditHTML(p) {
    return '<a href="'+p.source+'" target="_blank" rel="noopener">M'+p.m+' — '+p.credit.replace(/&/g,'&amp;')+'</a>';
  }
  let dsoPhotoCreditKey = '';
  function updateDsoPhotoCredit() {
    const key = lang + ':' + dsoPhotoVisible.map(p=>p.m+(p.spaceReflection?'s':'')).join(',');
    if (key === dsoPhotoCreditKey) return;
    dsoPhotoCreditKey = key;
    const el = document.getElementById('dsoPhotoCredit');
    el.hidden = !dsoPhotoVisible.length;
    el.innerHTML = dsoPhotoVisible.length ? '<span>'+(lang==='ja'?'観測画像（肉眼での見え方とは異なります）':'Observation imagery (not a naked-eye view)')+'</span><br>'+dsoPhotoVisible.map(dsoPhotoCreditHTML).join('<br>')+'<br><a href="'+DSO_PHOTO_LICENSE+'" target="_blank" rel="noopener">CC BY 4.0</a> · '+(lang==='ja'?'投影・明るさ・周縁を調整':'Projection, brightness and edges adjusted')+(dsoPhotoVisible.some(p=>p.spaceReflection) ? (lang==='ja'?'・写真背景を抑制':' · Photo background suppressed') : '') : '';
  }
  // Draw after cropping, so every export ratio retains its complete attribution.
  function drawDsoPhotoExportCredit(x, width, height, scale, photos, footer) {
    if (!photos || !photos.length) return;
    x.save(); x.scale(scale, scale);
    x.font = '10px system-ui, sans-serif';
    const lines = [];
    const texts = photos.map(p => 'M'+p.m+' — '+p.credit+' | '+p.source);
    texts.push('CC BY 4.0: '+DSO_PHOTO_LICENSE, DSO_PHOTO_CHANGES);
    for (const text of texts) {
      let line = '';
      for (const ch of text) {
        if (line && x.measureText(line+ch).width > width-32) { lines.push(line); line=''; }
        line += ch;
      }
      if (line) lines.push(line);
    }
    const bottom = height-footer-20, top = bottom-lines.length*14-8;
    x.fillStyle='rgba(4,6,14,.86)'; x.fillRect(0,top,width,bottom-top+6);
    x.fillStyle='#c9d5ea'; x.textAlign='left'; x.textBaseline='top';
    lines.forEach((line,i) => x.fillText(line,16,top+5+i*14));
    x.restore();
  }
