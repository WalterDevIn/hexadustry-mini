import { makeHexKey } from "../hex/hexMath.js";

export const MAP_LAYERS = {
  ground: "ground",
  surface: "surface",
  air: "air",
};

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

function placeOre(world, q, r, oreType, amount) {
  const tile = createWorldTile(world, q, r);

  tile.layers.ground.ore = {
    type: oreType,
    amount,
  };
}

function placeNaturalBlock(world, q, r, blockType, hp) {
  const tile = createWorldTile(world, q, r);

  tile.layers.surface.naturalBlock = {
    type: blockType,
    hp,
    generated: false,
  };
}

function placeBuilding(world, building) {
  const tile = createWorldTile(world, building.q, building.r);

  world.buildings.push({
    ...building,
    layer: MAP_LAYERS.surface,
  });
  tile.layers.surface.buildingId = building.id;
}

export function getTile(world, q, r) {
  const key = makeHexKey(q, r);
  return world.tileMap.get(key) ?? createTile(q, r);
}

export function createInitialWorld() {
  const world = {
    seed: 73291,
    mapRadius: 512,
    tileMap: new Map(),
    generatedChunks: new Set(),
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
    resources: {
      copper: 0,
    },
  };

  world.getOrCreateTile = (q, r) => createWorldTile(world, q, r);

  placeOre(world, -3, 1, "copper", 800);
  placeOre(world, -2, 1, "copper", 650);
  placeOre(world, -2, 2, "copper", 620);
  placeOre(world, 2, -3, "copper", 500);
  placeOre(world, 12, -5, "copper", 900);
  placeOre(world, -15, 8, "copper", 760);

  placeNaturalBlock(world, 3, 0, "stone", 180);
  placeNaturalBlock(world, 4, -1, "stone", 180);
  placeNaturalBlock(world, -5, 3, "scrap", 120);

  placeBuilding(world, {
    id: "core-01",
    type: "core",
    q: 0,
    r: 0,
    hp: 500,
    maxHp: 500,
  });

  placeBuilding(world, {
    id: "drill-01",
    type: "drill",
    q: -2,
    r: 1,
    resourceType: "copper",
    progress: 0,
  });

  placeBuilding(world, {
    id: "conveyor-01",
    type: "conveyor",
    q: -1,
    r: 1,
    direction: 0,
  });

  placeBuilding(world, {
    id: "conveyor-02",
    type: "conveyor",
    q: 0,
    r: 1,
    direction: 1,
  });

  placeBuilding(world, {
    id: "turret-01",
    type: "turret",
    q: 1,
    r: -1,
    range: 3,
    reload: 0,
  });

  return world;
}
