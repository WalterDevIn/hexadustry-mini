import { queryEntities } from "../ecs/createWorld.js";

export function movementSystem(gameState, dt) {
  const { ecsWorld } = gameState;
  const movableEntities = queryEntities(ecsWorld, ["transform", "velocity"]);

  for (const entityId of movableEntities) {
    const transform = ecsWorld.components.transform.get(entityId);
    const velocity = ecsWorld.components.velocity.get(entityId);

    transform.x += velocity.x * dt;
    transform.y += velocity.y * dt;
  }
}
