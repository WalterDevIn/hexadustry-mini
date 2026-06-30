import { HEX_DIRECTIONS, hexDistance } from "../hex/hexMath.js";

const SAFE_CLEAR_RADIUS = 3;
const ORE_MIN_SIZE = 2;
const ORE_MAX_SIZE = 7;

const ORES = [
  { type: "copper", amount: 800, colorId: "orange", seedOffset: 101, chance: 0.045 },
  { type: "lead", amount: 650, colorId: "blue-gray", seedOffset: 211, chance: 0.032 },
  { type: "carbon", amount: 520, colorId: "gray", seedOffset: 307, chance: 0.038 },
];

function fract(value) {
  return value - Math.floor(value);
}

function hash2D(q, r, seed) {
  return fract(Math.sin(q * 127.1 + r * 311.7 + seed * 74.7) * 43758.5453123);
}

function makeHexKey(q, r) {
  return `${q},${r}`;
}

function isInSafeSpawn(q, r) {
  return hexDistance({ q, r }, { q: 0, r: 0 }) <= SAFE_CLEAR_RADIUS;
}

function getVeinSize(q, r, seed, ore) {
  const roll = hash2D(q + 17, r - 29, seed + ore.seedOffset);

  return ORE_MIN_SIZE + Math.floor(roll * (ORE_MAX_SIZE - ORE_MIN_SIZE + 1));
}

function getSeedNeighbor(q, r, seed, ore, index, candidates) {
  const chosenIndex = Math.floor(hash2D(q + index * 13, r - index * 19, seed + ore.seedOffset) * candidates.length) % candidates.length;

  return candidates[chosenIndex];
}

function getClusterCandidates(footprint, occupiedKeys) {
  const candidates = [];
  const candidateKeys = new Set();

  for (const hex of footprint) {
    for (const direction of HEX_DIRECTIONS) {
      const candidate = {
        q: hex.q + direction.q,
        r: hex.r + direction.r,
      };
      const key = makeHexKey(candidate.q, candidate.r);

      if (occupiedKeys.has(key)) continue;
      if (candidateKeys.has(key)) continue;

      candidates.push(candidate);
      candidateKeys.add(key);
    }
  }

  return candidates;
}

function getOreClusterFootprint(q, r, seed, ore) {
  const size = getVeinSize(q, r, seed, ore);
  const footprint = [{ q, r }];
  const occupiedKeys = new Set([makeHexKey(q, r)]);

  while (footprint.length < size) {
    const candidates = getClusterCandidates(footprint, occupiedKeys);

    if (candidates.length === 0) break;

    const nextHex = getSeedNeighbor(q, r, seed, ore, footprint.length, candidates);
    const key = makeHexKey(nextHex.q, nextHex.r);

    footprint.push(nextHex);
    occupiedKeys.add(key);
  }

  return footprint;
}

function canPlaceOre(world, footprint) {
  return footprint.every((hex) => {
    const tile = world.getOrCreateTile(hex.q, hex.r);

    return !tile.layers.ground.ore;
  });
}

function placeOre(world, footprint, ore) {
  for (const hex of footprint) {
    const tile = world.getOrCreateTile(hex.q, hex.r);

    tile.layers.ground.ore = {
      type: ore.type,
      amount: ore.amount,
      colorId: ore.colorId,
      generated: true,
    };
  }
}

export function maybeGenerateOreVein(world, q, r) {
  if (isInSafeSpawn(q, r)) return;

  for (const ore of ORES) {
    if (hash2D(q, r, world.seed + ore.seedOffset) > ore.chance) continue;

    const footprint = getOreClusterFootprint(q, r, world.seed, ore);

    if (!canPlaceOre(world, footprint)) continue;

    placeOre(world, footprint, ore);
    return;
  }
}
