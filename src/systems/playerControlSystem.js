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

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotatePlayerTowardTarget(transform, target, maxTurnSpeed, dt) {
  if (!target) return;

  const dx = target.x - transform.x;
  const dy = target.y - transform.y;

  if (Math.hypot(dx, dy) < 0.001) return;

  const targetRotation = Math.atan2(dy, dx);
  const delta = normalizeAngle(targetRotation - transform.rotation);
  const maxStep = maxTurnSpeed * dt;
  const step = Math.max(-maxStep, Math.min(maxStep, delta));

  transform.rotation = normalizeAngle(transform.rotation + step);
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

function spawnExhaustParticle(playerControlled, transform, speedRatio, velocity) {
  const rearX = transform.x - Math.cos(transform.rotation) * 12;
  const rearY = transform.y - Math.sin(transform.rotation) * 12;
  const sideJitter = (Math.random() - 0.5) * 5;
  const sideX = -Math.sin(transform.rotation) * sideJitter;
  const sideY = Math.cos(transform.rotation) * sideJitter;
  const backwardSpeed = 34 + speedRatio * 72;

  playerControlled.exhaustParticles.push({
    x: rearX + sideX,
    y: rearY + sideY,
    vx: velocity.x * 0.18 - Math.cos(transform.rotation) * backwardSpeed,
    vy: velocity.y * 0.18 - Math.sin(transform.rotation) * backwardSpeed,
    age: 0,
    lifetime: 0.22 + Math.random() * 0.18,
    radius: 1.2 + speedRatio * 2.2 + Math.random() * 0.8,
  });
}

function updateExhaustParticles(playerControlled, transform, velocity, dt) {
  const speed = Math.hypot(velocity.x, velocity.y);
  const speedRatio = Math.min(1, speed / Math.max(1, velocity.maxSpeed));

  if (speed > 8) {
    const particlesPerSecond = 8 + speedRatio * 34;

    playerControlled.exhaustAccumulator += particlesPerSecond * dt;

    while (playerControlled.exhaustAccumulator >= 1) {
      spawnExhaustParticle(playerControlled, transform, speedRatio, velocity);
      playerControlled.exhaustAccumulator -= 1;
    }
  } else {
    playerControlled.exhaustAccumulator = 0;
  }

  playerControlled.exhaustParticles = playerControlled.exhaustParticles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
      age: particle.age + dt,
      vx: particle.vx * Math.max(0, 1 - 1.8 * dt),
      vy: particle.vy * Math.max(0, 1 - 1.8 * dt),
    }))
    .filter((particle) => particle.age < particle.lifetime)
    .slice(-90);
}

export function playerControlSystem(gameState, dt) {
  const { ecsWorld, input, playerEntityId } = gameState;
  const transform = ecsWorld.components.transform.get(playerEntityId);
  const velocity = ecsWorld.components.velocity.get(playerEntityId);
  const playerControlled = ecsWorld.components.playerControlled.get(playerEntityId);

  if (!transform || !velocity || !playerControlled) return;

  rotatePlayerTowardTarget(
    transform,
    getAimTarget(gameState),
    playerControlled.visualTurnSpeed,
    dt,
  );

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

  updateExhaustParticles(playerControlled, transform, velocity, dt);
}
