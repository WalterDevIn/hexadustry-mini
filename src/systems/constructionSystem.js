import { getBuildingDefinition, getBuildTime } from "../content/buildingDefinitions.js";
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

function findBuildingAt(world, q, r) {
  const tile = world.getOrCreateTile(q, r);

  if (!tile.layers.surface.buildingId) return null;

  return world.buildings.find((building) => building.id === tile.layers.surface.buildingId) ?? null;
}

function isHexOccupied(world, q, r) {
  const tile = world.getOrCreateTile(q, r);

  if (tile.layers.surface.naturalBlock) return true;
  if (tile.layers.surface.buildingId) return true;

  return world.pendingConstructions.some((construction) => construction.q === q && construction.r === r);
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
    constructed: true,
    cost: { ...definition.cost },
  };
}

export function requestBuildAt(gameState, q, r) {
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!definition) return false;
  if (definition.type !== "wall") return false;
  if (isHexOccupied(gameState.mapWorld, q, r)) return false;
  if (!hasEnoughResources(gameState.mapWorld.resources, definition.cost)) return false;

  subtractResources(gameState.mapWorld.resources, definition.cost);

  gameState.mapWorld.pendingConstructions.push({
    id: createConstructionId(definition, q, r),
    definitionId: definition.id,
    q,
    r,
    elapsed: 0,
    totalTime: getBuildTime(definition),
  });

  return true;
}

export function requestDeconstructAt(gameState, q, r) {
  const world = gameState.mapWorld;
  const tile = world.getOrCreateTile(q, r);
  const building = findBuildingAt(world, q, r);

  if (!building?.constructed) return false;

  const definition = getBuildingDefinition(building.definitionId);
  const refundCost = building.cost ?? definition?.cost ?? {};

  world.buildings = world.buildings.filter((candidate) => candidate.id !== building.id);
  tile.layers.surface.buildingId = null;
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
    if (isHexOccupied(world, construction.q, construction.r)) continue;

    const building = createBuildingFromConstruction(construction, definition);
    const tile = world.getOrCreateTile(building.q, building.r);

    world.buildings.push(building);
    tile.layers.surface.buildingId = building.id;
  }
}
