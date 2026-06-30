const FREE_WALL_COST = {
  copper: 0,
  lead: 0,
  graphite: 0,
};

export const BUILDING_DEFINITIONS = {
  basicWall: {
    id: "basicWall",
    type: "wall",
    label: "MURO",
    category: "walls",
    layer: "surface",
    cost: { ...FREE_WALL_COST },
    hp: 120,
    maxHp: 120,
    solid: true,
    directionMode: "none",
    footprint: [{ q: 0, r: 0 }],
    buildComponentCount: 1,
    buildSecondsPerComponent: 0.18,
    minimumBuildSeconds: 0.25,
  },
  largeWall: {
    id: "largeWall",
    type: "wall",
    label: "MURO GRANDE",
    category: "walls",
    layer: "surface",
    cost: { ...FREE_WALL_COST },
    hp: 360,
    maxHp: 360,
    solid: true,
    directionMode: "none",
    footprint: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 1, r: -1 },
    ],
    buildComponentCount: 3,
    buildSecondsPerComponent: 0.18,
    minimumBuildSeconds: 0.45,
  },
  hugeWall: {
    id: "hugeWall",
    type: "wall",
    label: "MURO ENORME",
    category: "walls",
    layer: "surface",
    cost: { ...FREE_WALL_COST },
    hp: 840,
    maxHp: 840,
    solid: true,
    directionMode: "none",
    footprint: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ],
    buildComponentCount: 7,
    buildSecondsPerComponent: 0.18,
    minimumBuildSeconds: 0.75,
  },
};

export function getBuildingDefinition(buildingId) {
  return BUILDING_DEFINITIONS[buildingId] ?? null;
}

export function getBuildingsByCategory(categoryId) {
  return Object.values(BUILDING_DEFINITIONS).filter((definition) => definition.category === categoryId);
}

export function getBuildCostTotal(cost) {
  return Object.values(cost).reduce((total, amount) => total + amount, 0);
}

export function getBuildTime(definition) {
  const componentTime = definition.buildComponentCount * definition.buildSecondsPerComponent;

  return Math.max(definition.minimumBuildSeconds, componentTime);
}

export function getBuildingFootprint(definition) {
  return definition?.footprint ?? [{ q: 0, r: 0 }];
}
