  // Photographs are an explicit detail view; the sky stays procedural.
  const dsoHits = [];
  function recordDsoHit(i, p, vp, halfFov, halfH) {
    const depth = vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];
    if (depth <= 0) return;
    const x = ((vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12])/depth+1)*W/2;
    const y = (1-(vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13])/depth)*H/2;
    const radius = DSO[i][4]/120*DEG/halfFov*halfH;
    if (x+radius<0 || x-radius>W || y+radius<0 || y-radius>H) return;
    dsoHits.push({i,x,y,r:Math.max(18,Math.min(radius,Math.min(W,H)*0.25)),
      labelY:y+Math.min(radius,H*0.2)+13, labelled:groundView && dsoLabelled(i,halfFov)});
  }
  function hitTestDso(x,y) {
    if (!dsoOn) return -1;
    let best=-1, score=Infinity;
    for (const h of dsoHits) {
      const distance=Math.hypot(x-h.x,y-h.y);
      const label=h.labelled && Math.abs(y-h.labelY)<14 && Math.abs(x-h.x)<Math.max(35,dsoName(h.i).length*6);
      if ((distance<=h.r || label) && distance<score) { best=h.i; score=distance; }
    }
    return best;
  }
  function dsoPhotoCreditHTML(p) {
    return '<a href="'+p.source+'" target="_blank" rel="noopener">M'+p.m+' — '+p.credit.replace(/&/g,'&amp;')+'</a>';
  }
  const dsoPhotoDialog = document.getElementById('dsoPhotoDialog');
  function closeDsoPhoto() { if (dsoPhotoDialog.open) dsoPhotoDialog.close(); }
  function openDsoPhoto(i) {
    const d=DSO[i]; if (!d) return;
    hideModals(); setMenu(false);
    const p=DSO_PHOTOS.find(p=>p.m===d[0]), ja=lang==='ja';
    dsoPhotoDialog.replaceChildren();
    const close=document.createElement('button'); close.className='dsoPhotoClose';
    close.textContent='×'; close.setAttribute('aria-label',ja?'写真を閉じる':'Close photograph');
    close.addEventListener('click',closeDsoPhoto);
    const title=document.createElement('h2'); title.id='dsoPhotoTitle';
    title.textContent=(d[0]?'M'+d[0]+' · ':'')+dsoName(i);
    dsoPhotoDialog.append(close,title);
    const note=document.createElement('p'); note.className='dsoPhotoNote';
    note.textContent=ja?'観測画像 — 肉眼での見え方とは異なります':'Observation imagery — not a naked-eye view';
    if (p) {
      dsoPhotoDialog.append(note);
      const img=document.createElement('img'); img.alt=title.textContent; img.decoding='async';
      const status=document.createElement('p'); status.className='dsoPhotoStatus';
      status.textContent=ja?'読み込み中…':'Loading…'; status.setAttribute('role','status');
      img.onload=()=>{ status.remove(); };
      img.onerror=()=>{ img.remove(); status.textContent=ja?'画像を読み込めませんでした。閉じてもう一度お試しください。':'Image unavailable. Close and try again.'; };
      // No network or GPU image work until the user opens this frame.
      img.src=p.file;
      const credits=document.createElement('p'); credits.className='dsoPhotoCredits';
      credits.innerHTML=dsoPhotoCreditHTML(p)+'<br><a href="'+DSO_PHOTO_LICENSE+'" target="_blank" rel="noopener">CC BY 4.0</a>';
      dsoPhotoDialog.append(status,img,credits);
    } else {
      note.textContent=ja?'この天体の観測画像はまだ用意していません。':'No observation image is available for this object yet.';
      dsoPhotoDialog.append(note);
    }
    dsoPhotoDialog.showModal();
  }
  dsoPhotoDialog.addEventListener('click',e=>{
    if (e.target!==dsoPhotoDialog) return;
    const r=dsoPhotoDialog.getBoundingClientRect();
    if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) closeDsoPhoto();
  });
