"""Independent exact rational answers for the existing simple public A111 bay.

Sutherland-Hodgman clips against rectangles, without the application's JTS.
This oracle covers this bay at 0/90 degrees, not general holes or split pieces.
"""
from fractions import Fraction as F
from math import floor, ceil
import json
from pathlib import Path

source=json.loads((Path(__file__).parent/'../area-grid-footprints/source.json').read_text())['ceiling']
origin=[F(str(v)) for v in source['grid_origin_pixels']]
ring=[((F(str(x))-origin[0])/9,(F(str(y))-origin[1])/9) for x,y in source['vertices']]

def area(p):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1])))/2 if p else F(0)

def clip(p,axis,bound,greater):
    result=[]
    for a,b in zip(p,p[1:]+p[:1]):
        ina=a[axis]>=bound if greater else a[axis]<=bound
        inb=b[axis]>=bound if greater else b[axis]<=bound
        if ina!=inb:
            t=(bound-a[axis])/(b[axis]-a[axis])
            result.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(2)))
        if inb: result.append(b)
    return result

def calculate(angle):
    local=ring if angle==0 else [(y,-x) for x,y in ring]
    stepX,stepY=F(2),F(4)
    halfX,halfY=stepX/2,stepY/2
    cells=[]
    for row in range(floor((min(p[1] for p in local)-1-halfY)/stepY),ceil((max(p[1] for p in local)-1+halfY)/stepY)+1):
        for col in range(floor((min(p[0] for p in local)-1-halfX)/stepX),ceil((max(p[0] for p in local)-1+halfX)/stepX)+1):
            x,y=1+col*stepX,1+row*stepY
            p=local
            for axis,bound,greater in [(0,x-halfX,True),(0,x+halfX,False),(1,y-halfY,True),(1,y+halfY,False)]:
                p=clip(p,axis,bound,greater)
            a=area(p)
            if a:cells.append({'key':f'{row}:{col}','kind':'full' if a==8 else 'cut','area_sf':float(a)})
    assert abs(sum(F(str(c['area_sf'])) for c in cells)-area(ring))<F(1,10**9)
    return {'angle_deg':angle,'full_tiles':sum(c['kind']=='full' for c in cells),'cut_cells':sum(c['kind']=='cut' for c in cells),'covered_sf':float(area(ring)),'covered_sf_exact':str(area(ring)),'cells':cells}

result={'method':__doc__.strip(),'cases':[calculate(0),calculate(90)]}
(Path(__file__).parent/'expected.json').write_text(json.dumps(result,indent=2)+'\n')
for case in result['cases']:print({k:v for k,v in case.items() if k!='cells'})
