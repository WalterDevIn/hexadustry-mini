import { axialToPixel } from "../hex/hexMath.js";
import { createEntity, createWorld, addComponent } from "../ecs/createWorld.js";
import { createInitialWorld, MAP_LAYERS } from "../world/createInitialWorld.js";

const PLAYER_COLOR = {
  stroke: "rgba(255, 226, 64, 0.98)",
  fill: "rgba(255, 226, 64, 0.16)",
  labelColor: "rgba(255, 236, 126, 0.96)",
  aura: "rgba(255, 226, 64, 0.28)",
};

const ENEMY_COLOR = {
  stroke: "rgba(255, 64, 64, 0.98)",
  fill: "rgba(255, 64, 64, 0.14)",
  labelColor: "rgba(255, 120, 120, 0.96)",
  aura: "rgba(255, 64, 64, 0.2)",
};

function createPlayerShip(ecsWorld, mapWorld) {
  const entityId = createEntity(ecsWorld);

  addComponent(ecsWorld, "transform", entityId, {
    x: 0,
    y: 0,
    rotation: -Math.PI / 2,
  });

  addComponent(ecsWorld, "velocity", entityId, {
    x: 0,
    y: 0,
    baseMaxSpeed: 360,
    maxSpeed: 360,
  });

  addComponent(ecsWorld, "mapLayer", entityId, {
    id: MAP_LAYERS.air,
  });

  addComponent(ecsWorld, "playerControlled", entityId, {
    thrust: 560,
    drag: 2.6,
    brakeDrag: 3.3,
    accelerationRampSeconds: 3,
    movementHoldSeconds: 0,
    visualTurnSpeed: Math.PI * 2.4,
    exhaustAccumulator: 0,
    exhaustParticles: [],
  });

  addComponent(ecsWorld, "unitTurret", entityId, {
    relativeRotation: 0,
    turnSpeed: Math.PI * 1.45,
    length: mapWorld.hexSize * 0.86,
    rearRatio: 0.25,
    reloadSeconds: 0.11,
    cooldown: 0,
    projectileSpeed: 900,
    projectileLifetime: 0.58,
    projectileDamage: 12,
  });

  addComponent(ecsWorld, "team", entityId, {
    id: "player",
  });

  addComponent(ecsWorld, "triangleRenderable", entityId, {
    radius: mapWorld.hexSize * 0.4,
    label: "YOU",
    lineWidth: 2,
    equilateral: true,
    showLabel: false,
    ...PLAYER_COLOR,
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
    ...ENEMY_COLOR,
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
    ...ENEMY_COLOR,
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

  const playerEntityId = createPlayerShip(ecsWorld, mapWorld);

  return {
    mapWorld,
    ecsWorld,
    playerEntityId,
    enemyEntityId: null,
    groundEnemyEntityId: null,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      pointerWorld: null,
      primaryFire: false,
    },
    ui: {
      buildMenu: {
        activeCategory: "turrets",
        selectedBlockId: null,
        hoveredHex: null,
        rotationIndex: 0,
      },
    },
    playerAimLock: null,
    time: {
      lastTimestamp: 0,
    },
  };
}
