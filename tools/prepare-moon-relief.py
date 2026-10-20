#!/usr/bin/env python3
"""LOLA uint16 TIFF -> 257x129 little-endian radial heights for close-up mesh.
Source: https://svs.gsfc.nasa.gov/4720/ (ldem_16_uint.tif).
Units: 0.5m, offset +20000 from reference radius 1737.4km. No exaggeration.
Usage: python3 tools/prepare-moon-relief.py /path/to/ldem_16_uint.tif
"""
from pathlib import Path
from PIL import Image
import math, struct, sys
im = Image.open(sys.argv[1]); w,h = im.size
px = im.load(); values=[]
# Match the sphere's longitude and the surface shader's .5-atan(z,x)/2pi UV.
for y in range(129):
    fy = max(0, min(h-1, y/128*h-.5)); y0=math.floor(fy); ty=fy-y0
    for x in range(257):
        fx = ((.5-x/256)%1)*w-.5; x0=math.floor(fx); tx=fx-x0
        a=px[x0%w,y0]*(1-tx)+px[(x0+1)%w,y0]*tx
        b=px[x0%w,min(h-1,y0+1)]*(1-tx)+px[(x0+1)%w,min(h-1,y0+1)]*tx
        values.append(round(a*(1-ty)+b*ty))
# A single height per pole prevents a pinhole where all longitudes meet.
for y in (0,128):
    value=round(sum(values[y*257:(y+1)*257])/257)
    values[y*257:(y+1)*257]=[value]*257
out=Path(__file__).resolve().parents[1]/'tex/moon-relief.bin'
out.write_bytes(struct.pack('<'+'H'*len(values),*values))
print(out, len(values), 'vertices')
