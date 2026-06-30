import { addComponent, createEntity } from "../ecs/createWorld.js";
import { MAP_LAYERS } from "../world/createInitialWorld.js";

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotateRelativeTurretToward(turret, shipTransform, target, dt) {
  if (!target) return;

  const dx = target.x - shipTransform.x;
  const dy = target.y - shipTransform.y;

  if (Math.hypot(dx, dy) < 0.001) return;

  const targetWorldRotation = Math.atan2(dy, dx);
  const targetRelativeRotation = normalizeAngle(targetWorldRotation - shipTransform.rotation);
  const delta = normalizeAngle(targetRelativeRotation - turret.relativeRotation);
  const maxStep = turret.turnSpeed * dt;
  const step = Math.max(-maxStep, Math.min(maxStep, delta));

  turret.relativeRotation = normalizeAngle(turret.relativeRotation + step);
}

function getTurretWorldRotation(shipTransform, turret) {
  return normalizeAngle(shipTransform.rotation + turret.relativeRotation);
}

function createTurretProjectile(gameState, shipTransform, turret) {
  const { ecsWorld } = gameState;
  const worldRotation = getTurretWorldRotation(shipTransform, turret);
  const muzzleOffset = turret.length * (1 - turret.rearRatio);
  const muzzleX = shipTransform.x + Math.cos(worldRotation) * muzzleOffset;
  const muzzleY = shipTransform.y + Math.sin(worldRotation) * muzzleOffset;
  const projectileId = createEntity(ecsWorld);

  addComponent(ecsWorld, "transform", projectileId, {
    x: muzzleX,
    y: muzzleY,
    rotation: worldRotation,
  });
  addComponent(ecsWorld, "velocity", projectileId, {
    x: Math.cos(worldRotation) * turret.projectileSpeed,
    y: Math.sin(worldRotation) * turret.projectileSpeed,
    maxSpeed: turret.projectileSpeed,
  });
  addComponent(ecsWorld, "mapLayer", projectileId, {
    id: MAP_LAYERS.air,
  });
  addComponent(ecsWorld, "team", projectileId, {
    id: "player",
  });
  addComponent(ecsWorld, "projectile", projectileId, {
    age: 0,
    lifetime: turret.projectileLifetime,
    damage: turret.projectileDamage,
    radius: 4,
  });
  addComponent(ecsWorld, "lineRenderable", projectileId, {
    length: 13,
    lineWidth: 2,
    stroke: "rgba(255, 236, 126, 0.96)",
  });
}

export function playerTurretSystem(gameState, dt) {
  const { ecsWorld, playerEntityId, input } = gameState;
  const shipTransform = ecsWorld.components.transform.get(playerEntityId);
  const turret = ecsWorld.components.unitTurret.get(playerEntityId);

  if (!shipTransform || !turret) return;

  rotateRelativeTurretToward(turret, shipTransform, input.pointerWorld, dt);

  turret.cooldown = Math.max(0, turret.cooldown - dt);

  if (gameState.playerSpawn?.active) return;
  if (!input.primaryFire || !input.pointerWorld) return;
  if (turret.cooldown > 0) return;

  createTurretProjectile(gameState, shipTransform, turret);
  turret.cooldown = turret.reloadSeconds;
}
