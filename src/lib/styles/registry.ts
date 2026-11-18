// Style registry: featured Studio AI styles + the Lemo-Opuscar catalogue rendered by Studio AI's own engine.
import { FEATURED_STYLES } from './featured';
import { LEMO_CATALOG } from './lemo-catalog';
import { NO_POST, type Background, type Motif, type PostFx, type StyleDef, type TextTreatment } from './types';

type Row = [Background, Motif, TextTreatment, [string, string, string], string, string, string, string, Partial<PostFx>?, number?];

const F = { sans: 'Inter', grot: 'Space Grotesk', serif: 'Playfair Display', disp: 'Bebas Neue', hand: 'Caveat', pix: 'Press Start 2P', mont: 'Montserrat', osw: 'Oswald', black: 'Archivo Black', mono: 'IBM Plex Mono', dserif: 'DM Serif Display', round: 'Fredoka', roman: 'Cinzel', term: 'VT323' };

const CAT_DEFAULT: Record<string, Row> = {
  'Edit & Documentary': ['contour', 'lines', 'serif', ['#17191b', '#202326', '#2a2e33'], '#f0ece4', '#e0b04f', '#7fb3c8', F.dserif, { grain: 0.25, vignette: 0.35 }],
  'Painting & Illustration': ['paper', 'brush', 'handwritten', ['#f3ead8', '#ecdfc6', '#e2d2b2'], '#3a2e27', '#b5543c', '#4a7c9b', F.hand, { grain: 0.25, vignette: 0.25 }],
  'Sketch & Board': ['whiteboard', 'doodles', 'handwritten', ['#fafaf7', '#f1f1ec', '#e6e6e0'], '#1d1d20', '#e63946', '#1d70b8', F.hand, { vignette: 0.12 }],
  'Traditional Crafts': ['papercut', 'waves', 'serif', ['#f4e9d8', '#e9c9a1', '#c97c5d'], '#2e1f16', '#b23a48', '#2f6f73', F.serif, { grain: 0.2, vignette: 0.25 }],
  'Print & Printmaking': ['halftone', 'shapes', 'stamp', ['#f1e8d6', '#e6d9bf', '#d8c6a3'], '#1f1b18', '#d1495b', '#00798c', F.black, { grain: 0.35, vignette: 0.2 }],
  'Graphic & Type': ['swiss', 'shapes', 'clean', ['#f2f0ea', '#e7e4dc', '#d9d5ca'], '#111111', '#ff4d00', '#1a4dff', F.black, { grain: 0.08 }],
  'Line Diagrams': ['blueprint', 'lines', 'mono', ['#0b3a66', '#0e4377', '#124d88'], '#e8f1fb', '#ffd166', '#9ad1ff', F.grot, { vignette: 0.25 }],
  'Cartoons': ['sunburst', 'shapes', 'bold-shadow', ['#fde9c9', '#f9d29b', '#f5bb6e'], '#2a211c', '#e4572e', '#29a19c', F.round, { grain: 0.2 }, 12],
  'Games': ['pixel', 'sprites', 'pixel', ['#2b2d6e', '#4a4fb5', '#8a8ff0'], '#ffffff', '#ffd23f', '#ee4266', F.pix, { pixelate: 4 }, 10],
  'Film & Tape': ['film', 'none', 'serif', ['#1f1a14', '#2c251c', '#3a3125'], '#efe4cc', '#d9b26f', '#8c3b2a', F.roman, { grain: 0.55, sepia: 0.6, flicker: 0.4, vignette: 0.55 }, 16],
  'Screens & Interfaces': ['grid-dark', 'scan', 'mono', ['#06080d', '#0c111a', '#121a27'], '#e6f0ff', '#7c5cff', '#2ee6a6', F.grot, { vignette: 0.3, bloom: 0.25 }],
  'Light & Lines': ['stars', 'lines', 'neon', ['#04040a', '#0a0a18', '#111128'], '#f4f4ff', '#ff3cac', '#2bd2ff', F.osw, { bloom: 0.6, vignette: 0.35 }],
  '3D & Miniature': ['iso', 'blocks', 'bold-shadow', ['#eef1fb', '#dde3f7', '#c9d2f1'], '#1f1d47', '#5b5bf0', '#ff8a5b', F.mont, { vignette: 0.15 }],
  'Instruments & Evidence': ['hud', 'scan', 'mono', ['#020806', '#04120c', '#071c13'], '#d8ffe9', '#39ff88', '#ffcc33', F.mono, { scanlines: 0.2, bloom: 0.3, vignette: 0.4 }],
  'Data & Maps': ['data', 'chart', 'clean', ['#f6f5f1', '#ecebe5', '#dfded6'], '#16181d', '#e4572e', '#2e86ab', F.grot, {}],
};

// Per-style overrides so each catalogue entry gets its own look.
const OVR: Record<string, Row> = {
  'archive-lighttable': ['paper', 'lines', 'serif', ['#e8e2d3', '#d8cfb9', '#c6b996'], '#2a241c', '#a4462f', '#456b7a', F.dserif, { grain: 0.3, vignette: 0.4, sepia: 0.3 }],
  'art-deco': ['luxury', 'rays', 'gold', ['#0b1a1e', '#10262b', '#173238'], '#f3e6c4', '#d4af37', '#2f8f83', F.roman, { vignette: 0.4, bloom: 0.2 }],
  'ascii-crt': ['crt', 'scan', 'mono', ['#010a02', '#021205', '#031a08'], '#5dff7a', '#5dff7a', '#c3ffd0', F.term, { scanlines: 0.6, bloom: 0.6, chromatic: 0.2, vignette: 0.5 }],
  'assembly-line-diagram': ['whiteboard', 'lines', 'mono', ['#fbfbf8', '#f2f2ed', '#e8e8e1'], '#1b1f24', '#ef476f', '#118ab2', F.grot, {}],
  'backrooms': ['film', 'none', 'mono', ['#8f8546', '#a39a58', '#b5ac6a'], '#1b1a0f', '#2b2a19', '#d8d07d', F.mono, { grain: 0.6, chromatic: 0.3, scanlines: 0.3, vignette: 0.5, flicker: 0.3 }],
  'bauhaus-shapes': ['swiss', 'shapes', 'clean', ['#f1ece1', '#e8e0cf', '#ddd2bb'], '#1a1a1a', '#d62828', '#003f88', F.black, { grain: 0.1 }],
  'brick-toy': ['iso', 'blocks', 'bold-shadow', ['#d9f0ff', '#bde4ff', '#9fd6ff'], '#102a43', '#ff3b30', '#ffcc00', F.round, { saturation: 1.15 }],
  'briefing-board': ['blueprint', 'lines', 'mono', ['#1e2a2f', '#25343a', '#2d3f46'], '#e9f1f2', '#ff9f1c', '#2ec4b6', F.grot, { vignette: 0.3 }],
  'caption-news': ['cinematic', 'lines', 'clean', ['#101214', '#181b1f', '#22262b'], '#ffffff', '#ffd400', '#ff3b3b', F.black, { vignette: 0.3 }],
  'chalkboard': ['chalkboard', 'doodles', 'handwritten', ['#1f3b2f', '#244536', '#2a4f3e'], '#f2f2ea', '#ffd166', '#ff8fa3', F.hand, { grain: 0.25, vignette: 0.35 }],
  'circuit-board': ['grid-dark', 'lines', 'mono', ['#03140c', '#062216', '#0a2f1f'], '#d7ffe9', '#ffb000', '#34d399', F.mono, { bloom: 0.5, vignette: 0.35 }],
  'city-symphony': ['cinematic', 'lines', 'clean', ['#0e0f12', '#17191e', '#20232a'], '#f5f5f5', '#ff5a36', '#ffd23f', F.disp, { grain: 0.3, vignette: 0.3, contrast: 1.1 }],
  'colored-pencil': ['paper', 'doodles', 'handwritten', ['#f7f1e3', '#efe5cf', '#e5d6b8'], '#3c3226', '#e07a5f', '#3d85c6', F.hand, { grain: 0.3 }],
  'comic-history': ['halftone', 'shapes', 'bold-shadow', ['#f9eed3', '#f3dfb2', '#ecce8e'], '#1d1a16', '#d7263d', '#1b998b', F.black, { grain: 0.2 }],
  'countdown': ['grid-dark', 'bars', 'mono', ['#050608', '#0b0d12', '#12151c'], '#ffffff', '#ff3d3d', '#ffffff', F.disp, { vignette: 0.3 }],
  'crayon-book': ['paper', 'doodles', 'handwritten', ['#fff8e7', '#fdefcf', '#f9e3b3'], '#2f2a24', '#f25f5c', '#247ba0', F.hand, { grain: 0.35 }, 12],
  'crayon-world': ['clay', 'blobs', 'handwritten', ['#fff1d6', '#ffe0ad', '#ffcf85'], '#3a2a1e', '#ef476f', '#06d6a0', F.hand, { grain: 0.3 }, 12],
  'dark-documentary': ['hud', 'orbits', 'mono', ['#020604', '#041009', '#06180e'], '#cfffe0', '#38ff7a', '#e0c341', F.mono, { scanlines: 0.15, bloom: 0.4, vignette: 0.45 }],
  'data-physical': ['clay', 'chart', 'clean', ['#efe7dc', '#e3d7c6', '#d4c3ab'], '#2b2219', '#c8553d', '#2f6690', F.grot, { vignette: 0.2 }],
  'desktop-flythrough': ['glass', 'blocks', 'clean', ['#0d0f14', '#151923', '#1d2331'], '#f5f7ff', '#5b8cff', '#ff7ab6', F.grot, { vignette: 0.3, bloom: 0.2 }],
  'double-exposure': ['cinematic', 'bokeh', 'serif', ['#0f1012', '#1a1b1f', '#26272d'], '#f8f5ee', '#f4a261', '#8ecae6', F.serif, { grain: 0.3, vignette: 0.45 }],
  'engraving': ['paper', 'lines', 'serif', ['#efe6d2', '#e3d6bb', '#d4c3a0'], '#1f1a14', '#7a2e1f', '#2e4a62', F.roman, { grain: 0.3, sepia: 0.3 }],
  'firefly-pointillism': ['stars', 'particles', 'serif', ['#03050f', '#070b1f', '#0b1130'], '#fff7d6', '#ffd166', '#9be7ff', F.serif, { bloom: 0.7 }],
  'flat-space-explainer': ['stars', 'orbits', 'clean', ['#0b0d2a', '#14184a', '#1e2366'], '#ffffff', '#ffb703', '#8ecae6', F.mont, {}],
  'flow-field': ['data', 'waves', 'clean', ['#0b1220', '#101a2e', '#16233d'], '#e8f1ff', '#ff7b54', '#5ec8ff', F.grot, { bloom: 0.3 }],
  'game-show': ['sunburst', 'confetti', 'bold-shadow', ['#2b0f54', '#4b148a', '#7a1fc2'], '#ffffff', '#ffd60a', '#ff4d6d', F.black, { bloom: 0.3 }],
  'gilded-illumination': ['luxury', 'rays', 'gold', ['#1f0f14', '#2c1520', '#3b1c2b'], '#f6e7c1', '#d4af37', '#1f6f8b', F.roman, { grain: 0.2, vignette: 0.4 }],
  'glass-product': ['glass', 'bokeh', 'clean', ['#08090c', '#101218', '#181b24'], '#ffffff', '#9ad0ff', '#ffb3c7', F.grot, { bloom: 0.5, vignette: 0.4 }],
  'halftone-dossier': ['halftone', 'shapes', 'stamp', ['#f5ecd9', '#ecdcbd', '#e0c99c'], '#1a1714', '#e63946', '#1d3557', F.black, { grain: 0.3 }],
  'hardcore-info': ['whiteboard', 'lines', 'mono', ['#fbfbf9', '#f1f1ed', '#e6e6e1'], '#111418', '#ff5400', '#0077b6', F.grot, {}],
  'hd-2d': ['pixel', 'sprites', 'pixel', ['#1b2a4a', '#355c7d', '#6c8fb3'], '#ffffff', '#ffd166', '#f78c6b', F.pix, { pixelate: 3, bloom: 0.4, tiltShift: 0.5 }, 12],
  'hologram-hud': ['hud', 'orbits', 'mono', ['#010810', '#03121e', '#051c2e'], '#d6faff', '#2de2ff', '#ff4fd8', F.grot, { bloom: 0.6, scanlines: 0.15, chromatic: 0.2 }],
  'impasto': ['paper', 'brush', 'serif', ['#2b1d14', '#3d2a1c', '#4f3824'], '#f7e7c6', '#f2a541', '#3a86a8', F.serif, { grain: 0.4, vignette: 0.4, saturation: 1.1 }],
  'ink-wash': ['paper', 'brush', 'serif', ['#f1ede4', '#e6e0d3', '#d8d0bf'], '#111111', '#b22222', '#4a4a4a', F.serif, { grain: 0.25, saturation: 0.6 }],
  'instruction-manual': ['whiteboard', 'lines', 'clean', ['#ffffff', '#f6f6f6', '#ececec'], '#121212', '#0060df', '#121212', F.grot, {}],
  'iso-infographic': ['iso', 'blocks', 'clean', ['#f4f7fb', '#e6edf6', '#d6e1ef'], '#14213d', '#fca311', '#3a86ff', F.mont, {}],
  'isometric-picture-book': ['iso', 'blocks', 'bold-shadow', ['#fff4e6', '#ffe8cc', '#ffd8a8'], '#3b2f2f', '#e8590c', '#1c7ed6', F.round, {}],
  'kino-montage': ['halftone', 'bars', 'stamp', ['#efe4d0', '#e0d1b5', '#cfbb96'], '#111111', '#c1121f', '#111111', F.black, { grain: 0.4, contrast: 1.2, saturation: 0.7 }],
  'lidar-survey': ['stars', 'particles', 'mono', ['#000000', '#05070a', '#0a0e14'], '#e6f7ff', '#00e5ff', '#ff6d00', F.mono, { bloom: 0.5 }],
  'lowpoly-island': ['iso', 'waves', 'bold-shadow', ['#a8dadc', '#8ecae6', '#61a5c2'], '#1d3557', '#f4a261', '#2a9d8f', F.round, { saturation: 1.1 }],
  'manga-panels': ['halftone', 'lines', 'outline', ['#ffffff', '#f2f2f2', '#e5e5e5'], '#0a0a0a', '#e63946', '#0a0a0a', F.black, { contrast: 1.15, saturation: 0.2 }],
  'map-explainer': ['contour', 'lines', 'clean', ['#0f1b24', '#132430', '#182e3c'], '#eef6fa', '#ff9f1c', '#4dd0e1', F.grot, { vignette: 0.3 }],
  'marker-paper': ['paper', 'doodles', 'handwritten', ['#fffdf6', '#fbf6e8', '#f4edd8'], '#202020', '#e4572e', '#17bebb', F.hand, { grain: 0.15 }],
  'memphis-diorama': ['clay', 'confetti', 'bold-shadow', ['#ffe5ec', '#ffc2d1', '#ffb3c6'], '#1b1b3a', '#ffd60a', '#3a86ff', F.round, {}],
  'microgame': ['sunburst', 'confetti', 'bold-shadow', ['#ff006e', '#fb5607', '#ffbe0b'], '#ffffff', '#3a86ff', '#8338ec', F.black, {}, 12],
  'microscope': ['cinematic', 'blobs', 'mono', ['#04110d', '#082019', '#0d2f25'], '#e9fff7', '#ff4fa3', '#7dffcf', F.mono, { bloom: 0.4, vignette: 0.6 }],
  'neon-tubes': ['neon-city', 'lines', 'neon', ['#06040c', '#0d0818', '#160d26'], '#ffffff', '#ff2e88', '#00f0ff', F.osw, { bloom: 0.8, vignette: 0.4 }],
  'news-package': ['grid-dark', 'bars', 'clean', ['#0a1630', '#0e1d3f', '#13264f'], '#ffffff', '#e10600', '#ffffff', F.black, { vignette: 0.2 }],
  'newsreel': ['film', 'none', 'serif', ['#1c1c1c', '#2a2a2a', '#383838'], '#f2f2f2', '#dcdcdc', '#a0a0a0', F.roman, { grain: 0.6, sepia: 0.15, flicker: 0.5, vignette: 0.6, saturation: 0 }, 16],
  'one-bit-dither': ['halftone', 'shapes', 'pixel', ['#0c0c0c', '#121212', '#1a1a1a'], '#f0f0f0', '#f0f0f0', '#8a8a8a', F.term, { saturation: 0, contrast: 1.4, pixelate: 2 }],
  'one-line': ['whiteboard', 'lines', 'serif', ['#fbf8f2', '#f4efe5', '#ece4d5'], '#141414', '#c44536', '#141414', F.serif, {}],
  'oscilloscope-math': ['crt', 'waves', 'mono', ['#010a05', '#021408', '#031e0c'], '#76ff9f', '#76ff9f', '#ffe066', F.mono, { bloom: 0.7, scanlines: 0.3, vignette: 0.5 }],
  'paper-lantern': ['papercut', 'particles', 'serif', ['#1c0f1f', '#2e1734', '#ff9f43'], '#fff3dc', '#ffb84d', '#e84855', F.serif, { bloom: 0.5, vignette: 0.4 }],
  'paper-popup': ['papercut', 'blocks', 'bold-shadow', ['#fff6e5', '#ffe3b8', '#ffc98b'], '#3b2a1a', '#e76f51', '#2a9d8f', F.round, { vignette: 0.25 }],
  'papercut-red': ['papercut', 'waves', 'serif', ['#b3001b', '#c8102e', '#e03045'], '#fff1e0', '#ffd166', '#fff1e0', F.serif, { grain: 0.2 }],
  'pen-plotter': ['paper', 'lines', 'mono', ['#fbfaf6', '#f3f1ea', '#e9e6dc'], '#1a1a2e', '#e94560', '#0f3460', F.mono, {}],
  'pictogram-motion': ['swiss', 'shapes', 'clean', ['#ffcc00', '#ffd633', '#ffe066'], '#111111', '#111111', '#ffffff', F.black, {}],
  'pip-simulation': ['data', 'blobs', 'clean', ['#f7f7f2', '#ecece4', '#e0e0d5'], '#1b1b1e', '#ff595e', '#1982c4', F.grot, {}],
  'pop-art': ['halftone', 'rays', 'bold-shadow', ['#ffde00', '#ffe94d', '#fff27a'], '#111111', '#ff0054', '#00b4d8', F.black, { saturation: 1.3, contrast: 1.1 }],
  'precise-mechanism': ['blueprint', 'orbits', 'mono', ['#f3f5f8', '#e7ebf1', '#d9dfe8'], '#14213d', '#ef233c', '#2b9348', F.grot, {}],
  'printed-long-take': ['paper', 'lines', 'serif', ['#141414', '#1c1c1c', '#242424'], '#f1ede3', '#d9a441', '#f1ede3', F.serif, { grain: 0.3, contrast: 1.2, saturation: 0.3 }],
  'risograph': ['halftone', 'shapes', 'stamp', ['#f6efe4', '#efe3d0', '#e7d6bc'], '#22223b', '#ff48b0', '#0078bf', F.black, { grain: 0.45 }],
  'rubber-hose': ['film', 'shapes', 'bold-shadow', ['#e9dcc0', '#dccca9', '#cfbb92'], '#151515', '#151515', '#7a5c3a', F.round, { grain: 0.5, sepia: 0.4, flicker: 0.3, vignette: 0.5, saturation: 0.2 }, 12],
  'satellite-briefing': ['contour', 'scan', 'mono', ['#050b12', '#0a1520', '#0f1f2e'], '#e5f3ff', '#ffb703', '#00d1ff', F.mono, { vignette: 0.4 }],
  'scifi-toon': ['stars', 'shapes', 'bold-shadow', ['#1b1340', '#2a1d63', '#3d2b86'], '#ffffff', '#7bff72', '#ff7ae0', F.round, { saturation: 1.15 }, 12],
  'scratch-film': ['film', 'lines', 'handwritten', ['#060606', '#0d0d0d', '#141414'], '#f6f0d8', '#ff5e3a', '#f6f0d8', F.hand, { grain: 0.5, flicker: 0.5, vignette: 0.5 }, 12],
  'security-xray': ['hud', 'scan', 'mono', ['#020b1a', '#04142b', '#061d3c'], '#e0f2ff', '#ff9f1c', '#4cc9f0', F.mono, { bloom: 0.3 }],
  'shadow-puppet': ['papercut', 'none', 'serif', ['#3a1405', '#a0410d', '#f29e4c'], '#1a0a03', '#1a0a03', '#ffd29d', F.serif, { grain: 0.3, vignette: 0.6, bloom: 0.3 }],
  'silent-film': ['film', 'none', 'serif', ['#141414', '#202020', '#2c2c2c'], '#f3f3f3', '#e5e5e5', '#9e9e9e', F.roman, { grain: 0.6, flicker: 0.6, vignette: 0.65, saturation: 0 }, 16],
  'silhouette-rhythm': ['gradient', 'bars', 'clean', ['#ff6b35', '#f7c59f', '#efefd0'], '#0b0b0b', '#0b0b0b', '#ffffff', F.black, {}],
  'silkscreen-poster': ['halftone', 'rays', 'stamp', ['#ffe8c2', '#ffd59e', '#f8b86b'], '#16324f', '#e4572e', '#29335c', F.black, { grain: 0.3 }],
  'sketchnote': ['paper', 'doodles', 'handwritten', ['#fffef8', '#fbf8ec', '#f4f0de'], '#1f1f1f', '#ff7a00', '#0096c7', F.hand, {}],
  'spreadsheet': ['grid-dark', 'chart', 'mono', ['#f8f9fa', '#eef0f2', '#e2e5e9'], '#1f2328', '#107c41', '#d83b01', F.mono, {}],
  'spy-titles': ['sunburst', 'shapes', 'outline', ['#101010', '#1b1b1b', '#262626'], '#f5f0e6', '#e63946', '#f4a261', F.disp, { grain: 0.3, vignette: 0.4 }],
  'stained-glass': ['papercut', 'shapes', 'serif', ['#0b1d3a', '#14325c', '#1f4a80'], '#fff6dc', '#f6bd60', '#e63946', F.roman, { bloom: 0.5, vignette: 0.4 }],
  'stick-explainer': ['whiteboard', 'doodles', 'handwritten', ['#ffffff', '#f7f7f7', '#eeeeee'], '#111111', '#ff3b30', '#007aff', F.hand, {}],
  'teardown': ['glass', 'blocks', 'mono', ['#0e0f12', '#16181d', '#1e2128'], '#f2f4f8', '#ff6b00', '#00b4ff', F.grot, { vignette: 0.35, bloom: 0.2 }],
  'telestrator': ['cinematic', 'orbits', 'bold-shadow', ['#0f2a12', '#163a19', '#1d4a21'], '#ffffff', '#ffe600', '#ff2d55', F.black, { vignette: 0.3 }],
  'text-flash-cuts': ['cinematic', 'none', 'clean', ['#000000', '#050505', '#0a0a0a'], '#ffffff', '#ff1e1e', '#ffffff', F.disp, { grain: 0.35, contrast: 1.2 }],
  'thermal-camera': ['hud', 'blobs', 'mono', ['#0b0221', '#2a0845', '#6a0d5c'], '#ffffff', '#ffde00', '#ff3c00', F.mono, { bloom: 0.4 }],
  'transit-map': ['data', 'lines', 'clean', ['#fafafa', '#f0f0f0', '#e4e4e4'], '#1a1a1a', '#e32017', '#0098d4', F.grot, {}],
  'ukiyoe': ['papercut', 'waves', 'serif', ['#efe3c8', '#e3d1ab', '#d3bc8e'], '#1d2b3a', '#c0392b', '#2e5e8c', F.serif, { grain: 0.3, saturation: 0.85 }],
  'urban-sketch': ['paper', 'lines', 'handwritten', ['#f8f4ea', '#efe8d8', '#e5dcc6'], '#2a2a2a', '#d1495b', '#00798c', F.hand, { grain: 0.2 }],
  'vintage-collage': ['paper', 'shapes', 'serif', ['#efe5cf', '#e3d4b5', '#d5c198'], '#1f1a15', '#b5452f', '#2f5d62', F.roman, { grain: 0.4, sepia: 0.35 }],
  'visual-investigation': ['grid-dark', 'scan', 'mono', ['#0b0d10', '#12151a', '#1a1e25'], '#f0f3f6', '#ffcc00', '#ff3b3b', F.mono, { vignette: 0.3 }],
  'white-model': ['iso', 'blocks', 'clean', ['#f2f2f0', '#e6e6e3', '#d8d8d4'], '#1d1d1f', '#ff5a1f', '#00a6fb', F.grot, {}],
  'woodcut': ['paper', 'lines', 'stamp', ['#efe4cc', '#e2d3b2', '#d2bf96'], '#1a1410', '#9b2c2c', '#1a1410', F.black, { grain: 0.35, contrast: 1.15 }],
};

const CAT_PROMPT: Record<string, string> = {
  'Edit & Documentary': 'documentary editorial frame, authentic footage look, broadcast graphics',
  'Painting & Illustration': 'hand-made painted illustration on textured paper',
  'Sketch & Board': 'hand-drawn sketch, explanatory doodle, visible strokes',
  'Traditional Crafts': 'traditional handcraft art, layered physical materials',
  'Print & Printmaking': 'printmaking texture, ink on paper, limited colour separations',
  'Graphic & Type': 'bold graphic design composition, strong typography and flat shapes',
  'Line Diagrams': 'technical line diagram, precise linework, labelled parts',
  'Cartoons': 'original cartoon animation still, expressive characters, flat colours',
  'Games': 'video game art, pixel-precise rendering',
  'Film & Tape': 'analogue film footage look, grain and imperfections',
  'Screens & Interfaces': 'screen interface graphics, glowing UI elements',
  'Light & Lines': 'glowing light lines on a dark background, luminous trails',
  '3D & Miniature': '3D rendered miniature scene, soft lighting, tactile materials',
  'Instruments & Evidence': 'scientific instrument imagery, measurement overlays',
  'Data & Maps': 'data visualisation and cartography, clean and precise',
};

const toPost = (p?: Partial<PostFx>): PostFx => ({ ...NO_POST, ...(p ?? {}) });

function fromLemo(slug: string, name: string, category: string, uses: string[], needsImageGen: boolean): StyleDef {
  const r = OVR[slug] ?? CAT_DEFAULT[category] ?? CAT_DEFAULT['Graphic & Type'];
  const [background, motif, text, bg, ink, a1, a2, display, post, step] = r;
  const bgFix: Background = background;
  return {
    id: slug, lemoSlug: slug, origin: 'lemo', category, needsImageGen,
    name: { fr: name, en: name },
    description: {
      fr: `Style du catalogue Lemo-Opuscar, rendu par le moteur Studio AI. Idéal pour : ${uses.join(', ')}.`,
      en: `Style from the Lemo-Opuscar catalogue, rendered by the Studio AI engine. Best for: ${uses.join(', ')}.`,
    },
    uses,
    palette: { bg, ink, muted: ink + 'aa', accent: [a1, a2] },
    background: bgFix, motif, text, fonts: { display, body: text === 'pixel' ? 'VT323' : 'Inter' },
    post: toPost(post), motion: { energy: 0.5, stepFps: step ?? 0 },
    prompt: `${name} style, ${CAT_PROMPT[category] ?? 'distinctive visual style'}`,
  };
}

const featuredSlugs = new Set(FEATURED_STYLES.map((s) => s.lemoSlug).filter(Boolean));

export const ALL_STYLES: StyleDef[] = [
  ...FEATURED_STYLES,
  ...LEMO_CATALOG.filter(([slug]) => !featuredSlugs.has(slug)).map(([s, n, c, u, g]) => fromLemo(s, n, c, u, g)),
];

const BY_ID = new Map(ALL_STYLES.map((s) => [s.id, s]));

export function getBuiltinStyle(id: string): StyleDef | undefined { return BY_ID.get(id); }

export function resolveStyle(id: string, custom: StyleDef[] = []): StyleDef {
  return custom.find((s) => s.id === id) ?? BY_ID.get(id) ?? FEATURED_STYLES[0];
}

export function styleCount() { return ALL_STYLES.length; }
