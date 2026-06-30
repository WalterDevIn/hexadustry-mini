const WALL_COSTS = {
  small: {
    copper: 8,
    lead: 0,
    graphite: 0,
  },
  large: {
    copper: 24,
    lead: 0,
    graphite: 0,
  },
  huge: {
    copper: 56,
    lead: 0,
    graphite: 8,
  },
};

const HUGE_FOOTPRINT = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const LARGE_TRIANGLE_FOOTPRINT = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
];

const LARGE_TRIANGLE_ROTATIONS = [
  LARGE_TRIANGLE_FOOTPRINT,
  [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
  ],
];

export const BUILDING_DEFINITIONS = {
  basicWall: {
    id: "basicWall",
    type: "wall",
    label: "MURO",
    category: "walls",
    layer: "surface",
    cost: { ...WALL_COSTS.small },
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
    cost: { ...WALL_COSTS.large },
    hp: 360,
    maxHp: 360,
    solid: true,
    directionMode: "two-way",
    snapMouseToFootprintCenter: true,
    footprint: LARGE_TRIANGLE_FOOTPRINT,
    footprintRotations: LARGE_TRIANGLE_ROTATIONS,
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
    cost: { ...WALL_COSTS.huge },
    hp: 840,
    maxHp: 840,
    solid: true,
    directionMode: "none",
    footprint: HUGE_FOOTPRINT,
    buildComponentCount: 7,
    buildSecondsPerComponent: 0.18,
    minimumBuildSeconds: 0.75,
  },
  commonDrill: {
    id: "commonDrill",
    type: "drill",
    label: "TALADRO COMUN",
    category: "extractors",
    layer: "surface",
    cost: {
      copper: 36,
      lead: 0,
      graphite: 0,
    },
    hp: 300,
    maxHp: 300,
    solid: true,
    directionMode: "two-way",
    snapMouseToFootprintCenter: true,
    footprint: LARGE_TRIANGLE_FOOTPRINT,
    footprintRotations: LARGE_TRIANGLE_ROTATIONS,
    drillRate: 1,
    storageCapacity: 10,
    buildComponentCount: 3,
    buildSecondsPerComponent: 0.22,
    minimumBuildSeconds: 0.55,
  },
  coreBlock: {
    id: "coreBlock",
    type: "core",
    label: "NUCLEO",
    category: "support",
    layer: "surface",
    cost: {
      copper: 0,
      lead: 0,
      graphite: 0,
    },
    hp: 1600,
    maxHp: 1600,
    solid: true,
    directionMode: "none",
    footprint: HUGE_FOOTPRINT,
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

export function getBuildingFootprint(definition, rotationIndex = 0) {
  const rotations = definition?.footprintRotations;

  if (rotations?.length) {
    return rotations[rotationIndex % rotations.length];
  }

  return definition?.footprint ?? [{ q: 0, r: 0 }];
}

export function getBuildingRotationCount(definition) {
  return definition?.footprintRotations?.length ?? 1;
}
