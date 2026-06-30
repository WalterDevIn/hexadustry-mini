import { axialToPixel } from "../hex/hexMath.js";

function getFootprintCenterOffset(footprint, hexSize) {
  const total = footprint.reduce(
    (sum, hex) => {
      const center = axialToPixel(hex, hexSize);

      return {
        x: sum.x + center.x,
        y: sum.y + center.y,
      };
    },
    { x: 0, y: 0 },
  );

  return {
    x: total.x / footprint.length,
    y: total.y / footprint.length,
  };
}

function getCoreRespawnPoint(mapWorld) {
  const core = mapWorld.buildings.find((building) => {
    return building.definitionId === "coreBlock" && building.constructed;
  });

  if (!core) return null;

  const anchor = axialToPixel(core, mapWorld.hexSize);
  const footprintCenter = getFootprintCenterOffset(core.footprint, mapWorld.hexSize);

  return {
    x: anchor.x + footprintCenter.x,
    y: anchor.y + footprintCenter.y,
  };
}

function startPlayerSpawn(gameState) {
  gameState.playerSpawn = {
    active: true,
    elapsed: 0,
    duration: 3,
  };
}

export function respawnPlayerAtCore(gameState) {
  const respawnPoint = getCoreRespawnPoint(gameState.mapWorld);

  if (!respawnPoint) return false;

  const transform = gameState.ecsWorld.components.transform.get(gameState.playerEntityId);
  const velocity = gameState.ecsWorld.components.velocity.get(gameState.playerEntityId);

  if (!transform) return false;

  transform.x = respawnPoint.x;
  transform.y = respawnPoint.y;

  if (velocity) {
    velocity.x = 0;
    velocity.y = 0;
  }

  startPlayerSpawn(gameState);

  return true;
}
