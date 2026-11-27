# Winter City map spots

`public/town/markaz.webp` is the painted master map (1672×941). Build spots in `src/services/city/mapSlots.ts`
were found automatically:

1. Sample the plot colour around the white "+" marks, keep pixels close to it with low local texture → plot mask.
2. `slots.py`: inside the plot mask, place spots greedily with perspective spacing (46×26 px at the front, smaller
   at the back: `spotScale`), farthest from the plot edges first.
3. Sector = 8 radial directions × inner/outer half → 16 districts.

For a new or upscaled map run the same steps and regenerate `mapSlots.ts` (coordinates are in map pixels).
