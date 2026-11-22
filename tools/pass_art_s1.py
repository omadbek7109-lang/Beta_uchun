# DAMEO PASS Season 01 — 40 reward illustrations, drawn from scratch as SVG (128x128, transparent).
import math, os
OUT = '/home/claude/beta_uchun/public/pass/s1'
os.makedirs(OUT, exist_ok=True)

def defs():
    return '''<defs>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8d6"/><stop offset=".3" stop-color="#fcd34d"/><stop offset=".65" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient>
<radialGradient id="goldR" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#fcd34d"/><stop offset=".75" stop-color="#d97706"/><stop offset="1" stop-color="#92400e"/></radialGradient>
<linearGradient id="goldE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b45309"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#78350f"/></linearGradient>
<linearGradient id="silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d4d9e2"/><stop offset=".8" stop-color="#8a94a6"/><stop offset="1" stop-color="#cbd2dc"/></linearGradient>
<linearGradient id="silverE" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b8496"/><stop offset="1" stop-color="#4b5263"/></linearGradient>
<linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde2c4"/><stop offset=".45" stop-color="#d08a4e"/><stop offset="1" stop-color="#7c4420"/></linearGradient>
<linearGradient id="violet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ddd6fe"/><stop offset=".45" stop-color="#8b5cf6"/><stop offset="1" stop-color="#4c1d95"/></linearGradient>
<radialGradient id="violetR" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f3e8ff"/><stop offset=".35" stop-color="#c084fc"/><stop offset=".75" stop-color="#7e22ce"/><stop offset="1" stop-color="#3b0764"/></radialGradient>
<linearGradient id="hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="haloG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fde68a" stop-opacity=".75"/><stop offset=".55" stop-color="#f59e0b" stop-opacity=".22"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
<radialGradient id="haloV" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#c4b5fd" stop-opacity=".55"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
<radialGradient id="floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#14052e" stop-opacity=".55"/><stop offset="1" stop-color="#14052e" stop-opacity="0"/></radialGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="#12032b" flood-opacity=".55"/></filter>
<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>'''

def svg(body, premium=False):
    halo = '<circle cx="64" cy="64" r="62" fill="url(#haloG)"/>' if premium else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">{defs()}{halo}{body}</svg>'

def floor(cy=112, rx=40):
    return f'<ellipse cx="64" cy="{cy}" rx="{rx}" ry="{rx*0.18:.1f}" fill="url(#floor)"/>'

def spark(x, y, s=5, c='#fff7d1'):
    return f'<path d="M{x} {y-s}L{x+s*.28} {y-s*.28}L{x+s} {y}L{x+s*.28} {y+s*.28}L{x} {y+s}L{x-s*.28} {y+s*.28}L{x-s} {y}L{x-s*.28} {y-s*.28}Z" fill="{c}"/>'

def sparks(pts, c='#fff7d1'):
    return ''.join(spark(x, y, s, c) for x, y, s in pts)

# ---------- coins
def coin(x, y, r, metal='gold', emblem='D'):
    ry = r * .42
    face = {'gold': 'url(#goldR)', 'silver': 'url(#silver)', 'bronze': 'url(#bronze)'}[metal]
    edge = {'gold': 'url(#goldE)', 'silver': 'url(#silverE)', 'bronze': '#7c4420'}[metal]
    stroke = {'gold': '#92400e', 'silver': '#4b5263', 'bronze': '#5b2f14'}[metal]
    mark = {'gold': '#b45309', 'silver': '#6b7280', 'bronze': '#7c4420'}[metal]
    th = r * .32
    s = f'<path d="M{x-r} {y}v{th}a{r} {ry} 0 0 0 {2*r} 0v-{th}" fill="{edge}" stroke="{stroke}" stroke-width="1"/>'
    s += f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{ry:.2f}" fill="{face}" stroke="{stroke}" stroke-width="1"/>'
    s += f'<ellipse cx="{x}" cy="{y}" rx="{r*.72:.2f}" ry="{ry*.68:.2f}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>'
    if emblem == 'D':
        s += f'<text x="{x}" y="{y+ry*.42:.1f}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="{r*.7:.1f}" fill="{mark}" transform="translate(0 0) scale(1 1)">D</text>'
    else:
        s += f'<path d="M{x-r*.32} {y+ry*.25}l{r*.1} {-ry*.6} {r*.22} {ry*.32} {r*.22} {-ry*.32} {r*.1} {ry*.6}z" fill="{mark}"/>'
    s += f'<path d="M{x-r*.75} {y-ry*.2}a{r*.85} {ry*.7} 0 0 1 {r*.9} {-ry*.55}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.4" stroke-linecap="round"/>'
    return s

def coin_pile(spec, metal='gold', emblem='D'):
    return ''.join(coin(x, y, r, metal, emblem) for x, y, r in spec)

# ---------- crown
def crown(x, y, w, gems=True, fill='url(#gold)', stroke='#7c2d12'):
    k = w / 40
    g = f'<g transform="translate({x-20*k:.2f} {y-15*k:.2f}) scale({k:.3f})">'
    g += f'<path d="M2 26L0 6l10 8 10-14 10 14 10-8-2 20z" fill="{fill}" stroke="{stroke}" stroke-width="1.3" stroke-linejoin="round"/>'
    g += '<path d="M3 9l7 6 10-13 10 13 7-6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>'
    g += f'<rect x="2" y="24" width="36" height="6.5" rx="1.6" fill="{fill}" stroke="{stroke}" stroke-width="1.1"/>'
    for cx, cy in ((0, 6), (20, 0), (40, 6)):
        g += f'<circle cx="{cx}" cy="{cy}" r="2.5" fill="#fff3c4" stroke="{stroke}" stroke-width=".8"/>'
    if gems:
        g += '<circle cx="11" cy="27.2" r="1.9" fill="#ef4444"/><path d="M20 17l3.4 4.6L20 26l-3.4-4.4z" fill="#a855f7" stroke="#f3e8ff" stroke-width=".6"/><circle cx="29" cy="27.2" r="1.9" fill="#22c55e"/>'
    return g + '</g>'

# ---------- checker piece
def piece(x, y, r, top, side, rim, emblem=None, emc='#fde68a'):
    ry = r * .42; th = r * .36
    s = f'<path d="M{x-r} {y}v{th}a{r} {ry} 0 0 0 {2*r} 0v-{th}" fill="{side}" stroke="{rim}" stroke-width="1"/>'
    for i in range(1, 4):
        s += f'<path d="M{x-r} {y+th*i/4:.1f}a{r} {ry} 0 0 0 {2*r} 0" fill="none" stroke="{rim}" stroke-opacity=".35" stroke-width=".8"/>'
    s += f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{ry:.2f}" fill="{top}" stroke="{rim}" stroke-width="1"/>'
    s += f'<ellipse cx="{x}" cy="{y}" rx="{r*.68:.2f}" ry="{ry*.66:.2f}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.4"/>'
    if emblem == 'crown':
        s += f'<path d="M{x-r*.36} {y+ry*.3}l{-r*.04} {-ry*.75} {r*.17} {ry*.36} {r*.23} {-ry*.6} {r*.23} {ry*.6} {r*.17} {-ry*.36} {-r*.04} {ry*.75}z" fill="{emc}"/>'
    s += f'<path d="M{x-r*.7} {y-ry*.25}a{r*.8} {ry*.7} 0 0 1 {r*.85} {-ry*.55}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" stroke-linecap="round"/>'
    return s

# ---------- isometric board
def board(cx, cy, size, light, dark, frame, frame_dark, n=6, rim_gems=False):
    # diamond: top (cx, cy-size/2), right (cx+size, cy), bottom (cx, cy+size/2), left (cx-size, cy)
    def P(u, v):  # u,v in [0,1]
        return (cx - size + size * (u + v) * 1.0, cy + (v - u) * size / 2)
    s = ''
    th = size * .14
    L, T, R, B = P(0, 0), P(1, 0), P(1, 1), P(0, 1)
    # thickness
    s += f'<path d="M{L[0]:.1f} {L[1]:.1f}L{B[0]:.1f} {B[1]:.1f}L{R[0]:.1f} {R[1]:.1f}L{R[0]:.1f} {R[1]+th:.1f}L{B[0]:.1f} {B[1]+th:.1f}L{L[0]:.1f} {L[1]+th:.1f}z" fill="{frame_dark}"/>'
    s += f'<path d="M{B[0]:.1f} {B[1]:.1f}L{R[0]:.1f} {R[1]:.1f}L{R[0]:.1f} {R[1]+th:.1f}L{B[0]:.1f} {B[1]+th:.1f}z" fill="#000" opacity=".18"/>'
    s += f'<path d="M{L[0]:.1f} {L[1]:.1f}L{T[0]:.1f} {T[1]:.1f}L{R[0]:.1f} {R[1]:.1f}L{B[0]:.1f} {B[1]:.1f}z" fill="{frame}"/>'
    m = .08
    for i in range(n):
        for j in range(n):
            u0, u1 = m + (1 - 2 * m) * i / n, m + (1 - 2 * m) * (i + 1) / n
            v0, v1 = m + (1 - 2 * m) * j / n, m + (1 - 2 * m) * (j + 1) / n
            a, b, c, d = P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)
            col = dark if (i + j) % 2 else light
            s += f'<path d="M{a[0]:.1f} {a[1]:.1f}L{b[0]:.1f} {b[1]:.1f}L{c[0]:.1f} {c[1]:.1f}L{d[0]:.1f} {d[1]:.1f}z" fill="{col}"/>'
    s += f'<path d="M{L[0]:.1f} {L[1]:.1f}L{T[0]:.1f} {T[1]:.1f}" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/>'
    if rim_gems:
        for p in (L, T, R, B):
            s += f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="3.2" fill="#a855f7" stroke="#fde68a" stroke-width="1.2"/>'
    return s

# ---------- ticket
def ticket(x, y, w, h, fill, stroke, text, tcol, rot=-12, extra=''):
    n = h * .2
    d = f'M{x} {y}h{w}v{h/2-n}a{n} {n} 0 0 0 0 {2*n}v{h/2-n}h{-w}v{-(h/2-n)}a{n} {n} 0 0 0 0 {-2*n}z'
    s = f'<g transform="rotate({rot} {x+w/2} {y+h/2})" filter="url(#sh)"><path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
    s += f'<rect x="{x+5}" y="{y+5}" width="{w-10}" height="{h-10}" rx="4" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.3" stroke-dasharray="3 3"/>'
    s += f'<path d="M{x+6} {y+4}h{w-12}" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>'
    s += text + extra + '</g>'
    return s

# ---------- chest
def chest(x, y, w, h, body, lid, trim, trim_dark, gem=None, open_glow=False):
    s = ''
    if open_glow:
        s += f'<ellipse cx="{x+w/2}" cy="{y}" rx="{w*.55}" ry="{h*.5}" fill="url(#haloG)"/>'
    s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{body}" stroke="#1e0838" stroke-width="1.5"/>'
    s += f'<path d="M{x} {y+1}c0-{h*.85} {w} -{h*.85} {w} 0z" fill="{lid}" stroke="#1e0838" stroke-width="1.5"/>'
    s += f'<path d="M{x+6} {y-h*.32}q{w*.25} -{h*.28} {w*.5} -{h*.3}" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>'
    s += f'<rect x="{x}" y="{y-2}" width="{w}" height="6" fill="{trim}" stroke="{trim_dark}" stroke-width=".8"/>'
    s += f'<rect x="{x}" y="{y+h-6}" width="{w}" height="5" fill="{trim}" stroke="{trim_dark}" stroke-width=".8"/>'
    for bx in (x + w * .16, x + w * .78):
        s += f'<rect x="{bx}" y="{y-h*.62}" width="{w*.07}" height="{h*1.6}" fill="{trim}" stroke="{trim_dark}" stroke-width=".8"/>'
    s += f'<path d="M{x+w/2-9} {y+2}h18v13l-9 6-9-6z" fill="{trim}" stroke="{trim_dark}" stroke-width="1.2"/>'
    s += f'<circle cx="{x+w/2}" cy="{y+10}" r="3.4" fill="{gem or trim_dark}" stroke="#fff" stroke-width="1"/>'
    return s

# ---------- medal / badge
def ribbon_tails(cx, y, c1, c2):
    return (f'<path d="M{cx-16} {y}l-8 30 9-5 6 9 8-30z" fill="{c1}" stroke="#1e0838" stroke-width="1"/>'
            f'<path d="M{cx+16} {y}l8 30-9-5-6 9-8-30z" fill="{c2}" stroke="#1e0838" stroke-width="1"/>')

def star(cx, cy, r, fill, stroke='none', sw=0, ri=None):
    ri = ri or r * .45
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else ri
        pts.append(f'{cx+rr*math.cos(a):.1f},{cy+rr*math.sin(a):.1f}')
    return f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'

def laurel(cx, cy, r, fill, stroke, leaves=6):
    s = ''
    for side in (-1, 1):
        for i in range(leaves):
            a = math.radians(200 - i * 22) if side < 0 else math.radians(-20 + i * 22)
            a = math.pi - a if side > 0 else a
            px, py = cx + side * abs(r * math.cos(math.radians(110 + i * 18))) , cy + r * math.sin(math.radians(110 + i * 18)) * -1 + r * .1
            ang = (-40 + i * 18) * side
            s += f'<ellipse cx="{px:.1f}" cy="{py:.1f}" rx="4.2" ry="9" transform="rotate({ang} {px:.1f} {py:.1f})" fill="{fill}" stroke="{stroke}" stroke-width=".9"/>'
    return s

def banner(y, w, fill, dark, text, tcol, star_c=None):
    x = 64 - w / 2
    s = f'<path d="M{x-14} {y+4}l10 9-10 9h18v-18z" fill="{dark}"/><path d="M{x+w+14} {y+4}l-10 9 10 9h-18v-18z" fill="{dark}"/>'
    s += f'<path d="M{x} {y}h{w}l-3 11 3 11h-{w}l3-11z" fill="{fill}" stroke="#1e0838" stroke-width="1.4" stroke-linejoin="round"/>'
    s += f'<path d="M{x+4} {y+3}h{w-8}" stroke="#fff" stroke-opacity=".6" stroke-width="1.6"/>'
    if star_c:
        s += star(64, y + 11, 7, star_c, '#1e0838', .8)
    if text:
        s += f'<text x="64" y="{y+15}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="10" fill="{tcol}">{text}</text>'
    return s

# ---------- frame around a round avatar hole (centre 64,70 r 40)
def frame(kind):
    cx, cy = 64, 70
    s = ''
    if kind == 'basic':
        s += f'<circle cx="{cx}" cy="{cy}" r="45" fill="none" stroke="url(#silver)" stroke-width="9"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="49.5" fill="none" stroke="#4b5263" stroke-width="1.2"/><circle cx="{cx}" cy="{cy}" r="40.5" fill="none" stroke="#4b5263" stroke-width="1.2"/>'
        for a in range(0, 360, 90):
            x = cx + 45 * math.cos(math.radians(a)); y = cy + 45 * math.sin(math.radians(a))
            s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="#e5e7eb" stroke="#4b5263" stroke-width="1"/>'
        return s
    if kind == 'royal':          # premium 4: gold ring + crown + laurels
        s += f'<circle cx="{cx}" cy="{cy}" r="45" fill="none" stroke="url(#gold)" stroke-width="10"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="50.5" fill="none" stroke="#7c2d12" stroke-width="1.4"/><circle cx="{cx}" cy="{cy}" r="39.5" fill="none" stroke="#7c2d12" stroke-width="1.4"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="45" fill="none" stroke="#fff3c4" stroke-opacity=".6" stroke-width="1.4" stroke-dasharray="2 5"/>'
        for a in (200, 340, 160, 20):
            x = cx + 45 * math.cos(math.radians(a)); y = cy + 45 * math.sin(math.radians(a))
            s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="#a855f7" stroke="#fde68a" stroke-width="1.2"/>'
        s += crown(64, 22, 40)
        s += f'<path d="M50 116l14-6 14 6-14 6z" fill="#a855f7" stroke="#fde68a" stroke-width="1.4"/>'
        return s
    if kind == 'premium':        # premium 13: violet + gold double ring, gems
        s += f'<circle cx="{cx}" cy="{cy}" r="47" fill="none" stroke="url(#violet)" stroke-width="8"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="41.5" fill="none" stroke="url(#gold)" stroke-width="4"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="51.5" fill="none" stroke="url(#gold)" stroke-width="2.4"/>'
        for a in range(0, 360, 45):
            x = cx + 47 * math.cos(math.radians(a)); y = cy + 47 * math.sin(math.radians(a))
            s += f'<path d="M{x:.1f} {y-4:.1f}l3.4 4-3.4 4-3.4-4z" fill="#fde68a" stroke="#7c2d12" stroke-width=".8"/>'
        s += crown(64, 20, 30, gems=False)
        return s
    if kind == 'legend':         # premium 16: flaming violet-gold ring with flames
        for i in range(16):
            a = math.radians(i * 22.5)
            x = cx + 50 * math.cos(a); y = cy + 50 * math.sin(a)
            ang = i * 22.5 + 90
            s += f'<path d="M{x:.1f} {y:.1f}c-3-5 0-9 3-12 0 4 3 6 2 10z" transform="rotate({ang} {x:.1f} {y:.1f})" fill="{"#f472b6" if i%2 else "#f59e0b"}" opacity=".9"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="45" fill="none" stroke="url(#violetR)" stroke-width="10"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="45" fill="none" stroke="url(#gold)" stroke-width="3"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="40" fill="none" stroke="#fde68a" stroke-width="1.4"/>'
        s += crown(64, 20, 34)
        s += sparks([(18, 30, 4), (110, 34, 4), (112, 104, 3.5)])
        return s
    if kind == 'eternal':        # premium 20: ULTIMATE — wings + double gold + big crown + gems
        for side in (-1, 1):
            for i in range(5):
                L = 24 - i * 3
                y0 = 46 + i * 9
                x0 = 64 + side * 46
                s += f'<path d="M{x0} {y0}q{side*L*.6:.1f} -10 {side*L:.1f} -4q{-side*L*.3:.1f} 8 {-side*L:.1f} 10z" fill="url(#gold)" stroke="#7c2d12" stroke-width="1"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="47" fill="none" stroke="url(#goldE)" stroke-width="12"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="47" fill="none" stroke="url(#gold)" stroke-width="8"/>'
        s += f'<circle cx="{cx}" cy="{cy}" r="40" fill="none" stroke="#f472b6" stroke-width="2"/>'
        for a in range(0, 360, 30):
            x = cx + 47 * math.cos(math.radians(a)); y = cy + 47 * math.sin(math.radians(a))
            col = '#ef4444' if a % 90 == 0 else '#a855f7'
            s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.6" fill="{col}" stroke="#fff7d1" stroke-width=".8"/>'
        s += crown(64, 16, 46)
        s += f'<path d="M64 108l9 8-9 9-9-9z" fill="#ef4444" stroke="#fde68a" stroke-width="1.6"/>'
        s += sparks([(14, 22, 5), (114, 20, 5), (10, 96, 4), (118, 92, 4)])
        return s
    return s

# ---------- scenes (inside a rounded card for the icon; full scene files for the profile)
def scene(kind, w=400, h=160):
    if kind == 'mountains':
        return (f'<rect width="{w}" height="{h}" fill="url(#sk1)"/>'
                f'<circle cx="{w*.78}" cy="{h*.28}" r="{h*.13}" fill="#f5f3ff"/><circle cx="{w*.8}" cy="{h*.25}" r="{h*.12}" fill="#c4b5fd" opacity=".35"/>'
                + ''.join(f'<circle cx="{w*x}" cy="{h*y}" r="1.4" fill="#fff"/>' for x, y in ((.1, .15), (.25, .3), (.4, .12), (.55, .22), (.65, .1), (.9, .45), (.33, .5)))
                + f'<path d="M0 {h}L{w*.18} {h*.45}L{w*.32} {h*.7}L{w*.5} {h*.3}L{w*.68} {h*.66}L{w*.82} {h*.48}L{w} {h*.8}V{h}z" fill="#6d28d9"/>'
                f'<path d="M{w*.5} {h*.3}L{w*.56} {h*.42}L{w*.52} {h*.4}L{w*.47} {h*.45}z" fill="#ede9fe"/>'
                f'<path d="M0 {h}L{w*.12} {h*.7}L{w*.3} {h*.86}L{w*.45} {h*.64}L{w*.62} {h*.9}L{w*.8} {h*.7}L{w} {h*.9}V{h}z" fill="#3b0764"/>')
    if kind == 'desert':
        return (f'<rect width="{w}" height="{h}" fill="url(#sk2)"/>'
                f'<circle cx="{w*.3}" cy="{h*.45}" r="{h*.17}" fill="#fde68a"/>'
                f'<path d="M0 {h*.72}Q{w*.25} {h*.55} {w*.5} {h*.7}T{w} {h*.62}V{h}H0z" fill="#d97706"/>'
                f'<path d="M0 {h*.86}Q{w*.3} {h*.72} {w*.6} {h*.86}T{w} {h*.8}V{h}H0z" fill="#92400e"/>'
                f'<path d="M{w*.72} {h*.62}v-{h*.18}m0 {h*.06}h-{w*.03}v-{h*.06}m{w*.03} {h*.1}h{w*.03}v-{h*.08}" stroke="#14532d" stroke-width="{h*.025}" fill="none" stroke-linecap="round"/>')
    if kind == 'castle':
        s = (f'<rect width="{w}" height="{h}" fill="url(#sk3)"/>'
             + ''.join(f'<circle cx="{w*x}" cy="{h*y}" r="1.6" fill="#fde68a"/>' for x, y in ((.08, .12), (.2, .3), (.85, .15), (.92, .4), (.7, .08), (.3, .1)))
             + f'<circle cx="{w*.5}" cy="{h*.42}" r="{h*.42}" fill="url(#haloG)"/>')
        X = w * .5; base = h
        s += f'<path d="M{X-w*.22} {base}V{h*.6}h{w*.06}v-{h*.08}h{w*.03}v{h*.08}h{w*.05}V{h*.38}l{w*.04} -{h*.16} {w*.04} {h*.16}V{h*.6}h{w*.05}v-{h*.08}h{w*.03}v{h*.08}h{w*.06}V{base}z" fill="#2e1065"/>'
        s += f'<path d="M{X-w*.04} {h*.38}l{w*.04} -{h*.16} {w*.04} {h*.16}z" fill="#f59e0b"/>'
        for wx in (X - w * .15, X - w * .01, X + w * .12):
            s += f'<rect x="{wx}" y="{h*.68}" width="{w*.025}" height="{h*.08}" rx="{w*.012}" fill="#fbbf24"/>'
        return s
    return ''

SKY = ('<linearGradient id="sk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>'
       '<linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c2d12"/><stop offset=".55" stop-color="#f97316"/><stop offset="1" stop-color="#fde68a"/></linearGradient>'
       '<linearGradient id="sk3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0620"/><stop offset=".7" stop-color="#4c1d95"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>')

def scene_icon(kind, border, border_dark, premium=False):
    s = f'<defs>{SKY}<clipPath id="cp"><rect x="14" y="28" width="100" height="72" rx="12"/></clipPath></defs>'
    s += f'<rect x="12" y="30" width="104" height="74" rx="14" fill="{border_dark}"/>'
    s += f'<g clip-path="url(#cp)"><g transform="translate(14 28) scale(.25 .45)">{scene(kind)}</g></g>'
    s += f'<rect x="14" y="28" width="100" height="72" rx="12" fill="none" stroke="{border}" stroke-width="4"/>'
    s += '<path d="M24 34h40" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>'
    return s

def scene_file(kind):
    # profile header is almost square -> draw the scene at 400x340 so nothing gets blown up
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 340" preserveAspectRatio="xMidYMid slice"><defs>{SKY}<radialGradient id="haloG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fde68a" stop-opacity=".55"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient></defs>{scene(kind, 400, 340)}</svg>'

# ---------- emoji bubbles
def bubble(x, y, w, h, fill, tail=True):
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h*.32:.1f}" fill="{fill}" stroke="#1e0838" stroke-width="1.4"/>'
    if tail:
        s += f'<path d="M{x+w*.25} {y+h-1}l-2 10 10-10z" fill="{fill}" stroke="#1e0838" stroke-width="1.4" stroke-linejoin="round"/>'
        s += f'<path d="M{x+w*.22} {y+h-2}h12" stroke="{fill}" stroke-width="3"/>'
    s += f'<path d="M{x+6} {y+5}h{w*.45}" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>'
    return s

def face(cx, cy, r, mood='smile'):
    s = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fcd34d" stroke="#b45309" stroke-width="1.2"/>'
    s += f'<circle cx="{cx-r*.35}" cy="{cy-r*.15}" r="{r*.12}" fill="#3b0764"/><circle cx="{cx+r*.35}" cy="{cy-r*.15}" r="{r*.12}" fill="#3b0764"/>'
    if mood == 'smile':
        s += f'<path d="M{cx-r*.45} {cy+r*.2}q{r*.45} {r*.45} {r*.9} 0" stroke="#3b0764" stroke-width="{r*.12}" fill="none" stroke-linecap="round"/>'
    else:
        s += f'<path d="M{cx-r*.4} {cy+r*.25}q{r*.4} {r*.25} {r*.8} 0" stroke="#3b0764" stroke-width="{r*.12}" fill="none" stroke-linecap="round"/><path d="M{cx-r*.55} {cy-r*.45}l{r*.3} {r*.12}M{cx+r*.55} {cy-r*.45}l{-r*.3} {r*.12}" stroke="#3b0764" stroke-width="{r*.1}" stroke-linecap="round"/>'
    return s

def heart(cx, cy, s_, fill):
    return f'<path d="M{cx} {cy+s_*.9}C{cx-s_*1.4} {cy} {cx-s_*.9} {cy-s_*1.1} {cx} {cy-s_*.35}C{cx+s_*.9} {cy-s_*1.1} {cx+s_*1.4} {cy} {cx} {cy+s_*.9}z" fill="{fill}" stroke="#1e0838" stroke-width="1.2"/>'

def crystal(cx, by, h, w, c1, c2, c3):
    return (f'<path d="M{cx} {by-h}l{w/2} {h*.3} 0 {h*.5} {-w/2} {h*.2} {-w/2} {-h*.2} 0 {-h*.5}z" fill="{c2}" stroke="#2e1065" stroke-width="1.2" stroke-linejoin="round"/>'
            f'<path d="M{cx} {by-h}l{w/2} {h*.3} {-w/2} {h*.2}z" fill="{c1}"/><path d="M{cx} {by-h}v{h*.5}l{-w/2} {-h*.2}z" fill="{c3}" opacity=".85"/>'
            f'<path d="M{cx-w*.3} {by-h*.62}v{h*.35}" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>')

def wing(side, x, y, s_, fill):
    d = f'M{x} {y}' + ''.join(f'q{side*s_*(0.5+i*.12):.1f} {-6+i*3} {side*s_*(1-i*.15):.1f} {-2+i*6}' for i in range(4)) + f'Q{x+side*s_*.4} {y+s_*.55} {x} {y+s_*.25}z'
    return f'<path d="{d}" fill="{fill}" stroke="#7c2d12" stroke-width="1.2" stroke-linejoin="round"/>'

def big(body, k=1.32, cy=78):
    return f'<g transform="translate(64 {cy}) scale({k}) translate(-64 -{cy})">{body}</g>'

def wing2(side, x, y, fill):
    s = ''
    for i in range(6):
        ang = side * (-62 + i * 17)
        L = 46 - i * 4.5
        s += f'<ellipse cx="{x + side*L*.5:.1f}" cy="{y}" rx="{L*.5:.1f}" ry="{6.5-i*.4:.1f}" transform="rotate({ang} {x} {y})" fill="{fill}" stroke="#7c2d12" stroke-width="1"/>'
    return s

# ======================================================================== FREE 1..20 (simpler: flatter, silver / bronze / violet)
F = {}
F[1] = svg(big(floor(108, 34) + coin_pile([(50, 86, 18), (78, 90, 18), (64, 72, 18)]), 1.55, 86))
F[2] = svg(big(floor(106, 40) + piece(46, 74, 24, '#3a3f4b', '#23262e', '#111318') + piece(80, 84, 24, '#f4f4f5', '#c9ccd3', '#6b7280'), 1.25, 82))
F[3] = svg(floor(108, 36) + ticket(18, 38, 92, 50, 'url(#violet)', '#3b0764', '<text x="58" y="72" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="26" fill="#fff">XP</text>', '#fff', -10,
                                   '<text x="96" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="9" fill="#ede9fe" transform="rotate(90 96 63)">+10%</text>'))
F[4] = svg(scene_icon('mountains', '#a78bfa', '#4c1d95'))
F[5] = svg(big(floor(110, 38) + coin_pile([(42, 92, 16), (86, 92, 16), (64, 96, 16), (52, 76, 16), (76, 76, 16), (64, 60, 16)]), 1.35, 84))
F[6] = svg(bubble(14, 20, 50, 40, '#8b5cf6') + face(39, 40, 13) + bubble(62, 50, 50, 40, '#3b82f6') + heart(87, 70, 10, '#f472b6') + bubble(26, 74, 44, 34, '#22c55e', False) + piece(48, 88, 11, '#3a3f4b', '#23262e', '#111318'))
F[7] = svg(frame('basic'))
F[8] = svg(floor(108, 36) + ticket(18, 38, 92, 50, '#2563eb', '#1e3a8a', '<path d="M60 46l-14 22h12l-6 18 20-26h-12l8-14z" fill="#fde68a" stroke="#1e3a8a" stroke-width="1.6" stroke-linejoin="round"/>', '#fff', -10,
                                   '<text x="96" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="9" fill="#dbeafe" transform="rotate(90 96 63)">+20%</text>'))
F[9] = svg(big(floor(110, 44) + board(64, 70, 50, '#ecd9b8', '#7c4a26', '#a0612f', '#5b3416'), 1.15, 74))
F[10] = svg(ribbon_tails(64, 78, '#2563eb', '#1d4ed8') + f'<circle cx="64" cy="58" r="30" fill="url(#bronze)" stroke="#5b2f14" stroke-width="2"/><circle cx="64" cy="58" r="22" fill="#9a5a2e" stroke="#fde2c4" stroke-opacity=".6" stroke-width="1.5"/>' + star(64, 58, 14, '#fde2c4', '#5b2f14', 1.2) + '<path d="M44 42q8-10 22-12" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" fill="none" stroke-linecap="round"/>')
F[11] = svg(big(floor(110, 40) + coin_pile([(36, 94, 15), (62, 98, 15), (90, 94, 15), (48, 80, 15), (76, 80, 15), (62, 64, 15), (36, 78, 15)]), 1.3, 84))
F[12] = svg(scene_icon('desert', '#fbbf24', '#7c2d12'))
F[13] = svg(f'<g transform="rotate(-8 64 64)" filter="url(#sh)"><rect x="16" y="38" width="96" height="50" rx="12" fill="#16a34a" stroke="#14532d" stroke-width="2"/><rect x="20" y="42" width="88" height="42" rx="9" fill="#22c55e"/><path d="M26 47h50" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/><text x="64" y="75" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="26" fill="#f0fdf4" stroke="#14532d" stroke-width="1.2">WIN</text></g>')
F[14] = svg(floor(110, 34) + '<circle cx="62" cy="66" r="38" fill="#7c3aed" stroke="#2e1065" stroke-width="2"/><circle cx="62" cy="66" r="28" fill="#ede9fe"/><circle cx="62" cy="66" r="19" fill="#8b5cf6"/><circle cx="62" cy="66" r="9" fill="#ede9fe"/><circle cx="62" cy="66" r="4" fill="#5b21b6"/>'
            '<path d="M62 66L100 28" stroke="#4b5263" stroke-width="3.4" stroke-linecap="round"/><path d="M100 28l-2-10 8 2 2-6 4 8-8 2z" fill="#a78bfa" stroke="#3b0764" stroke-width="1"/>'
            '<circle cx="98" cy="96" r="13" fill="#f59e0b" stroke="#7c2d12" stroke-width="1.5"/><text x="98" y="101" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="12" fill="#fff">+1</text>')
F[15] = svg(big(floor(112, 42) + coin_pile([(34, 96, 15), (60, 100, 15), (86, 98, 15), (46, 82, 15), (72, 84, 15), (98, 82, 15), (58, 66, 15), (84, 68, 15)]), 1.28, 84))
F[16] = svg(ribbon_tails(64, 78, '#6b7280', '#4b5263') + f'<circle cx="64" cy="58" r="30" fill="url(#silver)" stroke="#4b5263" stroke-width="2"/><circle cx="64" cy="58" r="22" fill="#9ca3af" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>' + laurel(64, 58, 20, '#e5e7eb', '#4b5263', 3) + star(64, 56, 11, '#fff', '#4b5263', 1.2) + '<path d="M44 42q8-10 22-12" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/>')
F[17] = svg(big(banner(52, 72, 'url(#violet)', '#4c1d95', '', '#fff', '#fde68a') + '<text x="64" y="96" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="#ede9fe">FAOL</text>', 1.45, 72))
F[18] = svg(big(floor(110, 44) + board(64, 70, 50, '#e0f2fe', '#1d4ed8', '#7c3aed', '#3b0764'), 1.15, 74))
F[19] = svg(floor(112, 42) + chest(22, 66, 84, 40, '#7c3aed', 'url(#violet)', 'url(#silver)', '#4b5263', '#60a5fa'))
F[20] = svg(laurel(64, 64, 34, '#d4d9e2', '#4b5263', 6) + '<circle cx="64" cy="62" r="24" fill="url(#silver)" stroke="#4b5263" stroke-width="2"/><circle cx="64" cy="62" r="18" fill="#312e81"/><text x="64" y="70" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-style="italic" font-size="20" fill="#e0e7ff">S1</text>' + banner(94, 52, '#4c1d95', '#312e81', '', '#fff'))

# ======================================================================== PREMIUM 1..20 (gold, gems, halos, sparkles)
P = {}
SP = lambda: sparks([(20, 26, 5), (108, 22, 4), (112, 92, 3.5)])
P[1] = svg(big(floor(112, 44) + coin_pile([(36, 96, 17), (64, 100, 17), (92, 96, 17), (48, 80, 17), (80, 80, 17), (64, 62, 17)], 'gold', 'crown') + SP(), 1.25, 84), True)
P[2] = svg(big(floor(108, 42) + piece(46, 78, 24, '#1f1b2e', '#0f0c1a', '#f59e0b', 'crown', '#fbbf24') + piece(82, 86, 24, 'url(#goldR)', 'url(#goldE)', '#7c2d12', 'crown', '#7c2d12') + crown(84, 40, 32) + SP(), 1.12, 74), True)
P[3] = svg(floor(110, 38) + ticket(14, 36, 100, 54, 'url(#gold)', '#7c2d12', '<text x="58" y="73" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="28" font-style="italic" fill="#7c2d12">XP</text>', '#7c2d12', -12,
                                   '<text x="100" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="10" fill="#7c2d12" transform="rotate(90 100 63)">+50%</text><path d="M84 50l6-8 6 8" stroke="#7c2d12" stroke-width="2.4" fill="none"/>') + SP(), True)
P[4] = svg(frame('royal'))
P[5] = svg(floor(112, 40) + crystal(40, 104, 46, 26, '#f5d0fe', '#a855f7', '#7e22ce') + crystal(88, 104, 46, 26, '#f5d0fe', '#a855f7', '#7e22ce') + crystal(64, 108, 70, 34, '#fae8ff', '#c026d3', '#86198f') + SP(), True)
P[6] = svg('<ellipse cx="64" cy="76" rx="50" ry="20" fill="none" stroke="#c084fc" stroke-width="5" opacity=".55"/><ellipse cx="64" cy="76" rx="42" ry="15" fill="none" stroke="#e879f9" stroke-width="3"/><ellipse cx="64" cy="76" rx="54" ry="23" fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="10 8"/>'
           + piece(64, 70, 22, '#1f1b2e', '#0f0c1a', '#e879f9', 'crown', '#f0abfc') + crown(80, 40, 22) + sparks([(18, 56, 4, ), (110, 62, 4), (96, 102, 3)], '#f5d0fe'), True)
P[7] = svg(big(floor(112, 48) + board(64, 70, 52, '#fde68a', '#3b0764', 'url(#gold)', '#7c2d12', 6, True) + crown(64, 22, 26) + SP(), 1.08, 70), True)
P[8] = svg(bubble(10, 16, 54, 44, 'url(#violetR)') + crown(37, 40, 28) + bubble(64, 34, 54, 44, 'url(#gold)') + heart(91, 54, 11, '#ef4444') + bubble(30, 74, 48, 40, '#db2777', False) + face(54, 94, 13, 'cool') + SP(), True)
P[9] = svg(big(banner(48, 78, 'url(#gold)', '#92400e', '', '#7c2d12', None) + crown(64, 54, 26) + '<text x="64" y="98" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="12" fill="#fde68a" stroke="#7c2d12" stroke-width=".6">ELITE</text>' + SP(), 1.3, 72), True)
P[10] = svg(floor(114, 46) + chest(18, 64, 92, 44, '#7e22ce', 'url(#violetR)', 'url(#gold)', '#7c2d12', '#ec4899', True) + crown(64, 30, 22) + SP(), True)
P[11] = svg(big(floor(114, 48) + coin_pile([(30, 98, 15), (56, 102, 15), (82, 102, 15), (106, 96, 15), (42, 84, 15), (68, 86, 15), (94, 82, 15), (54, 68, 15), (80, 68, 15), (66, 52, 15)], 'gold', 'crown') + SP(), 1.2, 82), True)
P[12] = svg(scene_icon('castle', 'url(#gold)', '#7c2d12', True) + SP(), True)
P[13] = svg(frame('premium'))
P[14] = svg('<ellipse cx="64" cy="80" rx="48" ry="18" fill="#f97316" opacity=".35"/>' + ''.join(f'<path d="M{64+46*math.cos(math.radians(a)):.1f} {80+17*math.sin(math.radians(a)):.1f}c-4-8 0-14 4-18 0 6 4 9 3 14z" fill="{c}"/>' for a, c in ((200, '#f97316'), (240, '#fb923c'), (290, '#f97316'), (330, '#fbbf24'), (20, '#f97316'), (160, '#fbbf24')))
            + '<ellipse cx="64" cy="80" rx="44" ry="15" fill="none" stroke="#fbbf24" stroke-width="3.5"/>' + piece(64, 72, 22, '#1f1b2e', '#0f0c1a', '#f97316', 'crown', '#fbbf24') + crown(64, 38, 34) + SP(), True)
P[15] = svg(floor(110, 38) + ticket(14, 38, 100, 52, 'url(#gold)', '#7c2d12', crown(56, 66, 34), '#7c2d12', -12,
                                    '<text x="100" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="10" fill="#7c2d12" transform="rotate(90 100 63)">+5</text>') + SP(), True)
P[16] = svg(frame('legend'))
P[17] = svg(laurel(64, 62, 36, 'url(#gold)', '#7c2d12', 6) + '<circle cx="64" cy="60" r="26" fill="url(#goldR)" stroke="#7c2d12" stroke-width="2"/><circle cx="64" cy="60" r="20" fill="#4c1d95"/><text x="64" y="69" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-style="italic" font-size="22" fill="#fde68a">S1</text>'
            + crown(64, 24, 30) + banner(94, 56, 'url(#gold)', '#92400e', '', '#7c2d12', '#ef4444') + SP(), True)
P[18] = svg(wing2(-1, 52, 70, 'url(#gold)') + wing2(1, 76, 70, 'url(#gold)') + piece(64, 74, 18, '#1f1b2e', '#0f0c1a', '#fde68a', 'crown', '#fbbf24') + crown(64, 44, 30) + SP(), True)
P[19] = svg('<circle cx="64" cy="66" r="38" fill="#2e1065" stroke="url(#gold)" stroke-width="4"/>' + laurel(64, 66, 40, '#fbbf24', '#7c2d12', 5) + crown(64, 64, 52)
            + '<text x="64" y="102" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="10" fill="#fde68a" letter-spacing="1">IMMORTAL</text>' + SP(), True)
P[20] = svg(frame('eternal'))

for i in range(1, 21):
    open(f'{OUT}/free-{i:02d}.svg', 'w').write(F[i])
    open(f'{OUT}/prem-{i:02d}.svg', 'w').write(P[i])
for k in ('mountains', 'desert', 'castle'):
    open(f'{OUT}/scene-{k}.svg', 'w').write(scene_file(k))
print('ok', len(os.listdir(OUT)))
