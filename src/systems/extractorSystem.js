import { getBuildingDefinition } from "../content/buildingDefinitions.js";
import { getTile } from "../world/createInitialWorld.js";

const ORE_PRIORITY = {
  copper: 3,
  lead: 2,
  carbon: 1,
};

function getOreCounts(mapWorld, building) {
  const counts = new Map();

  for (const hex of building.occupiedHexes ?? [{ q: building.q, r: building.r }]) {
    const ore = getTile(mapWorld, hex.q, hex.r).layers.ground.ore;

    if (!ore) continue;

    counts.set(ore.type, (counts.get(ore.type) ?? 0) + 1);
  }

  return counts;
}

function chooseOre(counts) {
  let type = null;
  let count = 0;
  let priority = -1;

  for (const [oreType, oreCount] of counts.entries()) {
    const orePriority = ORE_PRIORITY[oreType] ?? 0;

    if (oreCount > count || (oreCount === count && orePriority > priority)) {
      type = oreType;
      count = oreCount;
      priority = orePriority;
    }
  }

  return { type, count };
}

function getDrill(building, definition) {
  building.drill ??= {
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
  building.drill.extractedHexCount ??= 0;
  building.drill.secondsPerMineralPerHex ??= definition.drillSecondsPerMineralPerHex ?? 2;

  return building.drill;
}

function canStore(drill, oreType) {
  if (!oreType) return false;
  if (drill.storedAmount >= drill.capacity) return false;

  return !drill.storedType || drill.storedType === oreType;
}

function addStored(drill, oreType) {
  drill.storedType = drill.storedType ?? oreType;
  drill.storedAmount = Math.min(drill.capacity, drill.storedAmount + 1);
}

function updateExtractor(building, definition, mapWorld, dt) {
  const drill = getDrill(building, definition);
  const ore = chooseOre(getOreCounts(mapWorld, building));
  const rate = ore.count / drill.secondsPerMineralPerHex;

  drill.extractedType = ore.type;
  drill.extractedHexCount = ore.count;
  drill.isDrilling = rate > 0 && canStore(drill, ore.type);

  if (!drill.isDrilling) return;

  drill.bladeRotation += dt * Math.PI * 2.4;
  drill.progress += dt * rate;

  while (drill.progress >= 1 && canStore(drill, ore.type)) {
    drill.progress -= 1;
    addStored(drill, ore.type);
  }

  if (!canStore(drill, ore.type)) drill.isDrilling = false;
}

export function extractorSystem(gameState, dt) {
  const { mapWorld } = gameState;

  for (const building of mapWorld.buildings) {
    if (!building.constructed || building.type !== "drill") continue;

    const definition = getBuildingDefinition(building.definitionId);

    if (!definition) continue;

    updateExtractor(building, definition, mapWorld, dt);
  }
}
