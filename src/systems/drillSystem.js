import { getBuildingDefinition } from "../content/buildingDefinitions.js";

const MINERAL_PRIORITY = {
  copper: 3,
  lead: 2,
  carbon: 1,
};

function countFootprintOre(mapWorld, building) {
  const counts = new Map();

  for (const hex of building.occupiedHexes ?? [{ q: building.q, r: building.r }]) {
    const ore = mapWorld.getOrCreateTile(hex.q, hex.r).layers.ground.ore;

    if (!ore) continue;

    counts.set(ore.type, (counts.get(ore.type) ?? 0) + 1);
  }

  return counts;
}

function pickDominantOreType(counts) {
  let selectedType = null;
  let selectedCount = 0;
  let selectedPriority = -1;

  for (const [oreType, count] of counts.entries()) {
    const priority = MINERAL_PRIORITY[oreType] ?? 0;

    if (count > selectedCount || (count === selectedCount && priority > selectedPriority)) {
      selectedType = oreType;
      selectedCount = count;
      selectedPriority = priority;
    }
  }

  return selectedType;
}

function getExtractedOreType(mapWorld, building) {
  return pickDominantOreType(countFootprintOre(mapWorld, building));
}

function ensureDrillState(building, definition) {
  if (building.drill) return building.drill;

  building.drill = {
    extractedType: null,
    storedType: null,
    storedAmount: 0,
    capacity: definition.storageCapacity ?? 10,
    rate: definition.drillRate ?? 1,
    progress: 0,
    bladeRotation: 0,
    isDrilling: false,
  };

  return building.drill;
}

function canStoreOre(drill, oreType) {
  if (!oreType) return false;
  if (drill.storedAmount >= drill.capacity) return false;

  return !drill.storedType || drill.storedType === oreType;
}

function updateStoredOre(drill, oreType) {
  drill.storedType = drill.storedType ?? oreType;
  drill.storedAmount = Math.min(drill.capacity, drill.storedAmount + 1);
}

function updateDrill(building, definition, mapWorld, dt) {
  const drill = ensureDrillState(building, definition);
  const oreType = getExtractedOreType(mapWorld, building);

  drill.extractedType = oreType;
  drill.isDrilling = canStoreOre(drill, oreType);

  if (!drill.isDrilling) return;

  drill.bladeRotation += dt * Math.PI * 2.4;
  drill.progress += dt * drill.rate;

  while (drill.progress >= 1 && canStoreOre(drill, oreType)) {
    drill.progress -= 1;
    updateStoredOre(drill, oreType);
  }

  if (!canStoreOre(drill, oreType)) {
    drill.isDrilling = false;
  }
}

export function drillSystem(gameState, dt) {
  const { mapWorld } = gameState;

  for (const building of mapWorld.buildings) {
    if (!building.constructed || building.type !== "drill") continue;

    const definition = getBuildingDefinition(building.definitionId);

    if (!definition) continue;

    updateDrill(building, definition, mapWorld, dt);
  }
}
