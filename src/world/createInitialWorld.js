import { makeHexKey } from "../hex/hexMath.js";

function createTile(q, r) {
  return {
    q,
    r,
    terrain: "basalt",
    ore: null,
    buildingId: null,
  };
}

function getOrCreateTile(tileMap, q, r) {
  const key = makeHexKey(q, r);
  const existingTile = tileMap.get(key);

  if (existingTile) return existingTile;

  const tile = createTile(q, r);
  tileMap.set(key, tile);

  return tile;
}

function placeOre(tileMap, q, r, oreType, amount) {
  const tile = getOrCreateTile(tileMap, q, r);

  tile.ore = {
    type: oreType,
    amount,
  };
}

function placeBuilding(world, building) {
  const tile = getOrCreateTile(world.tileMap, building.q, building.r);

  world.buildings.push(building);
  tile.buildingId = building.id;
}

export function getTile(world, q, r) {
  const key = makeHexKey(q, r);
  return world.tileMap.get(key) ?? createTile(q, r);
}

export function createInitialWorld() {
  const world = {
    mapRadius: 512,
    tileMap: new Map(),
    buildings: [],
    resources: {
      copper: 0,
    },
  };

  placeOre(world.tileMap, -3, 1, "copper", 800);
  placeOre(world.tileMap, -2, 1, "copper", 650);
  placeOre(world.tileMap, -2, 2, "copper", 620);
  placeOre(world.tileMap, 2, -3, "copper", 500);
  placeOre(world.tileMap, 12, -5, "copper", 900);
  placeOre(world.tileMap, -15, 8, "copper", 760);

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
