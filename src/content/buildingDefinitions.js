export const BUILDING_DEFINITIONS = {
  basicWall: {
    id: "basicWall",
    type: "wall",
    label: "MURO",
    category: "walls",
    layer: "surface",
    cost: {
      copper: 0,
      lead: 0,
      graphite: 0,
    },
    hp: 120,
    maxHp: 120,
    solid: true,
    directionMode: "none",
    buildComponentCount: 1,
    buildSecondsPerComponent: 0.18,
    minimumBuildSeconds: 0.25,
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
