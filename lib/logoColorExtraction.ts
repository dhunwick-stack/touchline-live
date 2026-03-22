function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function colorDistance(a: string, b: string) {
  const colorA = hexToRgb(a);
  const colorB = hexToRgb(b);

  if (!colorA || !colorB) return 0;

  const dr = colorA.r - colorB.r;
  const dg = colorA.g - colorB.g;
  const db = colorA.b - colorB.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function adjustColor(hex: string, amount: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
}

type PaletteCandidate = {
  color: string;
  count: number;
  saturation: number;
};

export async function extractLogoColors(imageUrl: string) {
  if (!imageUrl.trim()) {
    throw new Error('Enter a logo URL first.');
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Logo could not be loaded for color extraction.'));
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  const size = 72;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas is not available in this browser.');
  }

  context.clearRect(0, 0, size, size);
  context.drawImage(img, 0, 0, size, size);

  let imageData: ImageData;
  try {
    imageData = context.getImageData(0, 0, size, size);
  } catch {
    throw new Error('This logo host blocks color sampling. Try another image URL or upload source.');
  }

  const buckets = new Map<string, PaletteCandidate>();
  const step = 4;

  for (let index = 0; index < imageData.data.length; index += 4 * step) {
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    const alpha = imageData.data[index + 3];

    if (alpha < 140) continue;

    const { s, l } = rgbToHsl(r, g, b);

    if (l > 0.95) continue;
    if (l < 0.08) continue;
    if (s < 0.08 && l > 0.8) continue;

    const key = rgbToHex(
      Math.round(r / 24) * 24,
      Math.round(g / 24) * 24,
      Math.round(b / 24) * 24,
    );

    const existing = buckets.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, {
        color: key,
        count: 1,
        saturation: s,
      });
    }
  }

  const palette = [...buckets.values()].sort((a, b) => {
    const aScore = a.count * 1.5 + a.saturation * 20;
    const bScore = b.count * 1.5 + b.saturation * 20;
    return bScore - aScore;
  });

  if (palette.length === 0) {
    throw new Error('No strong colors were found in that logo.');
  }

  const primary = palette[0].color;
  const primaryRgb = hexToRgb(primary);
  const primaryLightness = primaryRgb
    ? rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b).l
    : 0.5;
  const secondary =
    palette.find(
      (candidate) =>
        candidate.color !== primary &&
        candidate.saturation >= 0.12 &&
        colorDistance(candidate.color, primary) >= 72,
    )?.color ||
    adjustColor(primary, primaryLightness > 0.5 ? -48 : 48);

  return {
    primary,
    secondary,
  };
}
