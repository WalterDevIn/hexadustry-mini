import { axialToPixel } from "../hex/hexMath.js";
import { createEntity, createWorld, addComponent } from "../ecs/createWorld.js";
import { createInitialWorld, MAP_LAYERS } from "../world/createInitialWorld.js";

function createPlayerShip(ecsWorld) {
  const entityId = createEntity(ecsWorld);

  addComponent(ecsWorld, "transform", entityId, {
    x: 0,
    y: 0,
    rotation: -Math.PI / 2,
  });

  addComponent(ecsWorld, "velocity", entityId, {
    x: 0,
    y: 0,
    maxSpeed: 180,
  });

  addComponent(ecsWorld, "mapLayer", entityId, {
    id: MAP_LAYERS.air,
  });

  addComponent(ecsWorld, "playerControlled", entityId, {
    thrust: 260,
    drag: 4.5,
  });

  addComponent(ecsWorld, "team", entityId, {
    id: "player",
  });

  addComponent(ecsWorld, "triangleRenderable", entityId, {
    radius: 16,
    label: "YOU",
    lineWidth: 2,
  });

  addComponent(ecsWorld, "health", entityId, {
    hp: 100,
    maxHp: 100,
  });

  return entityId;
}

function createEnemyShip(ecsWorld) {
  const entityId = createEntity(ecsWorld);

  addComponent(ecsWorld, "transform", entityId, {
    x: 190,
    y: -90,
    rotation: Math.PI / 2,
  });

  addComponent(ecsWorld, "velocity", entityId, {
    x: 0,
    y: 0,
    maxSpeed: 92,
  });

  addComponent(ecsWorld, "mapLayer", entityId, {
    id: MAP_LAYERS.air,
  });

  addComponent(ecsWorld, "enemyAi", entityId, {
    targetTeamId: "player",
    acceleration: 90,
    stopDistance: 46,
  });

  addComponent(ecsWorld, "team", entityId, {
    id: "enemy",
  });

  addComponent(ecsWorld, "triangleRenderable", entityId, {
    radius: 15,
    label: "ENM",
    lineWidth: 2,
  });

  addComponent(ecsWorld, "health", entityId, {
    hp: 40,
    maxHp: 40,
  });

  return entityId;
}

function createGroundEnemy(ecsWorld, mapWorld) {
  const entityId = createEntity(ecsWorld);
  const hexPosition = { q: 10, r: -6 };
  const pixelPosition = axialToPixel(hexPosition, mapWorld.hexSize);

  addComponent(ecsWorld, "hexPosition", entityId, {
    ...hexPosition,
    targetQ: hexPosition.q,
    targetR: hexPosition.r,
    progress: 1,
  });

  addComponent(ecsWorld, "transform", entityId, {
    x: pixelPosition.x,
    y: pixelPosition.y,
    rotation: 0,
  });

  addComponent(ecsWorld, "mapLayer", entityId, {
    id: MAP_LAYERS.surface,
  });

  addComponent(ecsWorld, "groundEnemyAi", entityId, {
    targetTeamId: "player",
    stepCooldown: 0,
    stepInterval: 0.38,
    moveProgress: 1,
  });

  addComponent(ecsWorld, "team", entityId, {
    id: "enemy",
  });

  addComponent(ecsWorld, "circleRenderable", entityId, {
    radius: 9,
    label: "GRD",
    lineWidth: 2,
  });

  addComponent(ecsWorld, "health", entityId, {
    hp: 55,
    maxHp: 55,
  });

  return entityId;
}

export function createInitialGameState() {
  const ecsWorld = createWorld();
  const mapWorld = createInitialWorld();

  const playerEntityId = createPlayerShip(ecsWorld);
  const enemyEntityId = createEnemyShip(ecsWorld);
  const groundEnemyEntityId = createGroundEnemy(ecsWorld, mapWorld);

  return {
    mapWorld,
    ecsWorld,
    playerEntityId,
    enemyEntityId,
    groundEnemyEntityId,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    time: {
      lastTimestamp: 0,
    },
  };
}
