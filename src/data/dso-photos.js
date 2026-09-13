  const DSO_PHOTO_LICENSE = "https://creativecommons.org/licenses/by/4.0/";
  const DSO_PHOTO_CHANGES = "Original image, resized to fit the viewer";
  const DSO_PHOTOS = [];
  DSO_PHOTOS.push({m:31,id:'heic2501a'});
  DSO_PHOTOS.push({m:42,id:'heic0601a'});
  DSO_PHOTOS.push({m:57,id:'heic1310a'});
  DSO_PHOTOS.push({m:13,id:'opo0840a'});
  DSO_PHOTOS.push({m:45,id:'davidedemartin_5'});
  DSO_PHOTOS.push({"m": 1, "id": "heic0515a", "credit": "NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)"});
  DSO_PHOTOS.push({"m": 16, "id": "heic1501a", "credit": "NASA, ESA/Hubble and the Hubble Heritage Team"});
  DSO_PHOTOS.push({"m": 51, "id": "heic0506a", "credit": "NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)"});
  for (const p of DSO_PHOTOS) {
    p.file = 'tex/dso/m' + p.m + '.jpg';
    p.source = 'https://esahubble.org/' + (p.m === 45 ? 'projects/fits_liberator/fitsimages/' : 'images/') + p.id + '/';
  }
  ["NASA, ESA, B. Williams (University of Washington)", "NASA, ESA, M. Robberto ( Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team", "NASA, ESA, and C. Robert O’Dell (Vanderbilt University).", "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)", "Davide De Martin & the ESA/ESO/NASA Photoshop FITS Liberator"].forEach((credit, i) => { DSO_PHOTOS[i].credit = credit; });

  const DSO_PHOTO_NOTES = {
  "31": [
    "アンドロメダ銀河を多くの観測画像からつないだモザイクです。明るい中心部を囲む、暗い塵の帯に注目してください。",
    "A mosaic assembled from many observations of Andromeda. Look for the dark dust lanes around its bright central region."
  ],
  "42": [
    "新しい星が生まれるガスと塵の雲です。中心の若い星々が周囲のガスを照らし、複雑な明暗を作っています。",
    "A cloud of gas and dust where new stars form. Young stars near the centre illuminate the surrounding gas."
  ],
  "57": [
    "年老いた星から放出されたガスが輝く環状星雲です。明るい輪の内側にも、淡いガスが広がっています。",
    "The Ring Nebula glows with gas shed by an ageing star. Fainter gas also fills the inside of the bright ring."
  ],
  "13": [
    "球状星団M13の中心部を拡大した画像です。中心に向かって星が密集する様子と、星々の色の違いを見比べてください。",
    "A close view of the core of globular cluster M13. Compare the colours of its stars and their increasing density toward the centre."
  ],
  "45": [
    "すばるの星々を包む青い雲は、星の光を散乱する塵です。明るい星の周囲に伸びる、薄い筋状の模様が見どころです。",
    "Blue dust clouds scatter the light of the Pleiades stars. Look for delicate streaks around the bright stars."
  ],
  "1": [
    "超新星爆発のあとに残った、かに星雲です。複数の観測画像をつないだ写真で、細いガスの筋が広がる様子を見られます。",
    "The Crab Nebula is a supernova remnant. This mosaic reveals its network of fine gas filaments."
  ],
  "16": [
    "わし星雲の一部「創造の柱」を拡大した画像です。ガスと塵の柱は、近くの若い星々の強い光や風によって削られています。",
    "A close view of the Pillars of Creation, one part of the Eagle Nebula. Light and winds from nearby young stars erode these columns of gas and dust."
  ],
  "51": [
    "子持ち銀河の渦巻く腕と、そのそばの小さな銀河を写しています。青い星の集まりと暗い塵の帯が、腕に沿って並んでいます。",
    "The Whirlpool Galaxy and its smaller companion. Blue star clusters and dark dust lanes trace its spiral arms."
  ]
};
