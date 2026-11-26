import numpy as np, math, random
from PIL import Image, ImageDraw, ImageFilter

def noise(n, seed, octaves=5):
    rng = np.random.default_rng(seed)
    acc = np.zeros((n, n)); amp = 1; tot = 0
    for o in range(octaves):
        g = 2 ** (o + 2)
        base = rng.random((g + 1, g + 1)); base[-1, :] = base[0, :]; base[:, -1] = base[:, 0]  # tileable
        im = Image.fromarray((base * 255).astype(np.uint8)).resize((n + n // g, n + n // g), Image.BICUBIC)
        a = np.asarray(im, dtype=float)[:n, :n] / 255
        acc += a * amp; tot += amp; amp *= 0.55
    acc /= tot
    return (acc - acc.min()) / (acc.max() - acc.min())

def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)

def lerp3(t, a, b, c):
    t = t[..., None]
    return np.where(t < .5, a + (b - a) * (t * 2), b + (c - b) * ((t - .5) * 2))

def cracks(n, seed, count, col, width, glow, alpha):
    rnd = random.Random(seed)
    lay = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for _ in range(count):
        x, y = rnd.random() * n, rnd.random() * n
        ang = rnd.random() * math.pi * 2
        pts = [(x, y)]
        for _ in range(rnd.randint(3, 6)):
            ang += rnd.uniform(-.38, .38); step = rnd.uniform(n * .07, n * .16)
            x += math.cos(ang) * step; y += math.sin(ang) * step; pts.append((x, y))
            if rnd.random() < .25:  # branch
                bx, by, ba = x, y, ang + rnd.choice([-1, 1]) * rnd.uniform(.6, 1.2)
                bp = [(bx, by)]
                for _ in range(rnd.randint(2, 4)):
                    bx += math.cos(ba) * step * .7; by += math.sin(ba) * step * .7; bp.append((bx, by))
                d.line(bp, fill=col + (int(alpha * 200),), width=max(1, width - 1))
        d.line(pts, fill=col + (int(alpha * 255),), width=width)
    g = lay.filter(ImageFilter.GaussianBlur(glow))
    out = Image.alpha_composite(g, lay)
    return out

def snowflake(n, col, alpha, r=0.36, w=None):
    lay = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    c = n / 2; R = n * r; w = w or max(2, n // 40)
    for k in range(6):
        a = math.pi / 2 + k * math.pi / 3
        ex, ey = c + math.cos(a) * R, c - math.sin(a) * R
        d.line([(c, c), (ex, ey)], fill=col + (alpha,), width=w)
        for f, L in ((.45, .28), (.72, .2)):
            px, py = c + math.cos(a) * R * f, c - math.sin(a) * R * f
            for s in (-1, 1):
                b = a + s * math.pi / 4
                d.line([(px, py), (px + math.cos(b) * R * L, py - math.sin(b) * R * L)], fill=col + (alpha,), width=w)
    d.ellipse((c - w * 1.6, c - w * 1.6, c + w * 1.6, c + w * 1.6), fill=col + (alpha,))
    g = lay.filter(ImageFilter.GaussianBlur(n / 60))
    return Image.alpha_composite(g, lay)

def sparkles(n, seed, k, alpha):
    rnd = random.Random(seed); lay = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for _ in range(k):
        x, y, r = rnd.random() * n, rnd.random() * n, rnd.uniform(.6, 1.8)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, int(alpha * rnd.uniform(.4, 1) * 255)))
    return lay

def tile(n, seed, c0, c1, c2, crack_col, crack_n, crack_a, flake=None, spark=0, sheen=True, bevel=True):
    t = noise(n, seed)
    rgb = lerp3(t, hexc(c0), hexc(c1), hexc(c2))
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA')
    img = Image.alpha_composite(img, cracks(n, seed + 7, crack_n, crack_col, max(1, n // 110), n / 90, crack_a))
    img = Image.alpha_composite(img, cracks(n, seed + 13, crack_n // 2 + 1, crack_col, 1, n / 200, crack_a * .5))
    if flake: img = Image.alpha_composite(img, snowflake(n, *flake))
    if spark: img = Image.alpha_composite(img, sparkles(n, seed + 3, spark, .9))
    if sheen:
        y, x = np.mgrid[0:n, 0:n] / n
        s = np.clip(1 - (x + y), 0, 1) ** 2 * 70
        a = np.zeros((n, n, 4), np.uint8); a[..., :3] = 255; a[..., 3] = s.astype(np.uint8)
        img = Image.alpha_composite(img, Image.fromarray(a))
    if bevel:
        lay = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
        d.rectangle((0, 0, n - 1, n - 1), outline=(255, 255, 255, 60), width=max(1, n // 64))
        img = Image.alpha_composite(img, lay.filter(ImageFilter.GaussianBlur(1)))
    return img.convert('RGB')
