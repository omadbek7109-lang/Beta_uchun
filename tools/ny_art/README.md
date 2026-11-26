# New Year collection art (DAMEO Pass season 2 concepts)

Generates `public/boards/ny-*` and `public/stones/ny-*` from the owner's concept images.

- `frame_frost.py`, `frame_ice.py`, `frame_aurora.py` — board frames drawn as SVG (helpers in `frames.py`), rendered with `rsvg-convert`; the opening (`fi`) is printed.
- `mk_tiles.py` (+ `tex.py`) — ice square textures; `snowtile.py` — the falling-snow tiles.
- `face.py` — stone faces: the top of each concept stone, unwarped to a circle.
- `export.py` — writes the final WebP files (board previews, frames, tiles, stone faces and set previews).

The scripts expect the concept images in `/home/claude/work/src/`
(`pieces_light.png`, `pieces_dark.png`, `board_frost.png`, `board_ice.png`, `board_aurora.png`) and write to `/home/claude/work/`; adjust the paths when running elsewhere.
Order: frames → tiles → snow → `export.py`.
