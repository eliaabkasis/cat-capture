import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public");
const sourcePath = path.join(__dirname, "assets", "paw-icon-source.png");

const MASKABLE_BG = [247, 224, 230, 255]; // --color-bg

function readSource() {
  return PNG.sync.read(readFileSync(sourcePath));
}

function samplePixel(src, x, y) {
  const cx = Math.min(src.width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(src.height - 1, Math.max(0, Math.round(y)));
  const idx = (src.width * cy + cx) << 2;
  return [src.data[idx], src.data[idx + 1], src.data[idx + 2], src.data[idx + 3]];
}

/** Draws `src` scaled to `destSize x destSize` onto a new PNG of `canvasSize`,
 * centered, with optional opaque background color (for maskable/apple icons). */
function renderIcon({ canvasSize, destSize, background }) {
  const png = new PNG({ width: canvasSize, height: canvasSize });
  const src = readSource();
  const offset = (canvasSize - destSize) / 2;
  const scale = src.width / destSize;

  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const idx = (canvasSize * y + x) << 2;
      let r = background ? background[0] : 0;
      let g = background ? background[1] : 0;
      let b = background ? background[2] : 0;
      let a = background ? background[3] : 0;

      const sx = x - offset;
      const sy = y - offset;
      if (sx >= 0 && sx < destSize && sy >= 0 && sy < destSize) {
        const [sr, sg, sb, sa] = samplePixel(src, sx * scale, sy * scale);
        const alpha = sa / 255;
        r = sr * alpha + r * (1 - alpha);
        g = sg * alpha + g * (1 - alpha);
        b = sb * alpha + b * (1 - alpha);
        a = background ? 255 : Math.round(sa + a * (1 - alpha));
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return png;
}

function write(filename, png) {
  writeFileSync(path.join(outDir, filename), PNG.sync.write(png));
  console.log(`wrote ${filename}`);
}

// Standard (transparent) icons — full-bleed artwork, browser handles the background.
write("icon-192.png", renderIcon({ canvasSize: 192, destSize: 192 }));
write("icon-512.png", renderIcon({ canvasSize: 512, destSize: 512 }));

// Maskable icon — opaque background, artwork shrunk into the ~80% safe zone.
write(
  "icon-maskable-512.png",
  renderIcon({ canvasSize: 512, destSize: 380, background: MASKABLE_BG }),
);

// Apple touch icon — iOS doesn't support transparency, so give it an opaque background too.
write(
  "apple-touch-icon.png",
  renderIcon({ canvasSize: 180, destSize: 154, background: MASKABLE_BG }),
);
