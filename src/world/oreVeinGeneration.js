import { HEX_DIRECTIONS, hexDistance } from "../hex/hexMath.js";

const SAFE_CLEAR_RADIUS = 7;
const ORES = [
  { type: "copper", amount: 800, colorId: "orange", seedOffset: 101, chance: 0.018 },
  { type: "lead", amount: 650, colorId: "blue-gray", seedOffset: 211, chance: 0.012 },
  { type: "coal", amount: 520, colorId: "gray", seedOffset: 307, chance: 0.014 },
];

function fract(value) {
  return value - Math.floor(value);
}

function hash2D(q, r, seed) {
  return fract(Math.sin(q * 127.1 + r * 311.7 + seed * 74.7) * 43758.5453123);
}

function isInSafeSpawn(q, r) {
  return hexDistance({ q, r }, { q: 0, r: 0 }) <= SAFE_CLEAR_RADIUS;
}

function getVeinSize(q, r, seed, ore) {
  return 2 + Math.floor(hash2D(q + 17, r - 29, seed + ore.seedOffset) * 4);
}

function getDirection(q, r, seed, ore) {
  const index = Math.floor(hash2D(q - 19, r + 23, seed + ore.seedOffset) * HEX_DIRECTIONS.length) % HEX_DIRECTIONS.length;

  return HEX_DIRECTIONS[index];
}

function getSideDirection(direction) {
  const index = HEX_DIRECTIONS.findIndex((candidate) => candidate.q === direction.q && candidate.r === direction.r);

  return HEX_DIRECTIONS[(index + 1) % HEX_DIRECTIONS.length];
}

function getVeinFootprint(q, r, seed, ore) {
  const size = getVeinSize(q, r, seed, ore);
  const direction = getDirection(q, r, seed, ore);
  const sideDirection = getSideDirection(direction);
  const footprint = [{ q, r }];

  for (let i = 1; i < size; i += 1) {
    const previous = footprint[footprint.length - 1];
    const step = hash2D(q + i * 7, r - i * 5, seed + ore.seedOffset) > 0.68 ? sideDirection : direction;

    footprint.push({ q: previous.q + step.q, r: previous.r + step.r });
  }

  return footprint;
}

function canPlaceOre(world, footprint) {
  return footprint.every((hex) => {
    return !world.getOrCreateTile(hex.q, hex.r).layers.ground.ore;
  });
}

function placeOre(world, footprint, ore) {
  for (const hex of footprint) {
    world.getOrCreateTile(hex.q, hex.r).layers.ground.ore = {
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

    const footprint = getVeinFootprint(q, r, world.seed, ore);

    if (!canPlaceOre(world, footprint)) continue;

    placeOre(world, footprint, ore);
    return;
  }
}
