import sys; sys.path.insert(0, '/home/claude/work')
from PIL import Image
from compose import board
from face import face
R = '/home/claude/beta_uchun/public'
for b in ('frost', 'ice', 'aurora'):
    full = board(b).convert('RGB')
    full.resize((512, 512), Image.LANCZOS).save(f'{R}/boards/ny-{b}.webp', 'WEBP', quality=86, method=6)
    full.resize((256, 256), Image.LANCZOS).save(f'{R}/boards/ny-{b}-sm.webp', 'WEBP', quality=84, method=6)
    Image.open(f'/home/claude/work/frames/ny-{b}-frame@2x.png').convert('RGBA').resize((512, 512), Image.LANCZOS).save(f'{R}/boards/ny-{b}-frame.webp', 'WEBP', quality=88, method=6)
    for s in 'ld':
        Image.open(f'/home/claude/work/tile-{b}-{s}.png').resize((128, 128), Image.LANCZOS).save(f'{R}/boards/ny-{b}-{s}.webp', 'WEBP', quality=86, method=6)
import shutil
shutil.copy('/home/claude/work/out-ny-snow-far.webp', f'{R}/boards/ny-snow-far.webp')
shutil.copy('/home/claude/work/out-ny-snow-near.webp', f'{R}/boards/ny-snow-near.webp')
F = {
    'ny-snow-stone-w': face('/home/claude/work/src/pieces_light.png', 494, 364, 251, 133),
    'ny-snow-stone-b': face('/home/claude/work/src/pieces_dark.png', 498, 345, 262, 145),
    'ny-gift-stone-w': face('/home/claude/work/src/pieces_light.png', 1181, 367, 257, 137),
    'ny-gift-stone-b': face('/home/claude/work/src/pieces_dark.png', 1291, 352, 263, 147),
}
for k, im in F.items():
    im.save(f'{R}/stones/{k}.webp', 'WEBP', quality=88, method=6)
# set previews (480x293, like the other stone sets): the two faces on the app's night-purple backdrop
from PIL import ImageDraw, ImageFilter
for s in ('ny-snow-stone', 'ny-gift-stone'):
    bg = Image.new('RGBA', (480, 293), (0, 0, 0, 255))
    px = bg.load()
    for y in range(293):
        for x in range(480):
            t = y / 293; u = abs(x - 240) / 240
            px[x, y] = (int(28 - 10 * t), int(16 - 6 * t), int(62 - 24 * t + 20 * (1 - u)), 255)
    for i, side in enumerate('wb'):
        f = F[f'{s}-{side}'].resize((176, 176), Image.LANCZOS)
        cx = 150 + i * 180; cy = 146
        sh = Image.new('RGBA', bg.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse((cx - 86, cy - 74, cx + 86, cy + 98), fill=(0, 0, 0, 150))
        bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
        bg.alpha_composite(f, (cx - 88, cy - 88))
    bg.convert('RGB').save(f'{R}/stones/{s}.webp', 'WEBP', quality=86, method=6)
print('ok')
