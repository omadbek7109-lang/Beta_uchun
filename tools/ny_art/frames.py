import math, random, subprocess, os
W = 512
OUT = '/home/claude/work/frames'

def render(name, body, defs=''):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W*2}" height="{W*2}"><defs>{COMMON}{defs}</defs>{body}</svg>'
    p = f'{OUT}/{name}.svg'; open(p, 'w').write(svg)
    subprocess.run(['rsvg-convert', p, '-o', f'{OUT}/{name}@2x.png'], check=True)

COMMON = '''
<filter id="blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="blur4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="drop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0a0820" flood-opacity=".6"/></filter>
<filter id="dropS" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#0a0820" flood-opacity=".55"/></filter>
<linearGradient id="snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef4ff"/><stop offset="1" stop-color="#b9cbec"/></linearGradient>
<linearGradient id="icicle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#cfe6ff" stop-opacity=".85"/><stop offset="1" stop-color="#8fc8ff" stop-opacity=".25"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d0"/><stop offset=".28" stop-color="#ffd772"/><stop offset=".6" stop-color="#e0a52c"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>
<linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c2"/><stop offset=".35" stop-color="#f5c451"/><stop offset=".7" stop-color="#c98a1c"/><stop offset="1" stop-color="#7a4d0c"/></linearGradient>
<radialGradient id="warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c4"/><stop offset=".35" stop-color="#ffc35a"/><stop offset="1" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient>
<radialGradient id="cold" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#9fd8ff"/><stop offset="1" stop-color="#3f8cff" stop-opacity="0"/></radialGradient>
'''

def rr(x0, y0, x1, y1, r):
    return f'M{x0+r},{y0}H{x1-r}A{r},{r} 0 0 1 {x1},{y0+r}V{y1-r}A{r},{r} 0 0 1 {x1-r},{y1}H{x0+r}A{r},{r} 0 0 1 {x0},{y1-r}V{y0+r}A{r},{r} 0 0 1 {x0+r},{y0}Z'

def ring(outer, inner):
    """even-odd path: outer rounded rect minus inner"""
    return f'<path fill-rule="evenodd" d="{rr(*outer)} {rr(*inner)}"'

def snow_cap(x0, x1, y, h, seed, under=6):
    """a lumpy snow ridge along y (top), from x0 to x1, thickness h"""
    rnd = random.Random(seed)
    n = max(3, int((x1 - x0) / 40))
    xs = [x0 + (x1 - x0) * i / n for i in range(n + 1)]
    top = f'M{x0},{y+h*.6}'
    for i in range(n):
        a, b = xs[i], xs[i + 1]; m = (a + b) / 2
        top += f' Q{m},{y - h*rnd.uniform(.1,.45)} {b},{y + h*rnd.uniform(.15,.4)}'
    # underside, with drips
    bot = ''
    for i in range(n, 0, -1):
        a, b = xs[i], xs[i - 1]; m = (a + b) / 2
        bot += f' Q{m},{y + h + rnd.uniform(-2, under)} {b},{y + h*rnd.uniform(.75,1.05)}'
    d = top + f' L{x1},{y+h}' + bot + 'Z'
    s = f'<path d="{d}" fill="#7f96c6" opacity=".45" transform="translate(0 2.5)" filter="url(#blur2)"/>'
    s += f'<path d="{d}" fill="url(#snow)"/>'
    # highlight sparkles
    for i in range(n):
        if rnd.random() < .6:
            px = rnd.uniform(x0 + 4, x1 - 4); py = y + h * rnd.uniform(.15, .5)
            s += f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{rnd.uniform(.6,1.3):.1f}" fill="#fff"/>'
    return s

def snow_pile(cx, cy, r, seed):
    rnd = random.Random(seed); k = 9
    pts = []
    for i in range(k):
        a = i / k * 2 * math.pi; rr_ = r * rnd.uniform(.78, 1.08)
        pts.append((cx + math.cos(a) * rr_, cy + math.sin(a) * rr_ * .82))
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(k):
        p, q = pts[i], pts[(i + 1) % k]
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        ox, oy = mx - cx, my - cy; L = math.hypot(ox, oy) or 1
        d += f' Q{mx + ox/L*r*.22:.1f},{my + oy/L*r*.22:.1f} {q[0]:.1f},{q[1]:.1f}'
    d += 'Z'
    s = f'<path d="{d}" fill="#6f86b8" opacity=".5" transform="translate(0 3)" filter="url(#blur2)"/>'
    s += f'<path d="{d}" fill="url(#snow)"/>'
    s += f'<ellipse cx="{cx - r*.25:.1f}" cy="{cy - r*.3:.1f}" rx="{r*.42:.1f}" ry="{r*.22:.1f}" fill="#fff" opacity=".9"/>'
    for _ in range(3):
        s += f'<circle cx="{cx + rnd.uniform(-r*.6, r*.6):.1f}" cy="{cy + rnd.uniform(-r*.5, r*.2):.1f}" r="{rnd.uniform(.6,1.2):.1f}" fill="#fff"/>'
    return s

def icicles(x0, x1, y, seed, maxlen=16, minlen=5, dens=9, glow=False):
    rnd = random.Random(seed); s = ''
    x = x0 + rnd.uniform(0, dens)
    while x < x1:
        w = rnd.uniform(2.5, 5); L = rnd.uniform(minlen, maxlen)
        s += f'<path d="M{x-w:.1f},{y} L{x+w:.1f},{y} L{x+rnd.uniform(-.8,.8):.1f},{y+L:.1f}Z" fill="url(#icicle)"/>'
        s += f'<path d="M{x-w*.4:.1f},{y+1} L{x-w*.1:.1f},{y+L*.7:.1f}" stroke="#fff" stroke-width=".7" opacity=".8"/>'
        x += rnd.uniform(dens * .6, dens * 1.5)
    if glow:
        s = f'<g filter="url(#blur2)" opacity=".7">{s.replace("url(#icicle)", "#7cc4ff")}</g>' + s
    return s

def flake(cx, cy, R, col='#ffffff', w=2.0, op=1):
    s = f'<g stroke="{col}" stroke-width="{w}" stroke-linecap="round" opacity="{op}" fill="none">'
    for k in range(6):
        a = math.pi / 2 + k * math.pi / 3
        ex, ey = cx + math.cos(a) * R, cy - math.sin(a) * R
        s += f'<line x1="{cx}" y1="{cy}" x2="{ex:.2f}" y2="{ey:.2f}"/>'
        for f, L in ((.5, .32), (.75, .22)):
            px, py = cx + math.cos(a) * R * f, cy - math.sin(a) * R * f
            for sg in (-1, 1):
                b = a + sg * math.pi / 4
                s += f'<line x1="{px:.2f}" y1="{py:.2f}" x2="{px + math.cos(b)*R*L:.2f}" y2="{py - math.sin(b)*R*L:.2f}"/>'
    return s + '</g>'

def crown(cx, cy, w, fill='url(#gold)', stroke='#6b3d06', gem=None):
    k = w / 40
    g = f'<g transform="translate({cx-20*k:.2f} {cy-16*k:.2f}) scale({k:.3f})" filter="url(#dropS)">'
    g += f'<path d="M2 27L0 7l10 8 10-14 10 14 10-8-2 20z" fill="{fill}" stroke="{stroke}" stroke-width="1.4" stroke-linejoin="round"/>'
    g += '<path d="M3.5 10l6.5 6 10-12.5 10 12.5 6.5-6" fill="none" stroke="#fff8dc" stroke-opacity=".75" stroke-width="1"/>'
    g += f'<rect x="2" y="25" width="36" height="7" rx="1.8" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>'
    for x, y in ((0, 7), (20, 1), (40, 7)):
        g += f'<circle cx="{x}" cy="{y}" r="2.6" fill="#fff4cc" stroke="{stroke}" stroke-width=".8"/>'
    if gem:
        g += f'<path d="M20 15l4 5-4 5-4-5z" fill="{gem}" stroke="#f3e8ff" stroke-width=".7"/><circle cx="11" cy="28.5" r="1.8" fill="{gem}"/><circle cx="29" cy="28.5" r="1.8" fill="{gem}"/>'
    return g + '</g>'

def holly(cx, cy, s=1.0, flip=False):
    tf = f'translate({cx} {cy}) scale({-s if flip else s} {s})'
    g = f'<g transform="{tf}" filter="url(#dropS)">'
    # pine needles
    for a, L in ((-150, 26), (-120, 30), (-95, 24), (-170, 22), (-60, 22), (-30, 18)):
        r = math.radians(a); ex, ey = math.cos(r) * L, math.sin(r) * L
        g += f'<line x1="0" y1="0" x2="{ex:.1f}" y2="{ey:.1f}" stroke="#1f5a34" stroke-width="2.2" stroke-linecap="round"/>'
        for t in (.35, .55, .75, .9):
            px, py = ex * t, ey * t
            for sg in (-1, 1):
                b = r + sg * .9
                g += f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{px + math.cos(b)*6:.1f}" y2="{py + math.sin(b)*6:.1f}" stroke="#2f7d4a" stroke-width="1.1" stroke-linecap="round"/>'
    # holly leaves
    for a in (-200, 20):
        g += f'<g transform="rotate({a})"><path d="M0 0 q6 -5 9 -2 q2 -4 6 -2 q1 -4 5 -1 q4 1 5 4 q-4 1 -5 4 q-4 -1 -6 3 q-3 -2 -6 1 q-4 -3 -8 -7z" fill="#2e8b4f" stroke="#14492a" stroke-width=".8"/><path d="M1 0 L22 0" stroke="#9fe0b4" stroke-width=".6" opacity=".7"/></g>'
    # berries
    for x, y in ((-2, 4), (4, 2), (1, 9)):
        g += f'<circle cx="{x}" cy="{y}" r="3.6" fill="#d61f2c" stroke="#7a0b12" stroke-width=".7"/><circle cx="{x-1.1}" cy="{y-1.2}" r="1.1" fill="#ffd2d2"/>'
    return g + '</g>'

def lantern(cx, cy, s=1.0, metal='#3a2a33', light='#ffcf6b'):
    g = f'<g transform="translate({cx} {cy}) scale({s})">'
    g += f'<circle cx="0" cy="0" r="22" fill="url(#warm)" opacity=".85"/>'
    g += f'<g filter="url(#dropS)"><path d="M-4,-14 h8 l2,3 h-12z" fill="{metal}"/>'
    g += f'<rect x="-8" y="-11" width="16" height="20" rx="2.5" fill="{metal}"/>'
    g += f'<rect x="-5.5" y="-8.5" width="11" height="15" rx="1.5" fill="{light}"/>'
    g += f'<rect x="-5.5" y="-8.5" width="11" height="15" rx="1.5" fill="url(#warm)"/>'
    g += f'<path d="M0 -8.5 V6.5 M-5.5 -1 H5.5" stroke="{metal}" stroke-width="1.4"/>'
    g += f'<path d="M-9 9 h18 l-2 3 h-14z" fill="{metal}"/></g>'
    g += f'<circle cx="-2" cy="-4" r="1.6" fill="#fff" opacity=".9"/>'
    return g + '</g>'

def shield(cx, cy, w, fill='#3b157a', rim='url(#gold)', inner=''):
    h = w * 1.18
    d = f'M{cx-w/2},{cy-h/2} H{cx+w/2} V{cy-h*.05} Q{cx+w/2},{cy+h*.32} {cx},{cy+h/2} Q{cx-w/2},{cy+h*.32} {cx-w/2},{cy-h*.05}Z'
    s = f'<g filter="url(#drop)"><path d="{d}" fill="{rim}"/>'
    sc = .78
    d2 = f'M{cx-w/2*sc},{cy-h/2*sc} H{cx+w/2*sc} V{cy-h*.05*sc} Q{cx+w/2*sc},{cy+h*.32*sc} {cx},{cy+h/2*sc} Q{cx-w/2*sc},{cy+h*.32*sc} {cx-w/2*sc},{cy-h*.05*sc}Z'
    s += f'<path d="{d2}" fill="{fill}"/><path d="{d2}" fill="url(#shGloss)"/></g>' + inner
    return s

def crystal(cx, cy, s, seed, flip=1):
    rnd = random.Random(seed); g = f'<g transform="translate({cx} {cy}) scale({s*flip} {s})">'
    g += '<circle cx="0" cy="4" r="30" fill="url(#cold)" opacity=".55"/>'
    for a, L, w in ((-90, 34, 9), (-60, 26, 7), (-122, 28, 7), (-35, 18, 6), (-150, 18, 6)):
        r = math.radians(a)
        tip = (math.cos(r) * L, math.sin(r) * L); nx, ny = -math.sin(r) * w / 2, math.cos(r) * w / 2
        b1 = (nx, ny); b2 = (-nx, -ny)
        sh = (math.cos(r) * L * .78 + nx, math.sin(r) * L * .78 + ny); sh2 = (math.cos(r) * L * .78 - nx, math.sin(r) * L * .78 - ny)
        d = f'M{b1[0]:.1f},{b1[1]:.1f} L{sh[0]:.1f},{sh[1]:.1f} L{tip[0]:.1f},{tip[1]:.1f} L{sh2[0]:.1f},{sh2[1]:.1f} L{b2[0]:.1f},{b2[1]:.1f}Z'
        g += f'<path d="{d}" fill="url(#crys)" stroke="#e8f6ff" stroke-width=".8" stroke-opacity=".9"/>'
        g += f'<path d="M0,0 L{tip[0]:.1f},{tip[1]:.1f}" stroke="#ffffff" stroke-width=".9" opacity=".75"/>'
    return g + '</g>'

def grain(x0, y0, x1, y1, seed, horizontal=True, col='#2a1d27', op=.35, n=10):
    rnd = random.Random(seed); s = f'<g stroke="{col}" stroke-width=".9" fill="none" opacity="{op}">'
    for i in range(n):
        if horizontal:
            y = y0 + (y1 - y0) * (i + .5) / n
            d = f'M{x0},{y:.1f}'
            x = x0
            while x < x1:
                nx = min(x1, x + rnd.uniform(30, 70)); d += f' Q{(x+nx)/2:.1f},{y + rnd.uniform(-2.5, 2.5):.1f} {nx:.1f},{y + rnd.uniform(-1, 1):.1f}'; x = nx
        else:
            x = x0 + (x1 - x0) * (i + .5) / n
            d = f'M{x:.1f},{y0}'
            y = y0
            while y < y1:
                ny = min(y1, y + rnd.uniform(30, 70)); d += f' Q{x + rnd.uniform(-2.5, 2.5):.1f},{(y+ny)/2:.1f} {x + rnd.uniform(-1, 1):.1f},{ny:.1f}'; y = ny
        s += f'<path d="{d}"/>'
    return s + '</g>'
