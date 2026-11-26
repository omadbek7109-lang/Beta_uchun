from frames import *
O = (56, 72, 456, 472)
defs = '''
<linearGradient id="purp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a2aa8"/><stop offset=".5" stop-color="#3a1680"/><stop offset="1" stop-color="#220a52"/></linearGradient>
<radialGradient id="shGloss" cx=".35" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="crys" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f8ff" stop-opacity=".95"/><stop offset=".45" stop-color="#7cc8ff" stop-opacity=".85"/><stop offset="1" stop-color="#2b6fe0" stop-opacity=".8"/></linearGradient>
<pattern id="damask" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12 3 l4 9 -4 9 -4 -9z" fill="#ffffff" opacity=".06"/><circle cx="0" cy="0" r="2" fill="#ffd772" opacity=".12"/><circle cx="24" cy="24" r="2" fill="#ffd772" opacity=".12"/></pattern>
'''
b = f'<path fill-rule="evenodd" d="{rr(14, 26, 498, 504, 26)} {rr(O[0]+14, O[1]+14, O[2]-14, O[3]-14, 6)}" fill="#05030f" opacity=".65" filter="url(#blur8)"/>'
# outer gold rim
b += ring((16, 24, 496, 496, 24), (O[0], O[1], O[2], O[3], 6)) + ' fill="url(#gold)" stroke="#5a3606" stroke-width="2"/>'
# purple panel band
b += ring((23, 31, 489, 489, 19), (O[0]-7, O[1]-7, O[2]+7, O[3]+7, 9)) + ' fill="url(#purp)"/>'
b += ring((23, 31, 489, 489, 19), (O[0]-7, O[1]-7, O[2]+7, O[3]+7, 9)) + ' fill="url(#damask)"/>'
b += f'<path d="{rr(23, 31, 489, 489, 19)}" fill="none" stroke="#fff1b8" stroke-opacity=".7" stroke-width="1.2"/>'
# gold filigree lines on the band
b += f'<path d="{rr(30, 38, 482, 482, 15)}" fill="none" stroke="url(#gold)" stroke-width="1.4" stroke-dasharray="10 4 2 4" opacity=".85"/>'
# inner gold rim + icy lip
b += f'<path d="{rr(O[0]-5, O[1]-5, O[2]+5, O[3]+5, 9)}" fill="none" stroke="url(#gold)" stroke-width="5"/>'
b += f'<path d="{rr(O[0]-2, O[1]-2, O[2]+2, O[3]+2, 7)}" fill="none" stroke="#69b8ff" stroke-width="4" filter="url(#blur2)"/>'
b += f'<path d="{rr(O[0]-1.5, O[1]-1.5, O[2]+1.5, O[3]+1.5, 7)}" fill="none" stroke="#d8efff" stroke-width="1.3"/>'
# side shields with gold snowflakes
for (cx, cy) in ((36, 272), (476, 272)):
    b += shield(cx, cy, 32, inner=flake(cx, cy - 2, 10, '#ffd772', 1.8))
b += shield(256, 488, 40, inner=crown(256, 485, 25, gem='#b07cff'))
# corner ice crystals + lanterns
b += crystal(26, 50, 1.25, 1) + crystal(486, 50, 1.25, 2, -1)
b += crystal(26, 490, 1.0, 3) + crystal(486, 490, 1.0, 4, -1)
b += lantern(128, 46, 1.0, metal='#5a3606', light='#ffe08a') + lantern(384, 46, 1.0, metal='#5a3606', light='#ffe08a')
b += lantern(150, 488, .85, metal='#5a3606', light='#ffe08a') + lantern(362, 488, .85, metal='#5a3606', light='#ffe08a')
# snow on the top band and on the crystals
b += snow_cap(56, 214, 21, 12, 51, under=3) + snow_cap(298, 456, 21, 12, 52, under=3)
b += icicles(150, 214, 33, 53, maxlen=11, minlen=4, dens=10) + icicles(298, 362, 33, 54, maxlen=11, minlen=4, dens=10)
b += snow_pile(44, 34, 14, 55) + snow_pile(468, 34, 14, 56)
b += icicles(40, 472, 496, 57, maxlen=14, minlen=5, dens=9, glow=True)
# top: purple shield with a snowflake under a jewelled crown
b += f'<circle cx="256" cy="44" r="52" fill="url(#cold)" opacity=".5"/>'
b += shield(256, 47, 38, inner=f'<g filter="url(#blur2)">{flake(256, 45, 11, "#7cc8ff", 3)}</g>' + flake(256, 45, 11, '#ffffff', 1.8))
b += crown(256, 21, 46, gem='#b07cff')
render('ny-aurora-frame', b, defs)
print('fi', [round(v / 512, 4) for v in O])
