  // Only labels that survived decluttering are selectable. Planet selection wins
  // in controls.js; tours and immersive scenes never open these detail dialogs.
  function hitTestNamedStar(x, y) {
    if (!showConst || tourActive || immersiveView || ringExplore) return null;
    let best = null, score = Infinity;
    for (const h of namedStarHits) {
      const distance = Math.hypot(x - h.x, y - h.y);
      const label = x >= h.left && x <= h.right && y >= h.top && y <= h.bottom;
      if ((label || distance <= 16) && distance < score) { best = h.star; score = distance; }
    }
    return best;
  }
  function starPhotoCreditHTML(p) {
    return '<a href="' + p.source + '" target="_blank" rel="noopener">Vega — ' + p.credit + '</a> · ' +
      '<a href="' + p.license + '" target="_blank" rel="noopener">CC0 1.0 (Public Domain)</a>';
  }
  function openNamedStar(star) {
    const info = STAR_INFO[star?.en];
    if (!info) return;
    hideModals(); setMenu(false);
    const ja = lang === 'ja', l = ja ? 0 : 1;
    dsoPhotoDialog.replaceChildren();
    const close = document.createElement('button'); close.className = 'dsoPhotoClose';
    close.textContent = '×'; close.setAttribute('aria-label', ja ? '恒星の説明を閉じる' : 'Close star details');
    close.addEventListener('click', closeDsoPhoto);
    const title = document.createElement('h2'); title.id = 'dsoPhotoTitle';
    title.textContent = ja ? star.ja + ' · ' + star.en : star.en;
    const facts = document.createElement('p'); facts.className = 'starInfoFacts';
    facts.textContent = CONST_NAME[info.con][l] + ' · ' + info.designation + ' · ' +
      (ja ? '見かけの等級 ' : 'Apparent magnitude ') + star.mag.toFixed(2);
    const description = document.createElement('p'); description.className = 'starInfoDescription';
    description.textContent = info.note[l];
    const magnitude = document.createElement('p'); magnitude.className = 'dsoPhotoNote';
    magnitude.textContent = ja ? '等級は数字が小さいほど明るいことを表します。表示はカタログ値で、変光星の現在の明るさを示すものではありません。' :
      'Lower magnitudes mean brighter stars. This catalogue value does not track the current brightness of variable stars.';
    dsoPhotoDialog.append(close, title, facts, description, magnitude);
    const p = STAR_PHOTOS[star.en];
    if (p) {
      const img = document.createElement('img'); img.alt = ja ? star.ja + 'の観測写真' : 'Observation photograph of ' + star.en;
      img.decoding = 'async';
      const status = document.createElement('p'); status.setAttribute('role', 'status');
      status.textContent = ja ? '写真を読み込み中…' : 'Loading photograph…';
      img.onload = () => status.remove();
      img.onerror = () => { img.remove(); status.textContent = ja ? '写真を読み込めませんでした。' : 'Photograph unavailable.'; };
      img.src = p.file;
      const caption = document.createElement('p'); caption.textContent = p.caption[l];
      const credits = document.createElement('p'); credits.className = 'dsoPhotoCredits';
      credits.innerHTML = starPhotoCreditHTML(p);
      dsoPhotoDialog.append(status, img, caption, credits);
    }
    const sources = document.createElement('p');
    for (const [href, text] of [[STAR_INFO_SOURCE, ja ? '星名・星座の出典：IAU' : 'Names and constellations: IAU'],
      ...(info.reference ? [[info.reference, ja ? '星の特徴の出典' : 'Stellar properties source']] : [])]) {
      const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
      if (sources.children.length) sources.append(document.createTextNode(' · '));
      sources.append(a);
    }
    dsoPhotoDialog.append(sources);
    dsoPhotoDialog.showModal();
  }
