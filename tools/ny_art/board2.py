import numpy as np
from PIL import Image
from scipy import ndimage
R = '/home/claude/beta_uchun/public/boards'
SPEC = {
  # name: (source, crop box, grid/opening box, light square box, dark square box)
  'ice':    ('src/boards2.png', (8, 8, 832, 925), (114, 140, 714, 799), (372, 225, 456, 305), (456, 225, 541, 305)),
  'frost':  ('src/boards2.png', (846, 2, 1668, 935), (960, 146, 1557, 802), (1217, 230, 1300, 310), (1300, 230, 1385, 310)),
  'aurora': ('src/board_aurora2.png', (0, 0, 1254, 1254), (146, 159, 1111, 1119), (507, 280, 627, 400), (387, 280, 507, 400)),
}
fis = {}
for name, (src, crop, op, lt, dt) in SPEC.items():
    im = Image.open(src).convert('RGB')
    c = np.asarray(im.crop(crop)).astype(float)
    H, W = c.shape[:2]
    lum = c @ np.array([.3, .55, .15]); mx = c.max(axis=2)
    dark = mx < 46
    lab, n = ndimage.label(dark)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bg = ndimage.binary_dilation(bg, iterations=1) & (mx < 70)
    a = np.ones((H, W))
    a[bg] = np.clip((lum[bg] - 6) / 55, 0, 1)
    # glow pixels outside the frame: un-premultiply over black
    col = np.where(a[..., None] > .02, c / np.maximum(a[..., None], .02), 0)
    col = np.clip(col, 0, 255)
    # the board opening: fully transparent (the real 8x8 board goes there); 3 px under the frame's inner edge
    ox0, oy0, ox1, oy1 = op[0] - crop[0] + 3, op[1] - crop[1] + 3, op[2] - crop[0] - 3, op[3] - crop[1] - 3
    a[oy0:oy1, ox0:ox1] = 0
    rgba = Image.fromarray(np.dstack([col, a * 255]).astype(np.uint8), 'RGBA')
    # make the opening square in pixels (no distortion in the app): scale the height by w/h
    ow, oh = op[2] - op[0], op[3] - op[1]
    sy = ow / oh
    W2 = 640; s = W2 / W
    H2 = round(H * s * sy)
    out = rgba.resize((W2, H2), Image.LANCZOS)
    fi = [round((op[0] - crop[0]) / W, 4), round((op[1] - crop[1]) / H, 4), round((op[2] - crop[0]) / W, 4), round((op[3] - crop[1]) / H, 4)]
    fis[name] = (fi, (W2, H2))
    out.save(f'{R}/ny-{name}-frame.webp', 'WEBP', quality=88, method=6)
    for tag, box in (('l', lt), ('d', dt)):
        x0, y0, x1, y1 = box
        t = im.crop((x0 + 5, y0 + 5, x1 - 5, y1 - 5)).resize((128, 128), Image.LANCZOS)
        t.save(f'{R}/ny-{name}-{tag}.webp', 'WEBP', quality=88, method=6)
    # shop preview: frame over an 8x8 board of the tiles, on the app's night backdrop
    L = Image.open(f'{R}/ny-{name}-l.webp').convert('RGB'); D = Image.open(f'{R}/ny-{name}-d.webp').convert('RGB')
    bx0, by0 = fi[0] * W2, fi[1] * H2; side = (fi[2] - fi[0]) * W2; sq = side / 8
    canvas = Image.new('RGBA', (W2, H2), (14, 10, 34, 255))
    Ls, Ds = L.resize((round(sq) + 1,) * 2), D.resize((round(sq) + 1,) * 2)
    for r in range(8):
        for q in range(8):
            canvas.paste(Ds if (r + q) % 2 else Ls, (round(bx0 + q * sq), round(by0 + r * sq)))
    canvas.alpha_composite(out)
    S = max(W2, H2); pv = Image.new('RGBA', (S, S), (14, 10, 34, 255)); pv.alpha_composite(canvas, ((S - W2) // 2, (S - H2) // 2))
    pv = pv.convert('RGB')
    pv.resize((512, 512), Image.LANCZOS).save(f'{R}/ny-{name}.webp', 'WEBP', quality=86, method=6)
    pv.resize((256, 256), Image.LANCZOS).save(f'{R}/ny-{name}-sm.webp', 'WEBP', quality=84, method=6)
    pv.resize((400, 400), Image.LANCZOS).save(f'/home/claude/work/pv2-{name}.png')
print(fis)
