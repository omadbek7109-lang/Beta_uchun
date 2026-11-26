import numpy as np, json
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
R = '/home/claude/beta_uchun/public/pass'
res = {}
cv = Image.new('RGBA', (2 * 330, 660), (14, 10, 34, 255)); ImageDraw.Draw(cv).rectangle((0, 330, 660, 660), fill=(238, 240, 248, 255))
for i, (k, f) in enumerate((('ny-royal', 'src/av_royal.png'), ('ny-dragon', 'src/av_dragon.png'))):
    c = np.asarray(Image.open(f).convert('RGB')).astype(float)
    lum = c @ np.array([.3, .55, .15]); d = c.max(axis=2)
    a = np.clip((lum - 8) / 70, 0, 1) * 0.75 + np.clip((d - 20) / 90, 0, 1) * 0.25
    a = np.clip(a * 1.2, 0, 1)
    col = np.clip(c / np.maximum(a[..., None], .02), 0, 255) * (a[..., None] > .01)
    im = Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    x0, y0, x1, y1 = bb; S = max(x1 - x0, y1 - y0) + 24; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sq = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sq.paste(im.crop(bb), (int(S / 2 - (x1 - x0) / 2), int(S / 2 - (y1 - y0) / 2)))
    sq = sq.resize((360, 360), Image.LANCZOS)
    sq.save(f'{R}/frame-{k}.webp', 'WEBP', quality=90, method=6); sq.save(f'fr/{k}.png')
    A = np.asarray(sq)[..., 3] / 255; N = A.shape[0]
    lab, n = ndimage.label(A < 0.5)
    cidx = lab[N // 2, N // 2]
    hole = lab == cidx
    if hole[0].any() or hole[-1].any() or hole[:, 0].any() or hole[:, -1].any(): print(k, 'LEAK')
    hole = ndimage.binary_dilation(ndimage.binary_fill_holes(hole), iterations=5)
    ys, xs = np.where(hole); hx0, hx1, hy0, hy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    res[k] = {'x': round(hx0 / N, 4), 'y': round(hy0 / N, 4), 'w': round((hx1 - hx0) / N, 4), 'h': round((hy1 - hy0) / N, 4)}
    m = Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).crop((hx0, hy0, hx1, hy1))
    mk = Image.new('RGBA', m.size, (255, 255, 255, 0)); mk.putalpha(m); mk.save(f'{R}/frame-{k}-hole.webp', 'WEBP', lossless=True)
    ph = Image.new('RGBA', (N, N), (200, 120, 90, 255)); ImageDraw.Draw(ph).ellipse((N*.38, N*.3, N*.62, N*.55), fill=(240, 200, 170, 255))
    full = Image.new('L', (N, N), 0); full.paste(m, (hx0, hy0)); ph.putalpha(full); ph.alpha_composite(sq)
    cv.alpha_composite(ph.resize((320, 320)), (i * 330, 5)); cv.alpha_composite(sq.resize((320, 320)), (i * 330, 335))
cv.save('av2.png'); print(json.dumps(res))
