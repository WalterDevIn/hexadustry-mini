function getAxis(input) {
  const axisX = Number(input.right) - Number(input.left);
  const axisY = Number(input.down) - Number(input.up);
  const length = Math.hypot(axisX, axisY);

  if (length === 0) {
    return {
      x: 0,
      y: 0,
      length: 0,
    };
  }

  return {
    x: axisX / length,
    y: axisY / length,
    length,
  };
}

function getAimTarget(gameState) {
  if (gameState.playerAimLock?.target) {
    return gameState.playerAimLock.target;
  }

  return gameState.input.pointerWorld;
}

function pointPlayerAtTarget(transform, target) {
  if (!target) return;

  const dx = target.x - transform.x;
  const dy = target.y - transform.y;

  if (Math.hypot(dx, dy) < 0.001) return;

  transform.rotation = Math.atan2(dy, dx);
}

function getSpeedRampMultiplier(playerControlled) {
  const t = Math.min(
    playerControlled.movementHoldSeconds / playerControlled.accelerationRampSeconds,
    1,
  );

  return 1 + Math.log1p(t * 3) / Math.log1p(3);
}

function applyDrag(velocity, drag, dt) {
  const dragFactor = Math.max(0, 1 - drag * dt);

  velocity.x *= dragFactor;
  velocity.y *= dragFactor;
}

export function playerControlSystem(gameState, dt) {
  const { ecsWorld, input, playerEntityId } = gameState;
  const transform = ecsWorld.components.transform.get(playerEntityId);
  const velocity = ecsWorld.components.velocity.get(playerEntityId);
  const playerControlled = ecsWorld.components.playerControlled.get(playerEntityId);

  if (!transform || !velocity || !playerControlled) return;

  pointPlayerAtTarget(transform, getAimTarget(gameState));

  const axis = getAxis(input);
  const isMoving = axis.length > 0;

  if (isMoving) {
    playerControlled.movementHoldSeconds += dt;

    const speedMultiplier = getSpeedRampMultiplier(playerControlled);
    const currentMaxSpeed = velocity.baseMaxSpeed * speedMultiplier;
    const currentThrust = playerControlled.thrust * speedMultiplier;

    velocity.maxSpeed = currentMaxSpeed;
    velocity.x += axis.x * currentThrust * dt;
    velocity.y += axis.y * currentThrust * dt;

    applyDrag(velocity, playerControlled.drag, dt);
  } else {
    playerControlled.movementHoldSeconds = 0;
    velocity.maxSpeed = velocity.baseMaxSpeed;
    applyDrag(velocity, playerControlled.brakeDrag, dt);
  }

  const speed = Math.hypot(velocity.x, velocity.y);

  if (speed > velocity.maxSpeed) {
    velocity.x = (velocity.x / speed) * velocity.maxSpeed;
    velocity.y = (velocity.y / speed) * velocity.maxSpeed;
  }
}
