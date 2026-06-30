import { generateHexDisk, makeHexKey } from "../hex/hexMath.js";

function createTile(q, r) {
  return {
    q,
    r,
    terrain: "basalt",
    ore: null,
    buildingId: null,
  };
}

function placeOre(tileMap, q, r, oreType, amount) {
  const tile = tileMap.get(makeHexKey(q, r));

  if (!tile) return;

  tile.ore = {
    type: oreType,
    amount,
  };
}

function placeBuilding(world, building) {
  const tile = world.tileMap.get(makeHexKey(building.q, building.r));

  if (!tile) return;

  world.buildings.push(building);
  tile.buildingId = building.id;
}

export function createInitialWorld() {
  const hexes = generateHexDisk(7);
  const tileMap = new Map();

  for (const hex of hexes) {
    tileMap.set(makeHexKey(hex.q, hex.r), createTile(hex.q, hex.r));
  }

  const world = {
    mapRadius: 7,
    hexes,
    tileMap,
    buildings: [],
    enemies: [
      {
        id: "enemy-01",
        type: "crawler",
        q: -6,
        r: 2,
        hp: 40,
        maxHp: 40,
        targetBuildingId: "core-01",
      },
    ],
    resources: {
      copper: 0,
    },
  };

  placeOre(tileMap, -3, 1, "copper", 800);
  placeOre(tileMap, -2, 1, "copper", 650);
  placeOre(tileMap, -2, 2, "copper", 620);
  placeOre(tileMap, 2, -3, "copper", 500);

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
