import { createEntity, createWorld, addComponent } from "../ecs/createWorld.js";
import { createInitialWorld, MAP_LAYERS } from "../world/createInitialWorld.js";

const PLAYER_COLOR = {
  stroke: "rgba(255, 226, 64, 0.98)",
  fill: "rgba(255, 226, 64, 0.16)",
  labelColor: "rgba(255, 236, 126, 0.96)",
  aura: "rgba(255, 226, 64, 0.28)",
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
    playerSpawn: {
      active: true,
      elapsed: 0,
      duration: 3,
    },
    time: {
      lastTimestamp: 0,
    },
  };
}
