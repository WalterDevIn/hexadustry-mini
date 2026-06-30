export const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function axialToPixel(hex, size, origin = { x: 0, y: 0 }) {
  const x = size * Math.sqrt(3) * (hex.q + hex.r / 2) + origin.x;
  const y = size * 1.5 * hex.r + origin.y;

  return { x, y };
}

export function pixelToAxial(point, size, origin = { x: 0, y: 0 }) {
  const x = point.x - origin.x;
  const y = point.y - origin.y;

  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
  const r = (2 / 3 * y) / size;

  return { q, r };
}

export function roundAxial(hex) {
  let x = hex.q;
  let z = hex.r;
  let y = -x - z;

  let roundedX = Math.round(x);
  let roundedY = Math.round(y);
  let roundedZ = Math.round(z);

  const xDiff = Math.abs(roundedX - x);
  const yDiff = Math.abs(roundedY - y);
  const zDiff = Math.abs(roundedZ - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    roundedX = -roundedY - roundedZ;
  } else if (yDiff > zDiff) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return { q: roundedX, r: roundedZ };
}

export function hexDistance(a, b) {
  return (
    Math.abs(a.q - b.q) +
    Math.abs(a.q + a.r - b.q - b.r) +
    Math.abs(a.r - b.r)
  ) / 2;
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

export function generateVisibleHexes({ cameraCenter, viewport, hexSize, mapRadius, padding = 3 }) {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const left = cameraCenter.x - halfWidth;
  const right = cameraCenter.x + halfWidth;
  const top = cameraCenter.y - halfHeight;
  const bottom = cameraCenter.y + halfHeight;

  const rMin = Math.floor(top / (hexSize * 1.5)) - padding;
  const rMax = Math.ceil(bottom / (hexSize * 1.5)) + padding;
  const hexes = [];

  for (let r = rMin; r <= rMax; r += 1) {
    const qMin = Math.floor(left / (hexSize * Math.sqrt(3)) - r / 2) - padding;
    const qMax = Math.ceil(right / (hexSize * Math.sqrt(3)) - r / 2) + padding;

    for (let q = qMin; q <= qMax; q += 1) {
      const distanceFromOrigin = hexDistance({ q, r }, { q: 0, r: 0 });

      if (distanceFromOrigin <= mapRadius) {
        hexes.push({ q, r });
      }
    }
  }

  return hexes;
}
