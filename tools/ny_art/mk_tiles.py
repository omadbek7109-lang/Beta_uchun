import sys; sys.path.insert(0,'/home/claude/work')
from tex import tile
from PIL import Image
S=192
T={
 'frost-l': tile(S,11,'#cbd6ef','#e0e8f9','#f5f8ff',(140,160,205),4,.45,spark=10),
 'frost-d': tile(S,12,'#18357a','#27499e','#3c66c2',(175,210,255),5,.75,spark=14),
 'ice-l':   tile(S,21,'#d3dbec','#e7edf7','#fafcff',(155,170,200),4,.4,spark=8),
 'ice-d':   tile(S,22,'#112e72','#1d4598','#3063c4',(150,200,255),4,.55,flake=((200,230,255),105,.34),spark=10),
 'aurora-l':tile(S,31,'#d4d2f2','#e7e6fb','#f8f7ff',(140,150,220),4,.45,spark=12),
 'aurora-d':tile(S,32,'#1a1662','#2a2894','#4a3fc6',(150,215,255),6,.8,flake=((190,232,255),100,.3),spark=16),
}
for n,im in T.items(): im.save(f'/home/claude/work/tile-{n}.png')
c=Image.new('RGB',(3*394,384))
for k,b in enumerate(['frost','ice','aurora']):
  ch=Image.new('RGB',(S*4,S*4))
  for r in range(4):
    for q in range(4): ch.paste(T[b+('-d' if (r+q)%2 else '-l')],(q*S,r*S))
  c.paste(ch.resize((384,384),Image.LANCZOS),(k*394,0))
c.save('/home/claude/work/chk.png')
