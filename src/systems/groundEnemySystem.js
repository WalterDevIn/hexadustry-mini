import { queryEntities } from "../ecs/createWorld.js";
import { axialToPixel, HEX_DIRECTIONS, pixelToAxial, roundAxial, hexDistance } from "../hex/hexMath.js";

const SOLID_NATURAL_BLOCKS = new Set(["cave-wall", "dense-rock"]);

function isSolidForGroundEnemy(mapWorld, q, r) {
  const tile = mapWorld.getOrCreateTile(q, r);
  const naturalBlock = tile.layers.surface.naturalBlock;

  if (naturalBlock && SOLID_NATURAL_BLOCKS.has(naturalBlock.type)) {
    return true;
  }

  return false;
}

function getProjectedPlayerHex(gameState) {
  const playerTransform = gameState.ecsWorld.components.transform.get(gameState.playerEntityId);

  if (!playerTransform) return { q: 0, r: 0 };

  return roundAxial(pixelToAxial(playerTransform, gameState.mapWorld.hexSize));
}

function chooseNextHex(mapWorld, currentHex, targetHex) {
  const candidates = HEX_DIRECTIONS
    .map((direction) => ({
      q: currentHex.q + direction.q,
      r: currentHex.r + direction.r,
    }))
    .filter((hex) => !isSolidForGroundEnemy(mapWorld, hex.q, hex.r));

  if (candidates.length === 0) return currentHex;

  candidates.sort((a, b) => {
    const distanceA = hexDistance(a, targetHex);
    const distanceB = hexDistance(b, targetHex);

    return distanceA - distanceB;
  });

  return candidates[0];
}

function syncTransformToHex(mapWorld, transform, hexPosition, progress) {
  const from = axialToPixel(hexPosition, mapWorld.hexSize);
  const to = axialToPixel(
    { q: hexPosition.targetQ, r: hexPosition.targetR },
    mapWorld.hexSize,
  );

  transform.x = from.x + (to.x - from.x) * progress;
  transform.y = from.y + (to.y - from.y) * progress;

  if (Math.hypot(to.x - from.x, to.y - from.y) > 0.1) {
    transform.rotation = Math.atan2(to.y - from.y, to.x - from.x);
  }
}

export function groundEnemySystem(gameState, dt) {
  const { ecsWorld, mapWorld } = gameState;
  const enemies = queryEntities(ecsWorld, ["groundEnemyAi", "hexPosition", "transform"]);
  const targetHex = getProjectedPlayerHex(gameState);

  for (const entityId of enemies) {
    const ai = ecsWorld.components.groundEnemyAi.get(entityId);
    const hexPosition = ecsWorld.components.hexPosition.get(entityId);
    const transform = ecsWorld.components.transform.get(entityId);

    ai.stepCooldown = Math.max(0, ai.stepCooldown - dt);

    if (hexPosition.progress < 1) {
      hexPosition.progress = Math.min(1, hexPosition.progress + dt / ai.stepInterval);
      syncTransformToHex(mapWorld, transform, hexPosition, hexPosition.progress);

      if (hexPosition.progress >= 1) {
        hexPosition.q = hexPosition.targetQ;
        hexPosition.r = hexPosition.targetR;
      }

      continue;
    }

    syncTransformToHex(mapWorld, transform, hexPosition, 1);

    if (ai.stepCooldown > 0) continue;

    const nextHex = chooseNextHex(mapWorld, hexPosition, targetHex);

    if (nextHex.q === hexPosition.q && nextHex.r === hexPosition.r) {
      ai.stepCooldown = ai.stepInterval;
      continue;
    }

    hexPosition.targetQ = nextHex.q;
    hexPosition.targetR = nextHex.r;
    hexPosition.progress = 0;
    ai.stepCooldown = ai.stepInterval;
  }
}

export function isGroundEnemyBlockedBySolidWall(mapWorld, q, r) {
  return isSolidForGroundEnemy(mapWorld, q, r);
}
