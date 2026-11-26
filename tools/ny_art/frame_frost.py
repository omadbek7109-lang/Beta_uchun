from frames import *
O = (46, 50, 466, 470)  # opening
defs = '''
<linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a6072"/><stop offset=".45" stop-color="#5b4556"/><stop offset="1" stop-color="#3a2a36"/></linearGradient>
<linearGradient id="woodIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1d26"/><stop offset="1" stop-color="#4b3746"/></linearGradient>
<radialGradient id="shGloss" cx=".35" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<clipPath id="band"><path fill-rule="evenodd" d="''' + rr(14, 18, 498, 496, 24) + ' ' + rr(*O, 6) + '''"/></clipPath>
'''
b = ''
# shadow under the whole frame
b += f'<path fill-rule="evenodd" d="{rr(12, 20, 500, 502, 26)} {rr(O[0]+14, O[1]+14, O[2]-14, O[3]-14, 6)}" fill="#05040d" opacity=".55" filter="url(#blur8)"/>'
# wooden body
b += ring((14, 18, 498, 496, 24), (O[0], O[1], O[2], O[3], 6)) + ' fill="url(#wood)" stroke="#20151d" stroke-width="2"/>'
b += '<g clip-path="url(#band)">'
b += grain(14, 18, 498, 50, 1) + grain(14, 470, 498, 496, 2, n=6) + grain(14, 50, 46, 470, 3, False, n=6) + grain(466, 50, 498, 470, 4, False, n=6)
# carved knots (runes) on the side bands
for y in (130, 380):
    for x in (30, 482):
        b += f'<g stroke="#a58ea0" stroke-width="1.4" fill="none" opacity=".45"><path d="M{x},{y-12} l7,12 -7,12 -7,-12z"/><path d="M{x},{y-6} l3.5,6 -3.5,6 -3.5,-6z"/></g>'
for x in (130, 382):
    b += f'<g stroke="#a58ea0" stroke-width="1.4" fill="none" opacity=".4"><path d="M{x-14},{483} q7,-9 14,0 q7,9 14,0"/></g>'
b += '</g>'
# outer bevel + inner bevel
b += f'<path d="{rr(17, 21, 495, 493, 22)}" fill="none" stroke="#a88fa2" stroke-opacity=".45" stroke-width="1.5"/>'
b += f'<path d="{rr(O[0]-7, O[1]-7, O[2]+7, O[3]+7, 10)}" fill="none" stroke="url(#woodIn)" stroke-width="5"/>'
b += f'<path d="{rr(O[0]-9.5, O[1]-9.5, O[2]+9.5, O[3]+9.5, 12)}" fill="none" stroke="#9d8698" stroke-opacity=".5" stroke-width="1"/>'
# icy inner lip (glow)
b += f'<path d="{rr(O[0]-2, O[1]-2, O[2]+2, O[3]+2, 7)}" fill="none" stroke="#7fc0ff" stroke-width="4" filter="url(#blur2)" opacity=".85"/>'
b += f'<path d="{rr(O[0]-2, O[1]-2, O[2]+2, O[3]+2, 7)}" fill="none" stroke="#dff0ff" stroke-width="1.6"/>'
# lanterns on the side bands and beside the crown
b += lantern(30, 256, .95) + lantern(482, 256, .95) + lantern(196, 484, .82) + lantern(316, 484, .82)
# crown plaque at the bottom
b += f'<g filter="url(#drop)"><path d="{rr(226, 466, 286, 506, 8)}" fill="#4a3545" stroke="#1d131a" stroke-width="1.5"/><path d="{rr(229, 469, 283, 503, 6)}" fill="none" stroke="#a88fa2" stroke-opacity=".5"/></g>'
b += crown(256, 486, 34)
# snow: top ridge, bottom drifts, corner piles
b += snow_cap(20, 492, 16, 20, 7)
b += icicles(70, 440, 34, 3, maxlen=13, minlen=4, dens=11)
b += snow_cap(60, 180, 489, 11, 8, under=3) + snow_cap(334, 452, 489, 11, 9, under=3)
b += icicles(40, 470, 498, 5, maxlen=12, minlen=4, dens=10)
b += snow_cap(18, 40, 140, 9, 12, under=2) + snow_cap(472, 494, 330, 9, 13, under=2)
for (cx, cy, r, sd) in ((30, 30, 28, 1), (482, 30, 28, 2), (28, 480, 24, 3), (484, 480, 24, 4)):
    b += snow_pile(cx, cy, r, sd)
b += holly(52, 30, .95) + holly(460, 30, .95, flip=True)
render('ny-frost-frame', b, defs)
print('fi', [round(v / 512, 4) for v in O])
