"""Independent exact rational clipping of the seven-vertex public A111 bay.

This check uses only Python's standard library, not the application's JTS engine.
It is an answer check for this specific simple polygon, not a general cut engine.
"""
from fractions import Fraction as F
import json
from pathlib import Path

source = json.loads((Path(__file__).parent / '../area-grid-footprints/source.json').read_text())['ceiling']
ring = [(F(str(x)), F(str(y))) for x, y in source['vertices']]
origin = [F(str(v)) for v in source['grid_origin_pixels']]

def area(p):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1]))) / 2 if p else F(0)

def clip(p, axis, bound, greater):
    result = []
    for a,b in zip(p,p[1:]+p[:1]):
        ina = a[axis] >= bound if greater else a[axis] <= bound
        inb = b[axis] >= bound if greater else b[axis] <= bound
        if ina != inb:
            t = (bound-a[axis])/(b[axis]-a[axis])
            result.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(2)))
        if inb:
            result.append(b)
    return result

cells = []
for row in range(-2,10):
    for col in range(-2,12):
        x,y = origin[0]+18*col,origin[1]+18*row
        p=ring
        for axis,bound,greater in [(0,x,True),(0,x+18,False),(1,y,True),(1,y+18,False)]:
            p=clip(p,axis,bound,greater)
        a=area(p)
        if a:
            cells.append({'key':f'{row}:{col}','kind':'full' if a==324 else 'cut','area_sf':float(a/81)})
assert abs(sum(F(str(c['area_sf'])) for c in cells) - area(ring)/81) < F(1,10**9)
result={'method':'Exact rational Sutherland-Hodgman rectangle clipping, independent of JTS; this A111 bay only',
        'full_tiles':sum(c['kind']=='full' for c in cells),'cut_cells':sum(c['kind']=='cut' for c in cells),
        'covered_sf':float(area(ring)/81),'covered_sf_exact':str(area(ring)/81),'cells':cells}
(Path(__file__).parent/'expected.json').write_text(json.dumps(result,indent=2)+'\n')
print({k:v for k,v in result.items() if k!='cells'})
