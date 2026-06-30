export function createWorld() {
  return {
    nextEntityId: 1,
    entities: new Set(),
    components: {
      transform: new Map(),
      velocity: new Map(),
      hexPosition: new Map(),
      mapLayer: new Map(),
      playerControlled: new Map(),
      enemyAi: new Map(),
      groundEnemyAi: new Map(),
      team: new Map(),
      triangleRenderable: new Map(),
      circleRenderable: new Map(),
      health: new Map(),
    },
  };
}

export function createEntity(world) {
  const entityId = world.nextEntityId;
  world.nextEntityId += 1;
  world.entities.add(entityId);

  return entityId;
}

export function addComponent(world, componentName, entityId, component) {
  const componentStore = world.components[componentName];

  if (!componentStore) {
    throw new Error(`Componente desconocido: ${componentName}`);
  }

  componentStore.set(entityId, component);

  return component;
}

export function removeEntity(world, entityId) {
  world.entities.delete(entityId);

  for (const componentStore of Object.values(world.components)) {
    componentStore.delete(entityId);
  }
}

export function queryEntities(world, componentNames) {
  const [firstComponentName, ...restComponentNames] = componentNames;
  const firstStore = world.components[firstComponentName];

  if (!firstStore) {
    throw new Error(`Componente desconocido: ${firstComponentName}`);
  }

  const result = [];

  for (const entityId of firstStore.keys()) {
    const hasAllComponents = restComponentNames.every((componentName) => {
      const componentStore = world.components[componentName];
      return componentStore?.has(entityId);
    });

    if (hasAllComponents) {
      result.push(entityId);
    }
  }

  return result;
}
