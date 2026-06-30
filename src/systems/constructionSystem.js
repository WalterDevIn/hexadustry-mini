import { getBuildingDefinition, getBuildingFootprint, getBuildTime } from "../content/buildingDefinitions.js";
import { axialToPixel, makeHexKey } from "../hex/hexMath.js";

const BUILD_TIME_MULTIPLIER = 4;
const BUILDABLE_TYPES = new Set(["wall", "core", "drill", "conveyor"]);
let nextConstructionOperationOrder = 1;

function emitBuildResourcesChanged() {
  if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("build-resources-changed"));
}

function hasEnoughResources(resources, cost) {
  return Object.entries(cost).every(([resourceType, amount]) => (resources[resourceType] ?? 0) >= amount);
}

function addResources(resources, cost) {
  for (const [resourceType, amount] of Object.entries(cost)) resources[resourceType] = (resources[resourceType] ?? 0) + amount;
}

function subtractResources(resources, cost) {
  for (const [resourceType, amount] of Object.entries(cost)) resources[resourceType] = (resources[resourceType] ?? 0) - amount;
}

function getOperationOrder() {
  const operationOrder = nextConstructionOperationOrder;
  nextConstructionOperationOrder += 1;
  return operationOrder;
}

function getAbsoluteFootprint(anchorQ, anchorR, footprint) {
  return footprint.map((hex) => ({ q: anchorQ + hex.q, r: anchorR + hex.r }));
}

function getFootprintCenterOffset(footprint, hexSize) {
  const total = footprint.reduce((sum, hex) => {
    const center = axialToPixel(hex, hexSize);
    return { x: sum.x + center.x, y: sum.y + center.y };
  }, { x: 0, y: 0 });
  return { x: total.x / footprint.length, y: total.y / footprint.length };
}

function getOperationAimTarget(world, operation) {
  const anchor = axialToPixel(operation, world.hexSize);
  const footprintCenter = getFootprintCenterOffset(operation.footprint, world.hexSize);
  return { x: anchor.x + footprintCenter.x, y: anchor.y + footprintCenter.y };
}

function setConstructionAimLock(gameState, activeOperation) {
  gameState.playerAimLock = activeOperation ? {
    constructionId: activeOperation.operation.id,
    type: activeOperation.type,
    target: getOperationAimTarget(gameState.mapWorld, activeOperation.operation),
  } : null;
}

function findBuildingAt(world, q, r) {
  const buildingId = world.getOrCreateTile(q, r).layers.surface.buildingId;
  if (!buildingId) return null;
  return world.buildings.find((building) => building.id === buildingId) ?? null;
}

function isHexReservedByPendingConstruction(world, q, r) {
  return world.pendingConstructions.some((construction) => construction.occupiedHexes.some((hex) => hex.q === q && hex.r === r));
}

function isHexOccupied(world, q, r) {
  const tile = world.getOrCreateTile(q, r);
  if (tile.layers.surface.naturalBlock || tile.layers.surface.buildingId) return true;
  return isHexReservedByPendingConstruction(world, q, r);
}

function isFootprintOccupied(world, occupiedHexes) {
  return occupiedHexes.some((hex) => isHexOccupied(world, hex.q, hex.r));
}

function createConstructionId(definition, q, r) {
  return `${definition.id}-${makeHexKey(q, r)}-${Date.now()}-${nextConstructionOperationOrder}`;
}

function createDrillState(definition) {
  if (definition.type !== "drill") return null;
  return {
    extractedType: null,
    extractedHexCount: 0,
    storedType: null,
    storedAmount: 0,
    capacity: definition.storageCapacity ?? 10,
    secondsPerMineralPerHex: definition.drillSecondsPerMineralPerHex ?? 2,
    progress: 0,
    bladeRotation: 0,
    isDrilling: false,
  };
}

function createConveyorState(definition) {
  if (definition.type !== "conveyor") return null;
  return {
    item: null,
    progress: 0,
    transferSeconds: definition.transferSeconds ?? 0.33,
    beltPhase: 0,
  };
}

function createBuildingFromConstruction(construction, definition) {
  const building = {
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
  const drillState = createDrillState(definition);
  const conveyorState = createConveyorState(definition);
  if (drillState) building.drill = drillState;
  if (conveyorState) building.conveyor = conveyorState;
  return building;
}

function removeBuilding(world, building) {
  world.buildings = world.buildings.filter((candidate) => candidate.id !== building.id);
  for (const hex of building.occupiedHexes ?? [{ q: building.q, r: building.r }]) {
    const tile = world.getOrCreateTile(hex.q, hex.r);
    if (tile.layers.surface.buildingId === building.id) tile.layers.surface.buildingId = null;
  }
}

function getActiveConstructionOperation(world) {
  const operations = [
    ...world.pendingConstructions.map((operation) => ({ type: "construction", operation })),
    ...world.pendingDeconstructions.map((operation) => ({ type: "deconstruction", operation })),
  ];
  if (operations.length === 0) return null;
  return operations.reduce((oldest, candidate) => candidate.operation.operationOrder < oldest.operation.operationOrder ? candidate : oldest);
}

export function isConstructionModeLocked(gameState) {
  return gameState.mapWorld.pendingConstructions.length > 0 || gameState.mapWorld.pendingDeconstructions.length > 0;
}

export function cancelConstructionQueue(gameState) {
  const world = gameState.mapWorld;
  for (const construction of world.pendingConstructions) {
    const definition = getBuildingDefinition(construction.definitionId);
    if (definition) addResources(world.resources, definition.cost);
  }
  for (const deconstruction of world.pendingDeconstructions) {
    const building = world.buildings.find((candidate) => candidate.id === deconstruction.buildingId);
    if (building) building.deconstructing = false;
  }
  world.pendingConstructions = [];
  world.pendingDeconstructions = [];
  gameState.playerAimLock = null;
  emitBuildResourcesChanged();
}

export function getSelectedBuildFootprint(gameState) {
  const definition = getBuildingDefinition(gameState.ui.buildMenu.selectedBlockId);
  if (!definition) return null;
  return getBuildingFootprint(definition, gameState.ui.buildMenu.rotationIndex);
}

export function requestBuildAt(gameState, q, r) {
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const rotationIndex = gameState.ui.buildMenu.rotationIndex;
  const definition = getBuildingDefinition(selectedBlockId);
  if (!definition || !BUILDABLE_TYPES.has(definition.type)) return null;
  const footprint = getBuildingFootprint(definition, rotationIndex);
  const occupiedHexes = getAbsoluteFootprint(q, r, footprint);
  if (isFootprintOccupied(gameState.mapWorld, occupiedHexes)) return null;
  if (!hasEnoughResources(gameState.mapWorld.resources, definition.cost)) return null;
  subtractResources(gameState.mapWorld.resources, definition.cost);
  emitBuildResourcesChanged();
  const construction = {
    id: createConstructionId(definition, q, r),
    definitionId: definition.id,
    q,
    r,
    rotationIndex,
    footprint,
    occupiedHexes,
    operationOrder: getOperationOrder(),
    elapsed: 0,
    totalTime: getBuildTime(definition) * BUILD_TIME_MULTIPLIER,
  };
  gameState.mapWorld.pendingConstructions.push(construction);
  return construction;
}

export function requestDeconstructAt(gameState, q, r) {
  const world = gameState.mapWorld;
  const building = findBuildingAt(world, q, r);
  if (!building?.constructed || building.deconstructing) return null;
  const definition = getBuildingDefinition(building.definitionId);
  if (!definition) return null;
  building.deconstructing = true;
  const deconstruction = {
    id: `deconstruct-${building.id}-${Date.now()}-${nextConstructionOperationOrder}`,
    buildingId: building.id,
    q: building.q,
    r: building.r,
    footprint: building.footprint ?? getBuildingFootprint(definition, building.direction ?? 0),
    occupiedHexes: building.occupiedHexes ?? [{ q: building.q, r: building.r }],
    operationOrder: getOperationOrder(),
    elapsed: 0,
    totalTime: getBuildTime(definition) * BUILD_TIME_MULTIPLIER,
    refundCost: building.cost ?? definition.cost,
  };
  world.pendingDeconstructions.push(deconstruction);
  return deconstruction;
}

export function constructionSystem(gameState, dt) {
  const world = gameState.mapWorld;
  const activeOperation = getActiveConstructionOperation(world);
  setConstructionAimLock(gameState, activeOperation);
  if (activeOperation) activeOperation.operation.elapsed += dt;
  const completedConstructions = world.pendingConstructions.filter((construction) => construction.elapsed >= construction.totalTime);
  const completedDeconstructions = world.pendingDeconstructions.filter((deconstruction) => deconstruction.elapsed >= deconstruction.totalTime);
  world.pendingConstructions = world.pendingConstructions.filter((construction) => construction.elapsed < construction.totalTime);
  world.pendingDeconstructions = world.pendingDeconstructions.filter((deconstruction) => deconstruction.elapsed < deconstruction.totalTime);
  for (const construction of completedConstructions) {
    const definition = getBuildingDefinition(construction.definitionId);
    if (!definition) continue;
    if (isFootprintOccupied(world, construction.occupiedHexes)) {
      addResources(world.resources, definition.cost);
      emitBuildResourcesChanged();
      continue;
    }
    const building = createBuildingFromConstruction(construction, definition);
    world.buildings.push(building);
    for (const hex of building.occupiedHexes) world.getOrCreateTile(hex.q, hex.r).layers.surface.buildingId = building.id;
  }
  for (const deconstruction of completedDeconstructions) {
    const building = world.buildings.find((candidate) => candidate.id === deconstruction.buildingId);
    if (!building) continue;
    removeBuilding(world, building);
    addResources(world.resources, deconstruction.refundCost);
    emitBuildResourcesChanged();
  }
  if (!isConstructionModeLocked(gameState)) gameState.playerAimLock = null;
}
