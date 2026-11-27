import cv2, numpy as np, json
img=cv2.imread('master.png'); H,W=img.shape[:2]
m=cv2.imread('mask2.0.png',0)>0
yy,xx=np.mgrid[0:H,0:W]
ell=(((xx-836)/815)**2+((yy-430)/425)**2)<1
m&=ell&(yy>100)
m[690:,780:905]=False
m=m.astype(np.uint8)*255
m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))  # fill the + marks
# anisotropic distance: stretch y ×2
m2=cv2.resize(m,(W,H*2),interpolation=cv2.INTER_NEAREST)
dist=cv2.distanceTransform(m2,cv2.DIST_L2,5)
def s(y): return 0.55+0.45*np.clip((y-140)/(800-140),0,1.15)
acc=[]
cands=[]
for y in range(100,H,2):
    for x in range(0,W,2):
        if not m[y,x]: continue
        d=dist[y*2,x]
        if d>=12*s(y): cands.append((d/s(y),x,y))
cands.sort(reverse=True)
pts=np.zeros((0,2))
for d,x,y in cands:
    sc=s(y)
    if len(pts):
        dx=(pts[:,0]-x)/(46.5*sc); dy=(pts[:,1]-y)/(25.5*sc)
        if np.any(dx*dx+dy*dy<1): continue
    pts=np.vstack([pts,[x,y]])
print(len(pts))
o=img.copy()
for x,y in pts.astype(int):
    sc=s(y); cv2.ellipse(o,(x,y),(int(15*sc),int(8*sc)),0,0,360,(0,0,255),2)
cv2.imwrite('slots.png',o)
json.dump([[int(x),int(y)] for x,y in pts],open('slots.json','w'))
