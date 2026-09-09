  const DSO_PHOTO_LICENSE = "https://creativecommons.org/licenses/by/4.0/";
  const DSO_PHOTO_CHANGES = "Original image, resized to fit the viewer";
  const DSO_PHOTOS = [];
  DSO_PHOTOS.push({m:31,id:'heic2501a'});
  DSO_PHOTOS.push({m:42,id:'heic0601a'});
  DSO_PHOTOS.push({m:57,id:'heic1310a'});
  DSO_PHOTOS.push({m:13,id:'opo0840a'});
  DSO_PHOTOS.push({m:45,id:'davidedemartin_5'});
  for (const p of DSO_PHOTOS) {
    p.file = 'tex/dso/m' + p.m + '.jpg';
    p.source = 'https://esahubble.org/' + (p.m === 45 ? 'projects/fits_liberator/fitsimages/' : 'images/') + p.id + '/';
  }
  ["NASA, ESA, B. Williams (University of Washington)", "NASA, ESA, M. Robberto ( Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team", "NASA, ESA, and C. Robert O’Dell (Vanderbilt University).", "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)", "Davide De Martin & the ESA/ESO/NASA Photoshop FITS Liberator"].forEach((credit, i) => { DSO_PHOTOS[i].credit = credit; });
