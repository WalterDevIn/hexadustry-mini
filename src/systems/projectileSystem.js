import { queryEntities, removeEntity } from "../ecs/createWorld.js";

function getProjectileCollisionRadius(ecsWorld, entityId) {
  return ecsWorld.components.circleRenderable.get(entityId)?.radius
    ?? ecsWorld.components.triangleRenderable.get(entityId)?.radius
    ?? 10;
}

function canDamage(projectileTeam, targetTeam) {
  if (!targetTeam) return false;

  return projectileTeam?.id !== targetTeam.id;
}

function findProjectileHit(ecsWorld, projectileEntityId) {
  const projectileTransform = ecsWorld.components.transform.get(projectileEntityId);
  const projectile = ecsWorld.components.projectile.get(projectileEntityId);
  const projectileTeam = ecsWorld.components.team.get(projectileEntityId);
  const candidates = queryEntities(ecsWorld, ["transform", "health", "team"]);

  for (const targetEntityId of candidates) {
    if (targetEntityId === projectileEntityId) continue;

    const targetTeam = ecsWorld.components.team.get(targetEntityId);

    if (!canDamage(projectileTeam, targetTeam)) continue;

    const targetTransform = ecsWorld.components.transform.get(targetEntityId);
    const hitRadius = projectile.radius + getProjectileCollisionRadius(ecsWorld, targetEntityId);
    const distance = Math.hypot(
      targetTransform.x - projectileTransform.x,
      targetTransform.y - projectileTransform.y,
    );

    if (distance <= hitRadius) return targetEntityId;
  }

  return null;
}

export function projectileSystem(gameState, dt) {
  const { ecsWorld } = gameState;
  const projectileEntities = queryEntities(ecsWorld, ["projectile", "transform"]);
  const toRemove = new Set();

  for (const projectileEntityId of projectileEntities) {
    const projectile = ecsWorld.components.projectile.get(projectileEntityId);

    projectile.age += dt;

    if (projectile.age >= projectile.lifetime) {
      toRemove.add(projectileEntityId);
      continue;
    }

    const hitEntityId = findProjectileHit(ecsWorld, projectileEntityId);

    if (!hitEntityId) continue;

    const health = ecsWorld.components.health.get(hitEntityId);
    health.hp -= projectile.damage;
    toRemove.add(projectileEntityId);

    if (health.hp <= 0) {
      toRemove.add(hitEntityId);
    }
  }

  for (const entityId of toRemove) {
    removeEntity(ecsWorld, entityId);
  }
}
