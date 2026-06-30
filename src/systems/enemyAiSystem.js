import { queryEntities } from "../ecs/createWorld.js";

function findEntityByTeam(ecsWorld, teamId) {
  const entities = queryEntities(ecsWorld, ["team", "transform"]);

  return entities.find((entityId) => {
    const team = ecsWorld.components.team.get(entityId);
    return team?.id === teamId;
  });
}

export function enemyAiSystem(gameState, dt) {
  const { ecsWorld } = gameState;
  const enemies = queryEntities(ecsWorld, ["enemyAi", "transform", "velocity"]);

  for (const enemyEntityId of enemies) {
    const enemyAi = ecsWorld.components.enemyAi.get(enemyEntityId);
    const enemyTransform = ecsWorld.components.transform.get(enemyEntityId);
    const enemyVelocity = ecsWorld.components.velocity.get(enemyEntityId);
    const targetEntityId = findEntityByTeam(ecsWorld, enemyAi.targetTeamId);

    if (!targetEntityId) continue;

    const targetTransform = ecsWorld.components.transform.get(targetEntityId);
    const dx = targetTransform.x - enemyTransform.x;
    const dy = targetTransform.y - enemyTransform.y;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance <= enemyAi.stopDistance) {
      enemyVelocity.x *= 0.92;
      enemyVelocity.y *= 0.92;
      continue;
    }

    const directionX = dx / distance;
    const directionY = dy / distance;

    enemyVelocity.x += directionX * enemyAi.acceleration * dt;
    enemyVelocity.y += directionY * enemyAi.acceleration * dt;

    const speed = Math.hypot(enemyVelocity.x, enemyVelocity.y);

    if (speed > enemyVelocity.maxSpeed) {
      enemyVelocity.x = (enemyVelocity.x / speed) * enemyVelocity.maxSpeed;
      enemyVelocity.y = (enemyVelocity.y / speed) * enemyVelocity.maxSpeed;
    }

    enemyTransform.rotation = Math.atan2(enemyVelocity.y, enemyVelocity.x);
  }
}
