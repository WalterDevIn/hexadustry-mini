import { getBuildingDefinition, getBuildingFootprint } from "../content/buildingDefinitions.js";
import { makeHexKey } from "../hex/hexMath.js";
import { maybeGenerateOreVein } from "./oreVeinGeneration.js";

export const MAP_LAYERS = {
  ground: "ground",
  surface: "surface",
  air: "air",
};

export const WORLD_HEX_SIZE = 22;

function createTile(q, r) {
  return {
    q,
    r,
    layers: {
      ground: {
        terrain: "basalt",
        ore: null,
      },
      surface: {
        naturalBlock: null,
        buildingId: null,
        groundUnitId: null,
      },
      air: {
        flyingUnitIds: [],
      },
    },
  };
}

function createWorldTile(world, q, r) {
  const key = makeHexKey(q, r);
  const existingTile = world.tileMap.get(key);

  if (existingTile) return existingTile;

  const tile = createTile(q, r);
  world.tileMap.set(key, tile);

  return tile;
}

function ensureGroundOre(world, q, r) {
  const key = makeHexKey(q, r);
  const tile = world.tileMap.get(key);

  if (tile?.layers.ground.ore) return tile;

  maybeGenerateOreVein(world, q, r);

  return world.tileMap.get(key) ?? tile;
}

function placeNaturalBlock(world, q, r, blockType, hp) {
  const tile = createWorldTile(world, q, r);

  tile.layers.surface.naturalBlock = {
    type: blockType,
    hp,
    generated: false,
  };
}

function getAbsoluteFootprint(q, r, footprint) {
  return footprint.map((hex) => ({
    q: q + hex.q,
    r: r + hex.r,
  }));
}

function placeBuilding(world, building) {
  const footprint = building.footprint ?? [{ q: 0, r: 0 }];
  const occupiedHexes = building.occupiedHexes ?? getAbsoluteFootprint(building.q, building.r, footprint);
  const placedBuilding = {
    ...building,
    footprint,
    occupiedHexes,
    layer: MAP_LAYERS.surface,
  };

  world.buildings.push(placedBuilding);

  for (const hex of occupiedHexes) {
    const tile = createWorldTile(world, hex.q, hex.r);
    tile.layers.surface.buildingId = placedBuilding.id;
  }
}

function placeInitialCore(world, q, r) {
  const definition = getBuildingDefinition("coreBlock");
  const footprint = getBuildingFootprint(definition);
  const occupiedHexes = getAbsoluteFootprint(q, r, footprint);

  placeBuilding(world, {
    id: "core-01",
    definitionId: definition.id,
    type: definition.type,
    q,
    r,
    hp: definition.hp,
    maxHp: definition.maxHp,
    solid: definition.solid,
    directionMode: definition.directionMode,
    footprint,
    occupiedHexes,
    constructed: true,
    cost: { ...definition.cost },
  });
}

export function getTile(world, q, r) {
  const key = makeHexKey(q, r);
  const existingTile = world.tileMap.get(key);

  if (existingTile?.layers.ground.ore) return existingTile;

  const generatedTile = ensureGroundOre(world, q, r);

  return generatedTile ?? existingTile ?? createTile(q, r);
}

export function createInitialWorld() {
  const world = {
    seed: 73291,
    mapRadius: 512,
    hexSize: WORLD_HEX_SIZE,
    tileMap: new Map(),
    generatedChunks: new Set(),
    rockVisualClusters: new Map(),
    rockVisualClusterOccupied: new Set(),
    layers: {
      ground: {
        description: "Suelo: terreno base y minerales.",
      },
      surface: {
        description: "Capa terrestre: unidades terrestres, bloques naturales y bloques construidos.",
      },
      air: {
        description: "Capa aerea: jugador y unidades voladoras.",
      },
    },
    buildings: [],
    pendingConstructions: [],
    pendingDeconstructions: [],
    resources: {
      copper: 260,
      lead: 80,
      carbon: 40,
    },
  };

  world.getOrCreateTile = (q, r) => createWorldTile(world, q, r);

  placeNaturalBlock(world, 3, 0, "stone", 180);
  placeNaturalBlock(world, 4, -1, "stone", 180);
  placeNaturalBlock(world, -5, 3, "scrap", 120);

  placeInitialCore(world, 0, 0);

  return world;
}
