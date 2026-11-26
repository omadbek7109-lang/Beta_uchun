from frames import *
O = (44, 44, 468, 468)
defs = '''
<linearGradient id="silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9fd"/><stop offset=".3" stop-color="#c9d1df"/><stop offset=".55" stop-color="#8c97ab"/><stop offset=".8" stop-color="#c7cfdc"/><stop offset="1" stop-color="#6e788c"/></linearGradient>
<linearGradient id="silverV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#b8c2d2"/><stop offset="1" stop-color="#6f7a8f"/></linearGradient>
<linearGradient id="post" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef2f8"/><stop offset=".5" stop-color="#9aa5b8"/><stop offset="1" stop-color="#5d677b"/></linearGradient>
<radialGradient id="postGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d9f1ff"/><stop offset=".4" stop-color="#5fb6ff" stop-opacity=".9"/><stop offset="1" stop-color="#2a6cff" stop-opacity="0"/></radialGradient>
'''
b = f'<path fill-rule="evenodd" d="{rr(8, 12, 504, 506, 24)} {rr(O[0]+14, O[1]+14, O[2]-14, O[3]-14, 6)}" fill="#04060f" opacity=".6" filter="url(#blur8)"/>'
# outer blue glow
b += f'<path d="{rr(10, 10, 502, 502, 22)}" fill="none" stroke="#4aa8ff" stroke-width="6" opacity=".55" filter="url(#blur4)"/>'
b += ring((10, 10, 502, 502, 22), (O[0], O[1], O[2], O[3], 6)) + ' fill="url(#silver)" stroke="#3e4759" stroke-width="2"/>'
# brushed metal lines on the bands
b += f'<g clip-path="url(#bandI)">' + grain(10, 10, 502, 44, 21, col='#ffffff', op=.25, n=8) + grain(10, 468, 502, 502, 22, col='#ffffff', op=.2, n=8) + grain(10, 44, 44, 468, 23, False, col='#ffffff', op=.2, n=8) + grain(468, 44, 502, 468, 24, False, col='#ffffff', op=.2, n=8) + '</g>'
defs += f'<clipPath id="bandI"><path fill-rule="evenodd" d="{rr(10, 10, 502, 502, 22)} {rr(*O, 6)}"/></clipPath>'
b += f'<path d="{rr(14, 14, 498, 498, 19)}" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.2"/>'
# engraved pines and mountains on the bands
def scene(x, y, rot):
    g = f'<g transform="translate({x} {y}) rotate({rot})" opacity=".9">'
    g += '<path d="M-60,8 L-38,-9 L-26,0 L-12,-13 L4,4 L16,-6 L34,8Z" fill="#7d889c" stroke="#e9eef6" stroke-width="1" stroke-linejoin="round"/>'
    g += '<path d="M-38,-9 L-33,-5 L-36,-3 Z M-12,-13 L-7,-8 L-11,-6Z" fill="#ffffff"/>'
    for tx, s in ((-50, 1), (24, .9), (44, 1.1), (-66, .8)):
        g += f'<g transform="translate({tx} 8) scale({s})"><path d="M0,-17 L6,-8 H3 L8,-1 H4 L9,6 H-9 L-4,-1 H-8 L-3,-8 H-6Z" fill="#9aa6ba" stroke="#f2f6fb" stroke-width=".9" stroke-linejoin="round"/><rect x="-1.2" y="6" width="2.4" height="3" fill="#6d7890"/></g>'
    return g + '</g>'
for x in (160, 352):
    b += scene(x, 27, 0) + scene(x, 486, 0)
def pine(x, y, s=1):
    return f'<g transform="translate({x} {y}) scale({s})"><path d="M0,-17 L6,-8 H3 L8,-1 H4 L9,6 H-9 L-4,-1 H-8 L-3,-8 H-6Z" fill="#9aa6ba" stroke="#f2f6fb" stroke-width=".9" stroke-linejoin="round"/><rect x="-1.2" y="6" width="2.4" height="3" fill="#6d7890"/></g>'
for x in (27, 485):
    for y, s in ((112, .85), (150, 1), (190, .8), (322, .8), (362, 1), (400, .85)):
        b += pine(x, y, s)
# blue glowing lip
b += f'<path d="{rr(O[0]-3, O[1]-3, O[2]+3, O[3]+3, 8)}" fill="none" stroke="#3f9bff" stroke-width="5" filter="url(#blur2)"/>'
b += f'<path d="{rr(O[0]-2, O[1]-2, O[2]+2, O[3]+2, 7)}" fill="none" stroke="#bfe6ff" stroke-width="1.8"/>'
b += f'<path d="{rr(O[0]-8, O[1]-8, O[2]+8, O[3]+8, 11)}" fill="none" stroke="#586379" stroke-width="2"/>'
# LED dots
for i in range(1, 12):
    t = i / 12
    for (x, y) in ((44 + 424 * t, 38.5), (44 + 424 * t, 473.5), (38.5, 44 + 424 * t), (473.5, 44 + 424 * t)):
        if 0.12 < t < 0.88 and abs(t - .5) > .06:
            b += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6" fill="#bfe6ff"/><circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="#4aa8ff" opacity=".35"/>'
# corner posts with glowing snowflakes
for (cx, cy) in ((34, 34), (478, 34), (34, 478), (478, 478)):
    b += f'<g filter="url(#drop)"><path d="{rr(cx-30, cy-30, cx+30, cy+30, 9)}" fill="url(#post)" stroke="#3e4759" stroke-width="1.6"/></g>'
    b += f'<path d="{rr(cx-25, cy-25, cx+25, cy+25, 6)}" fill="#24304a" stroke="#dfe7f2" stroke-width="1.2"/>'
    b += f'<circle cx="{cx}" cy="{cy}" r="22" fill="url(#postGlow)"/>'
    b += f'<g filter="url(#blur2)">{flake(cx, cy, 15, "#7cc8ff", 3.2)}</g>' + flake(cx, cy, 15, '#ffffff', 1.8)
# mid-edge emblems
for (cx, cy) in ((256, 27), (256, 485), (27, 256), (485, 256)):
    b += f'<g filter="url(#dropS)"><path d="M{cx},{cy-13} L{cx+13},{cy} L{cx},{cy+13} L{cx-13},{cy}Z" fill="url(#post)" stroke="#3e4759" stroke-width="1.2"/></g>'
    b += f'<circle cx="{cx}" cy="{cy}" r="9" fill="url(#postGlow)"/>' + flake(cx, cy, 6.5, '#ffffff', 1.2)
# snow: caps on the corner posts and light snow on the top band
for (cx, cy, sd) in ((34, 34, 31), (478, 34, 32), (34, 478, 33), (478, 478, 34)):
    b += snow_cap(cx - 32, cx + 32, cy - 36, 13, sd, under=4)
b += snow_cap(70, 236, 4, 11, 41, under=3) + snow_cap(276, 442, 4, 11, 42, under=3)
b += icicles(66, 446, 16, 43, maxlen=9, minlen=3, dens=12)
b += icicles(70, 442, 503, 44, maxlen=9, minlen=3, dens=13, glow=True)
render('ny-ice-frame', b, defs)
print('fi', [round(v / 512, 4) for v in O])
