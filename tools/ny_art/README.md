# New Year collection art (DAMEO Pass season 2)

Generates the New Year assets in `public/boards/ny-*`, `public/stones/ny-*` and `public/pass/frame-ny-*`
from the owner's concept images (expected in `/home/claude/work/src/`; adjust the paths when running elsewhere).

- `board2.py` — the three boards from the owner's top-down art (`boards2.png`, `board_aurora2.png`): the frame with a
  transparent opening (made square in pixels), light / dark square textures cut from the art, shop previews. Prints `fi`.
- `snowtile.py` — the falling-snow tiles (`ny-snow-far`, `ny-snow-near`).
- `face.py` + `export.py` — stone faces (the top of each concept stone, unwarped to a circle) and the set previews.
- `avf.py` + `avhole.py` — the six avatar frames cut from the "Yangi Yil Ramkalari" sheet, and their hole masks / fits.
- `av2.py` — the two Limited avatar frames (Qirollik, Bo'ron) from their own pictures, with hole masks / fits.
