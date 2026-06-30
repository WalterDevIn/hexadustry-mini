import { HEX_DIRECTIONS, hexDistance, makeHexKey } from "../hex/hexMath.js";

export const CHUNK_SIZE = 16;

const WALL_THRESHOLD = 0.54;
const CAVE_THRESHOLD = 0.68;
const SAFE_CLEAR_RADIUS = 7;

function fract(value) {
  return value - Math.floor(value);
}

function hash2D(x, y, seed) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(q, r, scale, seed) {
  const x = q / scale;
  const y = r / scale;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x1, y0, seed);
  const n01 = hash2D(x0, y1, seed);
  const n11 = hash2D(x1, y1, seed);

  const ix0 = n00 + (n10 - n00) * sx;
  const ix1 = n01 + (n11 - n01) * sx;

  return ix0 + (ix1 - ix0) * sy;
}

function caveField(q, r, seed) {
  const broadRock = valueNoise(q, r, 18, seed);
  const caveCarve = valueNoise(q + 90, r - 40, 9, seed + 17);
  const detail = valueNoise(q - 140, r + 55, 4, seed + 31);
  const vein = Math.sin((q * 0.55 + r * 0.75 + valueNoise(q, r, 24, seed + 9) * 8) * 0.65);

  return broadRock * 0.62 + detail * 0.16 + (1 - caveCarve) * 0.28 + vein * 0.12;
}

function isInSafeSpawn(q, r) {
  return hexDistance({ q, r }, { q: 0, r: 0 }) <= SAFE_CLEAR_RADIUS;
}

function isMainCaveTunnel(q, r, seed) {
  const tunnelA = Math.abs(Math.sin(q * 0.18 + r * 0.11 + seed * 0.01));
  const tunnelB = Math.abs(Math.sin(q * -0.07 + r * 0.22 + seed * 0.015));

  return tunnelA < 0.16 || tunnelB < 0.11;
}

function shouldPlaceCaveWall(q, r, seed) {
  if (isInSafeSpawn(q, r)) return false;
  if (isMainCaveTunnel(q, r, seed)) return false;

  const field = caveField(q, r, seed);
  const openPocket = valueNoise(q + 240, r - 170, 13, seed + 67);

  return field > WALL_THRESHOLD && openPocket < CAVE_THRESHOLD;
}

function countWallNeighbors(q, r, seed) {
  let walls = 0;

  for (const direction of HEX_DIRECTIONS) {
    if (shouldPlaceCaveWall(q + direction.q, r + direction.r, seed)) {
      walls += 1;
    }
  }

  return walls;
}

function createCaveWall(q, r, seed) {
  const density = caveField(q, r, seed);
  const wallKind = density > 0.72 ? "dense-rock" : "cave-wall";

  return {
    type: wallKind,
    hp: wallKind === "dense-rock" ? 260 : 180,
    generated: true,
  };
}

export function getChunkKey(chunkQ, chunkR) {
  return `${chunkQ},${chunkR}`;
}

export function getChunkCoord(value) {
  return Math.floor(value / CHUNK_SIZE);
}

export function generateChunk(world, chunkQ, chunkR) {
  const chunkKey = getChunkKey(chunkQ, chunkR);

  if (world.generatedChunks.has(chunkKey)) return;

  const startQ = chunkQ * CHUNK_SIZE;
  const startR = chunkR * CHUNK_SIZE;

  for (let localQ = 0; localQ < CHUNK_SIZE; localQ += 1) {
    for (let localR = 0; localR < CHUNK_SIZE; localR += 1) {
      const q = startQ + localQ;
      const r = startR + localR;
      const tile = world.getOrCreateTile(q, r);

      if (tile.layers.surface.buildingId || tile.layers.surface.naturalBlock) {
        continue;
      }

      const wallsNearby = countWallNeighbors(q, r, world.seed);
      const isWall = shouldPlaceCaveWall(q, r, world.seed);
      const isSmoothedWall = isWall || wallsNearby >= 5;

      if (isSmoothedWall) {
        tile.layers.surface.naturalBlock = createCaveWall(q, r, world.seed);
      }
    }
  }

  world.generatedChunks.add(chunkKey);
}

export function ensureChunksForHexes(world, hexes) {
  for (const hex of hexes) {
    const chunkQ = getChunkCoord(hex.q);
    const chunkR = getChunkCoord(hex.r);

    for (let dq = -1; dq <= 1; dq += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        generateChunk(world, chunkQ + dq, chunkR + dr);
      }
    }
  }
}

export function getChunkKeyForHex(q, r) {
  return getChunkKey(getChunkCoord(q), getChunkCoord(r));
}

export function getTileKeyForHex(q, r) {
  return makeHexKey(q, r);
}
