import { HEX_DIRECTIONS } from "../hex/hexMath.js";

function emitBuildResourcesChanged() {
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("build-resources-changed"));
}

function getDirectionIndex(building) {
  return (building.direction ?? 0) % HEX_DIRECTIONS.length;
}

function getDirection(building) {
  return HEX_DIRECTIONS[getDirectionIndex(building)];
}

function getOppositeDirectionIndex(directionIndex) {
  return (directionIndex + 3) % HEX_DIRECTIONS.length;
}

function getBuildingAt(world, q, r) {
  const buildingId = world.getOrCreateTile(q, r).layers.surface.buildingId;

  if (!buildingId) return null;

  return world.buildings.find((building) => building.id === buildingId) ?? null;
}

function getTargetBuilding(world, conveyorBuilding) {
  const direction = getDirection(conveyorBuilding);

  return getBuildingAt(world, conveyorBuilding.q + direction.q, conveyorBuilding.r + direction.r);
}

function canReceiveItem(building) {
  if (!building) return false;
  if (building.type === "core") return true;
  if (building.type === "conveyor") return !building.conveyor?.item;

  return false;
}

function deliverToCore(world, item) {
  world.resources[item.type] = (world.resources[item.type] ?? 0) + 1;
  emitBuildResourcesChanged();
}

function deliverItem(world, conveyorBuilding) {
  const conveyor = conveyorBuilding.conveyor;
  const item = conveyor.item;
  const targetDirectionIndex = getDirectionIndex(conveyorBuilding);
  const target = getTargetBuilding(world, conveyorBuilding);

  if (!item || !canReceiveItem(target)) return false;

  if (target.type === "core") {
    deliverToCore(world, item);
  }

  if (target.type === "conveyor") {
    target.conveyor.item = {
      type: item.type,
      entryDirection: getOppositeDirectionIndex(targetDirectionIndex),
    };
    target.conveyor.progress = 0;
  }

  conveyor.item = null;
  conveyor.progress = 0;

  return true;
}

function takeFromDrill(drillBuilding, entryDirection) {
  const drill = drillBuilding.drill;

  if (!drill?.storedType || drill.storedAmount <= 0) return null;

  const item = {
    type: drill.storedType,
    entryDirection,
  };

  drill.storedAmount -= 1;

  if (drill.storedAmount <= 0) {
    drill.storedAmount = 0;
    drill.storedType = null;
  }

  return item;
}

function tryPullFromAdjacentDrill(world, conveyorBuilding) {
  const outputDirectionIndex = getDirectionIndex(conveyorBuilding);

  for (let directionIndex = 0; directionIndex < HEX_DIRECTIONS.length; directionIndex += 1) {
    if (directionIndex === outputDirectionIndex) continue;

    const direction = HEX_DIRECTIONS[directionIndex];
    const source = getBuildingAt(world, conveyorBuilding.q + direction.q, conveyorBuilding.r + direction.r);

    if (source?.type !== "drill") continue;

    const item = takeFromDrill(source, directionIndex);

    if (item) return item;
  }

  return null;
}

function updateBeltAnimation(conveyor, dt) {
  conveyor.beltPhase = (conveyor.beltPhase + dt / conveyor.transferSeconds) % 1;
}

function updateConveyor(world, building, dt) {
  const conveyor = building.conveyor;

  updateBeltAnimation(conveyor, dt);

  if (!conveyor.item) {
    conveyor.item = tryPullFromAdjacentDrill(world, building);
    conveyor.progress = 0;
  }

  if (!conveyor.item) return;

  conveyor.progress = Math.min(conveyor.transferSeconds, conveyor.progress + dt);

  if (conveyor.progress >= conveyor.transferSeconds) {
    deliverItem(world, building);
  }
}

export function conveyorSystem(gameState, dt) {
  const { mapWorld } = gameState;

  for (const building of mapWorld.buildings) {
    if (!building.constructed || building.type !== "conveyor" || !building.conveyor) continue;

    updateConveyor(mapWorld, building, dt);
  }
}
