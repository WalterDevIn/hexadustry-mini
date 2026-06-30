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

function isHexOccupied(world, q, r) {
  const tile = world.getOrCreateTile(q, r);

  if (tile.layers.surface.naturalBlock) return true;
  if (tile.layers.surface.buildingId) return true;

  return world.pendingConstructions.some((construction) => {
    return construction.occupiedHexes.some((hex) => hex.q === q && hex.r === r);
  });
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
    direction: null,
    directionMode: definition.directionMode,
    footprint: getBuildingFootprint(definition),
    occupiedHexes: construction.occupiedHexes,
    constructed: true,
    cost: { ...definition.cost },
  };
}

export function requestBuildAt(gameState, q, r) {
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!definition) return false;
  if (definition.type !== "wall") return false;

  const footprint = getBuildingFootprint(definition);
  const occupiedHexes = getAbsoluteFootprint(q, r, footprint);

  if (isFootprintOccupied(gameState.mapWorld, occupiedHexes)) return false;
  if (!hasEnoughResources(gameState.mapWorld.resources, definition.cost)) return false;

  subtractResources(gameState.mapWorld.resources, definition.cost);

  gameState.mapWorld.pendingConstructions.push({
    id: createConstructionId(definition, q, r),
    definitionId: definition.id,
    q,
    r,
    footprint,
    occupiedHexes,
    elapsed: 0,
    totalTime: getBuildTime(definition),
  });

  return true;
}

export function requestDeconstructAt(gameState, q, r) {
  const world = gameState.mapWorld;
  const building = findBuildingAt(world, q, r);

  if (!building?.constructed) return false;

  const definition = getBuildingDefinition(building.definitionId);
  const refundCost = building.cost ?? definition?.cost ?? {};

  world.buildings = world.buildings.filter((candidate) => candidate.id !== building.id);

  for (const hex of building.occupiedHexes ?? [{ q: building.q, r: building.r }]) {
    const tile = world.getOrCreateTile(hex.q, hex.r);

    if (tile.layers.surface.buildingId === building.id) {
      tile.layers.surface.buildingId = null;
    }
  }

  addResources(world.resources, refundCost);

  return true;
}

export function constructionSystem(gameState, dt) {
  const world = gameState.mapWorld;

  for (const construction of world.pendingConstructions) {
    construction.elapsed += dt;
  }

  const completed = world.pendingConstructions.filter((construction) => {
    return construction.elapsed >= construction.totalTime;
  });

  if (completed.length === 0) return;

  world.pendingConstructions = world.pendingConstructions.filter((construction) => {
    return construction.elapsed < construction.totalTime;
  });

  for (const construction of completed) {
    const definition = getBuildingDefinition(construction.definitionId);

    if (!definition) continue;
    if (isFootprintOccupied(world, construction.occupiedHexes)) continue;

    const building = createBuildingFromConstruction(construction, definition);

    world.buildings.push(building);

    for (const hex of building.occupiedHexes) {
      const tile = world.getOrCreateTile(hex.q, hex.r);
      tile.layers.surface.buildingId = building.id;
    }
  }
}
