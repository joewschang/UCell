"""Compile government GML county polygons into bounded display-only SVG paths."""
import argparse, hashlib, json, math, pathlib, xml.etree.ElementTree as ET, zipfile
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args()
raw=pathlib.Path(a.input).read_bytes();z=zipfile.ZipFile(a.input)
root=ET.fromstring(z.read(next(n for n in z.namelist() if n.endswith('.gml'))))
pub='{http://standards.moi.gov.tw/schema/pub}';gml='{http://www.opengis.net/gml}'
def simplify(points,tolerance=.003):
    if len(points)<4:return points
    start,end=points[0],points[-1];dx,dy=end[0]-start[0],end[1]-start[1]
    denominator=dx*dx+dy*dy
    def distance(point):
        t=max(0,min(1,((point[0]-start[0])*dx+(point[1]-start[1])*dy)/denominator)) if denominator else 0
        return math.hypot(point[0]-start[0]-t*dx,point[1]-start[1]-t*dy)
    index=max(range(1,len(points)-1),key=lambda i:distance(points[i]))
    if distance(points[index])<=tolerance:return [start,end]
    return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)
features=[]
for member in root.findall(gml+'featureMember'):
    feature=list(member)[0];code=feature.findtext(pub+'行政區域代碼');name=feature.findtext(pub+'名稱')
    rings=[]
    for coordinates in feature.iter(gml+'coordinates'):
        points=[tuple(map(float,pair.split(',')[:2])) for pair in coordinates.text.split()]
        reduced=simplify(points)
        rings.append(reduced if len(reduced)>=4 else points[:3]+[points[0]])
    features.append({'code':code,'name':name,'rings':rings})
points=[p for f in features for ring in f['rings'] for p in ring]
minx,maxx=min(p[0] for p in points),max(p[0] for p in points);miny,maxy=min(p[1] for p in points),max(p[1] for p in points)
scale=min(680/((maxx-minx)*math.cos(math.radians(24))),460/(maxy-miny))
def project(p):return ((p[0]-minx)*math.cos(math.radians(24))*scale+20,(maxy-p[1])*scale+20)
paths=[]
for f in features:
    rings=[]
    for ring in f['rings']:
        xy=[project(p) for p in ring]
        rings.append('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in xy)+'Z')
    paths.append({'code':f['code'],'name':f['name'],'path':''.join(rings)})
if len(paths)!=22 or len({f['code'] for f in paths})!=22:raise ValueError('Incomplete government county coverage')
result={'version':'NLSC_COUNTY_1140318','source':'https://data.gov.tw/dataset/7442','license':'Government Open Data License v1.0','sourceSha256':hashlib.sha256(raw).hexdigest(),'viewBox':'0 0 720 500','paths':paths}
pathlib.Path(a.output).parent.mkdir(parents=True,exist_ok=True)
pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('GEO_MAP_COUNTY_PATHS_PASS: 22 official county polygons')
