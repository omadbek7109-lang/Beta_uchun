import random, math
from PIL import Image, ImageDraw, ImageFilter
def snow(n, seed, k, rmin, rmax, out):
    rnd = random.Random(seed)
    big = Image.new('RGBA', (n * 2, n * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    for _ in range(k):
        x, y = rnd.random() * n * 2, rnd.random() * n * 2; r = rnd.uniform(rmin, rmax) * 2; a = int(rnd.uniform(.55, 1) * 255)
        for ox in (-n * 2, 0, n * 2):
            for oy in (-n * 2, 0, n * 2):
                d.ellipse((x + ox - r, y + oy - r, x + ox + r, y + oy + r), fill=(255, 255, 255, a))
    g = big.filter(ImageFilter.GaussianBlur(1.6))
    core = big.filter(ImageFilter.GaussianBlur(.6))
    im = Image.alpha_composite(g, core).resize((n, n), Image.LANCZOS)
    im.save(out, 'WEBP', quality=90, method=6)
snow(256, 5, 18, 1.0, 2.2, '/home/claude/work/out-ny-snow-far.webp')
snow(256, 9, 9, 1.8, 3.6, '/home/claude/work/out-ny-snow-near.webp')
