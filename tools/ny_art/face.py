from PIL import Image, ImageDraw, ImageFilter
def face(src, cx, cy, rx, ry, size=160, m=1.0):
    im = Image.open(src).convert('RGB')
    box = (cx-rx*m, cy-ry*m, cx+rx*m, cy+ry*m)
    sq = im.transform((size*4, size*4), Image.EXTENT, box, Image.BICUBIC)
    mask = Image.new('L', (size*4, size*4), 0)
    ImageDraw.Draw(mask).ellipse((2, 2, size*4-3, size*4-3), fill=255)
    out = sq.convert('RGBA'); out.putalpha(mask)
    return out.resize((size, size), Image.LANCZOS)
