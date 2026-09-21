#!/usr/bin/env python3
"""Generate the existing short lunar series from licensed ERFA moon98.c.
This is a Sidereum truncation/unit conversion, not the full ERFA or SOFA algorithm.
"""
import re, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
s = (ROOT / 'third_party/erfa/moon98.c').read_text()
def table(name):
    body = s.split(name + '[] = ', 1)[1].split('};', 1)[0]
    return [[float(x) for x in r.split(',')] for r in re.findall(r'\{([^{}]+)\}', body)]
lr, lat = table('tlr'), table('tb')
lon = [[r[4], *map(int,r[:4])] for r in lr[:32]]
dist = [[r[5]/1000, *map(int,r[:4])] for r in lr[:26] if r[5]]
latitude = [[r[4], *map(int,r[:4])] for r in lat[:20]]
header = '''  // Generated from third_party/erfa/moon98.c by tools/import-moon-series.py.
  // Copyright (C) 2013-2023, NumFOCUS Foundation. See licenses/ERFA.txt.
  // ERFA is derived, with permission, from SOFA. This truncated data is not SOFA/ERFA itself.
  // Sidereum adaptation: selected first 32 longitude / 20 latitude terms and nonzero distance
  // terms among the first 26 rows; reordered columns; distances converted from metres to km.
'''
for name, rows in [('MOON_LON',lon),('MOON_LAT',latitude),('MOON_DIST',dist)]:
    header += '  const '+name+' = '+json.dumps(rows,separators=(',',':'))+';\n'
(ROOT/'src/data/moon-series.js').write_text(header)
print('ERFA series:',len(lon),len(latitude),len(dist))
