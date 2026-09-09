  const DSO_PHOTO_LICENSE = "https://creativecommons.org/licenses/by/4.0/";
  const DSO_PHOTO_CHANGES = "Sky projection, brightness adjustment and edge feathering by Sidereum";
  const DSO_PHOTOS = [];
  DSO_PHOTOS.push({m:31,id:'heic2501a',ra:10.9324167,dec:41.3858111,w:140.60,h:32.88,north:125});
  DSO_PHOTOS.push({m:42,id:'heic0601a',ra:83.7905417,dec:-5.4139778,w:30.03,h:30.03,north:0});
  DSO_PHOTOS.push({m:57,id:'heic1310a',ra:283.3967083,dec:33.028925,w:2.10,h:2.10,north:-11.7});
  DSO_PHOTOS.push({m:13,id:'opo0840a',ra:250.4197917,dec:36.459775,w:3.53,h:3.53,north:0});
  // Approximate DSS registration from Alcyone, Atlas and Electra; see tex/dso/CREDITS.md.
  DSO_PHOTOS.push({m:45,id:'davidedemartin_5',ra:56.661,dec:24.204,w:171.6,h:162.906,north:0});
  for (const p of DSO_PHOTOS) {
    p.file = 'tex/dso/m' + p.m + '.jpg';
    p.source = 'https://esahubble.org/' + (p.m === 45 ? 'projects/fits_liberator/fitsimages/' : 'images/') + p.id + '/';
  }
  ["NASA, ESA, B. Williams (University of Washington)", "NASA, ESA, M. Robberto ( Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team", "NASA, ESA, and C. Robert O’Dell (Vanderbilt University).", "NASA, ESA, and the Hubble Heritage Team (STScI/AURA)", "Davide De Martin & the ESA/ESO/NASA Photoshop FITS Liberator"].forEach((credit, i) => { DSO_PHOTOS[i].credit = credit; });
