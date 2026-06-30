export const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function axialToPixel(hex, size, origin) {
  const x = size * Math.sqrt(3) * (hex.q + hex.r / 2) + origin.x;
  const y = size * 1.5 * hex.r + origin.y;

  return { x, y };
}

export function hexCorner(center, size, cornerIndex) {
  const angle = ((60 * cornerIndex - 30) * Math.PI) / 180;

  return {
    x: center.x + size * Math.cos(angle),
    y: center.y + size * Math.sin(angle),
  };
}

export function buildHexPolygon(hex, size, origin) {
  const center = axialToPixel(hex, size, origin);
  const corners = [];

  for (let i = 0; i < 6; i += 1) {
    corners.push(hexCorner(center, size, i));
  }

  return { center, corners };
}

export function makeHexKey(q, r) {
  return `${q},${r}`;
}

export function parseHexKey(key) {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

export function generateHexDisk(radius) {
  const hexes = [];

  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);

    for (let r = r1; r <= r2; r += 1) {
      hexes.push({ q, r });
    }
  }

  return hexes;
}
