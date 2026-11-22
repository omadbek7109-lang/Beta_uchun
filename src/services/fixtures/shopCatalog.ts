// GENERATED from supabase/migrations (shop_catalog, limited_stock, board_catalog_list, coin_packages, pricing_settings)
// on a scratch database — the main app's real catalog. Beta uses it as TEST data; nothing here is fetched from production.
export default {
 "catalog": {
  "categories": [
   {
    "id": "stones",
    "name_uz": "Toshlar",
    "name_en": "Stones"
   },
   {
    "id": "boards",
    "name_uz": "Doskalar",
    "name_en": "Boards"
   },
   {
    "id": "animations",
    "name_uz": "Animatsiyalar",
    "name_en": "Animations"
   },
   {
    "id": "frames",
    "name_uz": "Ramkalar",
    "name_en": "Frames"
   }
  ],
  "items": [
   {
    "slug": "midnight-blue",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Midnight Blue",
    "name_en": "Midnight Blue",
    "desc_uz": "Tungi ko'k marmar, oltin tomirlar.",
    "desc_en": "Night-blue marble with gold veins.",
    "rarity": "common",
    "price": 0,
    "final_price": 0,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "midnight-blue-d",
     "fi": [
      0.0762,
      0.1348,
      0.9238,
      0.9043
     ],
     "fr": "midnight-blue-frame",
     "hl": "#e8bb4d",
     "lt": "midnight-blue-l",
     "dark": "#1b2a48",
     "edge": "#2c3e66",
     "coord": "#c9d6f2",
     "edge2": "#d4a53c",
     "frame": "gold",
     "light": "#3d5f96"
    },
    "image_url": "boards/midnight-blue.webp",
    "owned": false
   },
   {
    "slug": "st-classic",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Classic Stone",
    "name_en": "Classic Stone",
    "desc_uz": "Klassik oq va qora toshlar.",
    "desc_en": "Classic white and black stones.",
    "rarity": "common",
    "price": 0,
    "final_price": 0,
    "discount_percent": 0,
    "is_free": true,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-classic-b",
      "ring": "rgba(150,160,180,.45)",
      "crown": "#e8bb4d"
     },
     "w": {
      "tex": "st-classic-w",
      "ring": "rgba(255,255,255,.55)",
      "crown": "#c9a227"
     }
    },
    "image_url": "stones/st-classic.webp",
    "owned": true
   },
   {
    "slug": "graphite",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Graphite",
    "name_en": "Graphite",
    "desc_uz": "Silliqlangan grafit va ko'k nur.",
    "desc_en": "Brushed graphite with a blue glow.",
    "rarity": "common",
    "price": 500,
    "final_price": 500,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "graphite-d",
     "fi": [
      0.084,
      0.1348,
      0.916,
      0.9004
     ],
     "fr": "graphite-frame",
     "hl": "#4ea3ff",
     "lt": "graphite-l",
     "dark": "#262a33",
     "edge": "#3a4252",
     "coord": "#c7cfdc",
     "edge2": "#4ea3ff",
     "frame": "metal",
     "light": "#5a6170"
    },
    "image_url": "boards/graphite.webp",
    "owned": false
   },
   {
    "slug": "st-royal-gold",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Royal Gold",
    "name_en": "Royal Gold",
    "desc_uz": "Oltin toj tushirilgan qirollik toshlari.",
    "desc_en": "Royal stones with a golden crown.",
    "rarity": "rare",
    "price": 500,
    "final_price": 500,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-royal-gold-b",
      "anim": "gleam",
      "ring": "#b8862b",
      "crown": "#ffd56b"
     },
     "w": {
      "tex": "st-royal-gold-w",
      "anim": "gleam",
      "ring": "#f3c24f",
      "crown": "#fff1c1"
     }
    },
    "image_url": "stones/st-royal-gold.webp",
    "owned": false
   },
   {
    "slug": "royal-wood",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Royal Wood",
    "name_en": "Royal Wood",
    "desc_uz": "Qimmatbaho yog'och va oltin naqsh.",
    "desc_en": "Fine wood with gilded carvings.",
    "rarity": "rare",
    "price": 1200,
    "final_price": 1200,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "royal-wood-d",
     "fi": [
      0.0801,
      0.1348,
      0.9121,
      0.9043
     ],
     "fr": "royal-wood-frame",
     "hl": "#f6c64f",
     "lt": "royal-wood-l",
     "dark": "#6b3b1c",
     "edge": "#5b3a1e",
     "coord": "#fff3dc",
     "edge2": "#c99a4b",
     "frame": "wood",
     "light": "#d9a35c"
    },
    "image_url": "boards/royal-wood.webp",
    "owned": false
   },
   {
    "slug": "st-obsidian",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Obsidian",
    "name_en": "Obsidian",
    "desc_uz": "Qora obsidian, oltin tomirlar.",
    "desc_en": "Black obsidian with golden veins.",
    "rarity": "rare",
    "price": 1200,
    "final_price": 1200,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-obsidian-b",
      "anim": "gleam",
      "ring": "#3a3530",
      "crown": "#ffb02e"
     },
     "w": {
      "tex": "st-obsidian-w",
      "anim": "gleam",
      "ring": "#d8dde8",
      "crown": "#ffb02e"
     }
    },
    "image_url": "stones/st-obsidian.webp",
    "owned": false
   },
   {
    "slug": "emerald-board",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Emerald",
    "name_en": "Emerald",
    "desc_uz": "Zumrad marmar, oltin ramka.",
    "desc_en": "Emerald marble in a gold frame.",
    "rarity": "rare",
    "price": 1800,
    "final_price": 1800,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "emerald-board-d",
     "fi": [
      0.0859,
      0.1387,
      0.9082,
      0.8965
     ],
     "fr": "emerald-board-frame",
     "hl": "#ffd54f",
     "lt": "emerald-board-l",
     "dark": "#123d22",
     "edge": "#14402a",
     "coord": "#e3f5e8",
     "edge2": "#d4a53c",
     "frame": "gold",
     "light": "#3f8a52"
    },
    "image_url": "boards/emerald-board.webp",
    "owned": false
   },
   {
    "slug": "st-sapphire",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Sapphire",
    "name_en": "Sapphire",
    "desc_uz": "Ko'k sapfir, kumush gardish.",
    "desc_en": "Blue sapphire in a silver rim.",
    "rarity": "epic",
    "price": 1800,
    "final_price": 1800,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-sapphire-b",
      "anim": "gleam",
      "ring": "#1b2f6b",
      "crown": "#cfe0ff"
     },
     "w": {
      "tex": "st-sapphire-w",
      "anim": "gleam",
      "glow": "rgba(80,140,255,.45)",
      "ring": "#e6ecf7",
      "crown": "#ffffff"
     }
    },
    "image_url": "stones/st-sapphire.webp",
    "owned": false
   },
   {
    "slug": "cyber-purple",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Cyber Purple",
    "name_en": "Cyber Purple",
    "desc_uz": "Binafsha neon chaqmoqlar.",
    "desc_en": "Purple neon lightning.",
    "rarity": "epic",
    "price": 2200,
    "final_price": 2200,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "cyber-purple-d",
     "fi": [
      0.0762,
      0.1348,
      0.9121,
      0.9004
     ],
     "fr": "cyber-purple-frame",
     "hl": "#c084fc",
     "lt": "cyber-purple-l",
     "dark": "#1d1830",
     "edge": "#7c3aed",
     "coord": "#e9ddff",
     "edge2": "#a855f7",
     "frame": "neon",
     "light": "#5a4a7a"
    },
    "image_url": "boards/cyber-purple.webp",
    "owned": false
   },
   {
    "slug": "st-emerald",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Emerald",
    "name_en": "Emerald",
    "desc_uz": "Zumrad, oltin gardish.",
    "desc_en": "Emerald in a golden rim.",
    "rarity": "epic",
    "price": 2200,
    "final_price": 2200,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-emerald-b",
      "anim": "gleam",
      "ring": "#0f3d24",
      "crown": "#ffd56b"
     },
     "w": {
      "tex": "st-emerald-w",
      "anim": "gleam",
      "glow": "rgba(40,200,120,.4)",
      "ring": "#f1e3b0",
      "crown": "#fff1c1"
     }
    },
    "image_url": "stones/st-emerald.webp",
    "owned": false
   },
   {
    "slug": "royal-marble",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Royal Marble",
    "name_en": "Royal Marble",
    "desc_uz": "Oq va qora marmar, oltin tomirlar.",
    "desc_en": "White and black marble, gold veins.",
    "rarity": "legendary",
    "price": 3000,
    "final_price": 3000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "royal-marble-d",
     "fi": [
      0.1152,
      0.1309,
      0.8887,
      0.9043
     ],
     "fr": "royal-marble-frame",
     "hl": "#f2c75c",
     "lt": "royal-marble-l",
     "dark": "#1c1c1e",
     "edge": "#b8862b",
     "coord": "#8a6a1f",
     "edge2": "#f2c75c",
     "frame": "gold",
     "light": "#efeeea"
    },
    "image_url": "boards/royal-marble.webp",
    "owned": false
   },
   {
    "slug": "st-ruby",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Ruby",
    "name_en": "Ruby",
    "desc_uz": "Yoqut, oltin gardish.",
    "desc_en": "Ruby in a golden rim.",
    "rarity": "legendary",
    "price": 3000,
    "final_price": 3000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-ruby-b",
      "anim": "gleam",
      "ring": "#4a0c18",
      "crown": "#ffd56b"
     },
     "w": {
      "tex": "st-ruby-w",
      "anim": "gleam",
      "glow": "rgba(255,60,90,.4)",
      "ring": "#f6d27a",
      "crown": "#fff1c1"
     }
    },
    "image_url": "stones/st-ruby.webp",
    "owned": false
   },
   {
    "slug": "obsidian-gold",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Obsidian Gold",
    "name_en": "Obsidian Gold",
    "desc_uz": "Qora obsidian va eritilgan oltin.",
    "desc_en": "Black obsidian and molten gold.",
    "rarity": "legendary",
    "price": 4000,
    "final_price": 4000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "obsidian-gold-d",
     "fi": [
      0.1035,
      0.1426,
      0.8965,
      0.873
     ],
     "fr": "obsidian-gold-frame",
     "hl": "#ffcc4d",
     "lt": "obsidian-gold-l",
     "dark": "#0c0b0a",
     "edge": "#2a2418",
     "glow": "rgba(240,180,41,.35)",
     "coord": "#f3d27a",
     "edge2": "#f0b429",
     "frame": "gold",
     "light": "#3a3530"
    },
    "image_url": "boards/obsidian-gold.webp",
    "owned": false
   },
   {
    "slug": "st-diamond",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Diamond",
    "name_en": "Diamond",
    "desc_uz": "Olmos qirralar, oltin gardish.",
    "desc_en": "Diamond facets in a golden rim.",
    "rarity": "legendary",
    "price": 4000,
    "final_price": 4000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-diamond-b",
      "anim": "gleam",
      "ring": "#5b6680",
      "crown": "#ffd56b"
     },
     "w": {
      "tex": "st-diamond-w",
      "anim": "gleam",
      "glow": "rgba(200,225,255,.5)",
      "ring": "#ffffff",
      "crown": "#e8bb4d"
     }
    },
    "image_url": "stones/st-diamond.webp",
    "owned": false
   },
   {
    "slug": "celestial-crown",
    "category_id": "boards",
    "slot": "board",
    "collection": "limited",
    "name_uz": "Celestial Crown",
    "name_en": "Celestial Crown",
    "desc_uz": "Samoviy ko'k marmar va kumush toj.",
    "desc_en": "Celestial blue marble, silver crown.",
    "rarity": "mythic",
    "price": 5000,
    "final_price": 5000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "dt": "celestial-crown-d",
     "fi": [
      0.1152,
      0.1855,
      0.8789,
      0.877
     ],
     "fr": "celestial-crown-frame",
     "hl": "#7aa2ff",
     "lt": "celestial-crown-l",
     "dark": "#13307a",
     "edge": "#c7cee0",
     "glow": "rgba(80,120,255,.45)",
     "coord": "#1d3d8f",
     "edge2": "#3b6cff",
     "frame": "metal",
     "light": "#eef1f8"
    },
    "image_url": "boards/celestial-crown.webp",
    "owned": false
   },
   {
    "slug": "st-celestial",
    "category_id": "stones",
    "slot": "piece",
    "collection": "stones",
    "name_uz": "Celestial",
    "name_en": "Celestial",
    "desc_uz": "Galaktika va oltin toj.",
    "desc_en": "A galaxy under a golden crown.",
    "rarity": "mythic",
    "price": 5000,
    "final_price": 5000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "b": {
      "tex": "st-celestial-b",
      "anim": "gleam",
      "ring": "#2a1d6b",
      "crown": "#ffd56b"
     },
     "w": {
      "tex": "st-celestial-w",
      "anim": "gleam",
      "glow": "rgba(140,110,255,.5)",
      "ring": "#f3c24f",
      "crown": "#fff1c1"
     }
    },
    "image_url": "stones/st-celestial.webp",
    "owned": false
   },
   {
    "slug": "fx-ripple",
    "category_id": "animations",
    "slot": "effect",
    "collection": "fx",
    "name_uz": "To'lqin",
    "name_en": "Ripple",
    "desc_uz": "Yurish qilingan katakdan to'lqin tarqaladi.",
    "desc_en": "A ripple spreads from the destination square.",
    "rarity": "common",
    "price": 5000,
    "final_price": 5000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "fx": "ripple",
     "color": "#4fc3f7"
    },
    "image_url": null,
    "owned": false
   },
   {
    "slug": "fx-sparkle",
    "category_id": "animations",
    "slot": "effect",
    "collection": "fx",
    "name_uz": "Uchqun",
    "name_en": "Sparkle",
    "desc_uz": "Yurishda oltin uchqunlar sachraydi.",
    "desc_en": "Golden sparkles burst on every move.",
    "rarity": "rare",
    "price": 8000,
    "final_price": 8000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "fx": "sparkle",
     "color": "#ffd54f"
    },
    "image_url": null,
    "owned": false
   },
   {
    "slug": "fx-fire",
    "category_id": "animations",
    "slot": "effect",
    "collection": "fx",
    "name_uz": "Olov izi",
    "name_en": "Fire trail",
    "desc_uz": "Yurish joyida alanga chaqnaydi.",
    "desc_en": "A flame flares on the landing square.",
    "rarity": "epic",
    "price": 15000,
    "final_price": 15000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "fx": "fire",
     "color": "#ff5722"
    },
    "image_url": null,
    "owned": false
   },
   {
    "slug": "fx-lightning",
    "category_id": "animations",
    "slot": "effect",
    "collection": "fx",
    "name_uz": "Chaqmoq",
    "name_en": "Lightning",
    "desc_uz": "Elektr chaqnashi va titrash.",
    "desc_en": "An electric flash with a jolt.",
    "rarity": "epic",
    "price": 15000,
    "final_price": 15000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "fx": "lightning",
     "color": "#80d8ff"
    },
    "image_url": null,
    "owned": false
   },
   {
    "slug": "fx-stardust",
    "category_id": "animations",
    "slot": "effect",
    "collection": "fx",
    "name_uz": "Yulduz changi",
    "name_en": "Stardust",
    "desc_uz": "Kosmik yulduz changi aylanib tushadi.",
    "desc_en": "Cosmic stardust swirls down.",
    "rarity": "legendary",
    "price": 25000,
    "final_price": 25000,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": false,
    "premium_only": false,
    "style": {
     "fx": "stardust",
     "color": "#b388ff"
    },
    "image_url": null,
    "owned": false
   },
   {
    "slug": "pass-violet",
    "category_id": "boards",
    "slot": "board",
    "collection": "pass",
    "name_uz": "Classic Violet Board",
    "name_en": "Classic Violet Board",
    "desc_uz": "DAMEO Pass · Season 01 bepul doskasi.",
    "desc_en": "DAMEO Pass · Season 01 free board.",
    "rarity": "rare",
    "price": 0,
    "final_price": 0,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": true,
    "premium_only": false,
    "style": {
     "dt": "pass-violet-d",
     "fi": [
      0.0704,
      0.0753,
      0.9341,
      0.9504
     ],
     "fr": "pass-violet-frame",
     "hl": "#e8bb4d",
     "lt": "pass-violet-l",
     "dark": "#2a1144",
     "edge": "#3a1a5c",
     "coord": "#eadcff",
     "edge2": "#c9a0ff",
     "frame": "gold",
     "light": "#ac63cd"
    },
    "image_url": "boards/pass-violet.webp",
    "owned": false
   },
   {
    "slug": "pass-royal-gold",
    "category_id": "boards",
    "slot": "board",
    "collection": "pass",
    "name_uz": "Royal Gold Board",
    "name_en": "Royal Gold Board",
    "desc_uz": "DAMEO Pass · Season 01 Premium doskasi: oltin ramka, toj.",
    "desc_en": "DAMEO Pass · Season 01 Premium board: gold frame and crown.",
    "rarity": "epic",
    "price": 0,
    "final_price": 0,
    "discount_percent": 0,
    "is_free": false,
    "is_default": false,
    "retired": true,
    "premium_only": false,
    "style": {
     "dt": "pass-royal-gold-d",
     "fi": [
      0.0832,
      0.1328,
      0.9159,
      0.8696
     ],
     "fr": "pass-royal-gold-frame",
     "hl": "#e8bb4d",
     "lt": "pass-royal-gold-l",
     "dark": "#150b24",
     "edge": "#4a2a10",
     "coord": "#eadcff",
     "edge2": "#d4a53c",
     "frame": "gold",
     "light": "#972dc9"
    },
    "image_url": "boards/pass-royal-gold.webp",
    "owned": false
   }
  ],
  "equipped": {
   "piece": null,
   "board": null,
   "effect": null
  }
 },
 "stones": [
  {
   "slug": "st-emerald",
   "tier": 5,
   "icon": "💚",
   "supply": 200,
   "sold": 0,
   "name_uz": "Emerald",
   "name_en": "Emerald",
   "rarity": "epic",
   "image_url": "stones/st-emerald.webp",
   "remaining": 200,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "st-ruby",
   "tier": 6,
   "icon": "❤️",
   "supply": 100,
   "sold": 0,
   "name_uz": "Ruby",
   "name_en": "Ruby",
   "rarity": "legendary",
   "image_url": "stones/st-ruby.webp",
   "remaining": 100,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "st-diamond",
   "tier": 7,
   "icon": "💎",
   "supply": 80,
   "sold": 0,
   "name_uz": "Diamond",
   "name_en": "Diamond",
   "rarity": "legendary",
   "image_url": "stones/st-diamond.webp",
   "remaining": 80,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "st-celestial",
   "tier": 8,
   "icon": "👑",
   "supply": 30,
   "sold": 0,
   "name_uz": "Celestial",
   "name_en": "Celestial",
   "rarity": "mythic",
   "image_url": "stones/st-celestial.webp",
   "remaining": 30,
   "sold_out": false,
   "mine": null
  }
 ],
 "boards": [
  {
   "slug": "midnight-blue",
   "tier": 1,
   "icon": "🌙",
   "supply": null,
   "sold": 0,
   "name_uz": "Midnight Blue",
   "name_en": "Midnight Blue",
   "rarity": "common",
   "image_url": "boards/midnight-blue.webp",
   "remaining": null,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "graphite",
   "tier": 2,
   "icon": "⚙️",
   "supply": null,
   "sold": 0,
   "name_uz": "Graphite",
   "name_en": "Graphite",
   "rarity": "common",
   "image_url": "boards/graphite.webp",
   "remaining": null,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "royal-wood",
   "tier": 3,
   "icon": "🪵",
   "supply": null,
   "sold": 0,
   "name_uz": "Royal Wood",
   "name_en": "Royal Wood",
   "rarity": "rare",
   "image_url": "boards/royal-wood.webp",
   "remaining": null,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "emerald-board",
   "tier": 4,
   "icon": "💚",
   "supply": null,
   "sold": 0,
   "name_uz": "Emerald",
   "name_en": "Emerald",
   "rarity": "rare",
   "image_url": "boards/emerald-board.webp",
   "remaining": null,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "cyber-purple",
   "tier": 5,
   "icon": "⚡",
   "supply": 200,
   "sold": 0,
   "name_uz": "Cyber Purple",
   "name_en": "Cyber Purple",
   "rarity": "epic",
   "image_url": "boards/cyber-purple.webp",
   "remaining": 200,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "royal-marble",
   "tier": 6,
   "icon": "🏆",
   "supply": 100,
   "sold": 0,
   "name_uz": "Royal Marble",
   "name_en": "Royal Marble",
   "rarity": "legendary",
   "image_url": "boards/royal-marble.webp",
   "remaining": 100,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "obsidian-gold",
   "tier": 7,
   "icon": "💎",
   "supply": 80,
   "sold": 0,
   "name_uz": "Obsidian Gold",
   "name_en": "Obsidian Gold",
   "rarity": "legendary",
   "image_url": "boards/obsidian-gold.webp",
   "remaining": 80,
   "sold_out": false,
   "mine": null
  },
  {
   "slug": "celestial-crown",
   "tier": 8,
   "icon": "👑",
   "supply": 30,
   "sold": 0,
   "name_uz": "Celestial Crown",
   "name_en": "Celestial Crown",
   "rarity": "mythic",
   "image_url": "boards/celestial-crown.webp",
   "remaining": 30,
   "sold_out": false,
   "mine": null
  }
 ],
 "packages": [
  {
   "id": "coins_500",
   "coins": 500,
   "bonus_coins": 0,
   "stars": 13,
   "active": true,
   "sort": 1,
   "stars_manual": false
  },
  {
   "id": "coins_1k",
   "coins": 1000,
   "bonus_coins": 0,
   "stars": 25,
   "active": true,
   "sort": 2,
   "stars_manual": false
  },
  {
   "id": "coins_1200",
   "coins": 1200,
   "bonus_coins": 0,
   "stars": 30,
   "active": true,
   "sort": 3,
   "stars_manual": false
  },
  {
   "id": "coins_1800",
   "coins": 1800,
   "bonus_coins": 0,
   "stars": 45,
   "active": true,
   "sort": 4,
   "stars_manual": false
  },
  {
   "id": "coins_2200",
   "coins": 2200,
   "bonus_coins": 0,
   "stars": 55,
   "active": true,
   "sort": 5,
   "stars_manual": false
  },
  {
   "id": "coins_3k",
   "coins": 3000,
   "bonus_coins": 0,
   "stars": 75,
   "active": true,
   "sort": 6,
   "stars_manual": false
  },
  {
   "id": "coins_4k",
   "coins": 4000,
   "bonus_coins": 0,
   "stars": 100,
   "active": true,
   "sort": 7,
   "stars_manual": false
  },
  {
   "id": "coins_5k",
   "coins": 5000,
   "bonus_coins": 0,
   "stars": 125,
   "active": true,
   "sort": 8,
   "stars_manual": false
  }
 ],
 "pricing": {
  "stars_per_1000": 25.0,
  "som_per_coin": 10.0
 }
};
