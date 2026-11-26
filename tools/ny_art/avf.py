import numpy as np
from PIL import Image, ImageDraw
src = np.asarray(Image.open('/home/claude/work/src/avatar_frames.png').convert('RGB')).astype(float)
BOX = {
  'ny-snow':     (90, 145, 385, 418),
  'ny-tale':     (438, 145, 738, 418),
  'ny-cabin':    (788, 140, 1102, 418),
  'ny-gifts':    (1148, 140, 1452, 418),
  'ny-crystal':  (78, 515, 398, 815),
  'ny-aurora':   (440, 515, 748, 815),
}
out = {}
for k, (x0, y0, x1, y1) in BOX.items():
    c = src[y0:y1, x0:x1]
    border = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])
    bg = np.median(border, axis=0)
    lum = c @ np.array([.3, .55, .15]); bl = bg @ np.array([.3, .55, .15])
    d = np.abs(c - bg).max(axis=2)
    a = np.clip((lum - bl - 10) / 75, 0, 1) * 0.8 + np.clip((d - 30) / 90, 0, 1) * 0.2
    a = np.clip(a * 1.15, 0, 1) ** 1.05
    col = np.where(a[..., None] > 0.02, (c - bg * (1 - a[..., None])) / np.maximum(a[..., None], 0.02), 0)
    rgba = np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    # square canvas centred on the crop
    S = max(im.size) + 16
    sq = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sq.paste(im, ((S - im.width) // 2, (S - im.height) // 2))
    out[k] = sq
    sq.resize((320, 320), Image.LANCZOS).save(f'/home/claude/work/fr/{k}.png')
# preview on dark and light backgrounds
cv = Image.new('RGBA', (6 * 330, 660), (14, 10, 34, 255))
ImageDraw.Draw(cv).rectangle((0, 330, 6 * 330, 660), fill=(238, 240, 248, 255))
for i, k in enumerate(BOX):
    im = Image.open(f'/home/claude/work/fr/{k}.png')
    cv.alpha_composite(im, (i * 330, 5)); cv.alpha_composite(im, (i * 330, 335))
cv.save('/home/claude/work/avf.png')
