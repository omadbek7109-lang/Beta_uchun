from PIL import Image, ImageFilter
import json
FI = {'frost': (46, 50, 466, 470), 'ice': (44, 44, 468, 468), 'aurora': (56, 72, 456, 472)}
def board(b, size=1024):
    fr = Image.open(f'/home/claude/work/frames/ny-{b}-frame@2x.png').convert('RGBA')
    x0, y0, x1, y1 = [v * 2 for v in FI[b]]
    sq = (x1 - x0) / 8
    L = Image.open(f'/home/claude/work/tile-{b}-l.png').convert('RGB').resize((round(sq), round(sq)), Image.LANCZOS)
    D = Image.open(f'/home/claude/work/tile-{b}-d.png').convert('RGB').resize((round(sq), round(sq)), Image.LANCZOS)
    bg = Image.new('RGBA', fr.size, (14, 10, 34, 255))
    # a soft backdrop like the app's purple page
    for r in range(8):
        for c in range(8):
            bg.paste(D if (r + c) % 2 else L, (round(x0 + c * sq), round(y0 + r * sq)))
    bg.alpha_composite(fr)
    return bg
if __name__ == '__main__':
    c = Image.new('RGBA', (1560, 520), (25, 20, 45, 255))
    for k, b in enumerate(FI):
        c.alpha_composite(board(b).resize((512, 512), Image.LANCZOS), (k * 524, 4))
    c.save('/home/claude/work/pv.png')
