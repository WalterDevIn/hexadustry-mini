export function playerControlSystem(gameState, dt) {
  const { ecsWorld, input, playerEntityId } = gameState;
  const transform = ecsWorld.components.transform.get(playerEntityId);
  const velocity = ecsWorld.components.velocity.get(playerEntityId);
  const playerControlled = ecsWorld.components.playerControlled.get(playerEntityId);

  if (!transform || !velocity || !playerControlled) return;

  const axisX = Number(input.right) - Number(input.left);
  const axisY = Number(input.down) - Number(input.up);
  const length = Math.hypot(axisX, axisY) || 1;
  const directionX = axisX / length;
  const directionY = axisY / length;

  velocity.x += directionX * playerControlled.thrust * dt;
  velocity.y += directionY * playerControlled.thrust * dt;

  const speed = Math.hypot(velocity.x, velocity.y);

  if (speed > velocity.maxSpeed) {
    velocity.x = (velocity.x / speed) * velocity.maxSpeed;
    velocity.y = (velocity.y / speed) * velocity.maxSpeed;
  }

  velocity.x -= velocity.x * playerControlled.drag * dt;
  velocity.y -= velocity.y * playerControlled.drag * dt;

  if (Math.hypot(velocity.x, velocity.y) > 1) {
    transform.rotation = Math.atan2(velocity.y, velocity.x);
  }
}
