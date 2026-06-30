import { getBuildingDefinition, getBuildingFootprint, getBuildTime } from "../content/buildingDefinitions.js";
import { makeHexKey } from "../hex/hexMath.js";

function hasEnoughResources(resources, cost) {
  return Object.entries(cost).every(([resourceType, amount]) => {
    return (resources[resourceType] ?? 0) >= amount;
  });
}

function addResources(resources, cost) {
  for (const [resourceType, amount] of Object.entries(cost)) {
    resources[resourceType] = (resources[resourceType] ?? 0) + amount;
  }
}

function subtractResources(resources, cost) {
  for (const [resourceType, amount] of Object.entries(cost)) {
    resources[resourceType] = (resources[resourceType] ?? 0) - amount;
  }
}

function getAbsoluteFootprint(anchorQ, anchorR, footprint) {
  return footprint.map((hex) => ({
    q: anchorQ + hex.q,
    r: anchorR + hex.r,
  }));
}

function findBuildingAt(world, q, r) {
  const tile = world.getOrCreateTile(q, r);

  if (!tile.layers.surface.buildingId) return null;

  return world.buildings.find((building) => building.id === tile.layers.surface.buildingId) ?? null;
}

function isHexReservedByPendingConstruction(world, q, r) {
  return world.pendingConstructions.some((construction) => {
    return construction.occupiedHexes.some((hex) => hex.q === q && hex.r === r);
  });
}

function isHexOccupied(world, q, r) {
  const tile = world.getOrCreateTile(q, r);

  if (tile.layers.surface.naturalBlock) return true;
  if (tile.layers.surface.buildingId) return true;

  return isHexReservedByPendingConstruction(world, q, r);
}

function isFootprintOccupied(world, occupiedHexes) {
  return occupiedHexes.some((hex) => isHexOccupied(world, hex.q, hex.r));
}

function createConstructionId(definition, q, r) {
  return `${definition.id}-${makeHexKey(q, r)}-${Date.now()}`;
}

function createBuildingFromConstruction(construction, definition) {
  return {
    id: construction.id,
    definitionId: definition.id,
    type: definition.type,
    q: construction.q,
    r: construction.r,
    hp: definition.hp,
    maxHp: definition.maxHp,
    solid: definition.solid,
    direction: construction.rotationIndex,
    directionMode: definition.directionMode,
    footprint: construction.footprint,
    occupiedHexes: construction.occupiedHexes,
    constructed: true,
    cost: { ...definition.cost },
  };
}

function clearCompletedAimLock(gameState, constructionId) {
  if (gameState.playerAimLock?.constructionId === constructionId) {
    gameState.playerAimLock = null;
  }
}

function removeBuilding(world, building) {
  world.buildings = world.buildings.filter((candidate) => candidate.id !== building.id);

  for (const hex of building.occupiedHexes ?? [{ q: building.q, r: building.r }]) {
    const tile = world.getOrCreateTile(hex.q, hex.r);

    if (tile.layers.surface.buildingId === building.id) {
      tile.layers.surface.buildingId = null;
    }
  }
}

export function getSelectedBuildFootprint(gameState) {
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const rotationIndex = gameState.ui.buildMenu.rotationIndex;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!definition) return null;

  return getBuildingFootprint(definition, rotationIndex);
}

export function requestBuildAt(gameState, q, r) {
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const rotationIndex = gameState.ui.buildMenu.rotationIndex;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!definition) return null;
  if (definition.type !== "wall") return null;

  const footprint = getBuildingFootprint(definition, rotationIndex);
  const occupiedHexes = getAbsoluteFootprint(q, r, footprint);

  if (isFootprintOccupied(gameState.mapWorld, occupiedHexes)) return null;
  if (!hasEnoughResources(gameState.mapWorld.resources, definition.cost)) return null;

  subtractResources(gameState.mapWorld.resources, definition.cost);

  const construction = {
    id: createConstructionId(definition, q, r),
    definitionId: definition.id,
    q,
    r,
    rotationIndex,
    footprint,
    occupiedHexes,
    elapsed: 0,
    totalTime: getBuildTime(definition),
  };

  gameState.mapWorld.pendingConstructions.push(construction);

  return construction;
}

export function requestDeconstructAt(gameState, q, r) {
  const world = gameState.mapWorld;
  const building = findBuildingAt(world, q, r);

  if (!building?.constructed) return null;
  if (building.deconstructing) return null;

  const definition = getBuildingDefinition(building.definitionId);

  if (!definition) return null;

  building.deconstructing = true;

  const deconstruction = {
    id: `deconstruct-${building.id}-${Date.now()}`,
    buildingId: building.id,
    q: building.q,
    r: building.r,
    footprint: building.footprint ?? getBuildingFootprint(definition, building.direction ?? 0),
    occupiedHexes: building.occupiedHexes ?? [{ q: building.q, r: building.r }],
    elapsed: 0,
    totalTime: getBuildTime(definition),
    refundCost: building.cost ?? definition.cost,
  };

  world.pendingDeconstructions.push(deconstruction);

  return deconstruction;
}

export function constructionSystem(gameState, dt) {
  const world = gameState.mapWorld;

  for (const construction of world.pendingConstructions) {
    construction.elapsed += dt;
  }

  for (const deconstruction of world.pendingDeconstructions) {
    deconstruction.elapsed += dt;
  }

  const completedConstructions = world.pendingConstructions.filter((construction) => {
    return construction.elapsed >= construction.totalTime;
  });
  const completedDeconstructions = world.pendingDeconstructions.filter((deconstruction) => {
    return deconstruction.elapsed >= deconstruction.totalTime;
  });

  world.pendingConstructions = world.pendingConstructions.filter((construction) => {
    return construction.elapsed < construction.totalTime;
  });
  world.pendingDeconstructions = world.pendingDeconstructions.filter((deconstruction) => {
    return deconstruction.elapsed < deconstruction.totalTime;
  });

  for (const construction of completedConstructions) {
    const definition = getBuildingDefinition(construction.definitionId);

    if (!definition) {
      clearCompletedAimLock(gameState, construction.id);
      continue;
    }

    if (isFootprintOccupied(world, construction.occupiedHexes)) {
      clearCompletedAimLock(gameState, construction.id);
      continue;
    }

    const building = createBuildingFromConstruction(construction, definition);

    world.buildings.push(building);

    for (const hex of building.occupiedHexes) {
      const tile = world.getOrCreateTile(hex.q, hex.r);
      tile.layers.surface.buildingId = building.id;
    }

    clearCompletedAimLock(gameState, construction.id);
  }

  for (const deconstruction of completedDeconstructions) {
    const building = world.buildings.find((candidate) => candidate.id === deconstruction.buildingId);

    if (!building) continue;

    removeBuilding(world, building);
    addResources(world.resources, deconstruction.refundCost);
  }
}
