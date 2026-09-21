#!/usr/bin/env python3
"""Prepare NASA/USGS source maps. Requires Pillow; sources and hashes: ASSET_RIGHTS.md.
Usage: python3 tools/prepare-detail-textures.py MOON_2025_8K_TIFF MARS_1KM_JPG MERCURY_665M_TIFF
"""
from pathlib import Path
import sys
from PIL import Image, ImageStat
Image.MAX_IMAGE_PIXELS = 400_000_000  # Trusted USGS Mercury map: 23040 x 11520
root = Path(__file__).resolve().parents[1] / 'tex'
moon, mars, mercury = map(Path, sys.argv[1:4])
(root / '8k').mkdir(exist_ok=True)
# NASA 16bit sRGB TIFF -> 8bit RGB, exposure matched to the app's existing lighting.
im = Image.open(moon).convert('RGB').point([round(i * .80) for i in range(256)] * 3)
for width, folder in [(2048, root), (4096, root/'4k'), (8192, root/'8k')]:
    im.resize((width, width//2), Image.Resampling.LANCZOS).save(folder/'moon.jpg', quality=92)
Image.open(mars).convert('RGB').resize((8192,4096), Image.Resampling.LANCZOS).save(root/'8k/mars.jpg', quality=92)
# Keep Mercury's existing monochrome appearance, with mean brightness matched to 4K.
im = Image.open(mercury).convert('L').resize((8192,4096), Image.Resampling.LANCZOS)
gain = ImageStat.Stat(Image.open(root/'4k/mercury.jpg').convert('L')).mean[0] / ImageStat.Stat(im).mean[0]
im.point([min(255, round(i * gain)) for i in range(256)]).save(root/'8k/mercury.jpg', quality=92)
