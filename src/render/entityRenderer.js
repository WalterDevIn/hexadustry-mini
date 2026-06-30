import { queryEntities } from "../ecs/createWorld.js";
import { DEFAULT_RENDER_COLORS, getSpawnProgress } from "./renderUtils.js";

function drawPlayerExhaust(ctx, particles, screenOrigin) {
  ctx.save();

  for (const particle of particles) {
    const life = particle.age / particle.lifetime;
    const alpha = Math.max(0, 1 - life);

    ctx.beginPath();
    ctx.arc(
      screenOrigin.x + particle.x,
      screenOrigin.y + particle.y,
      particle.radius * (1 - life * 0.35),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(255, 226, 64, ${0.38 * alpha})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawEquilateralTriangle(ctx, radius) {
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(Math.cos((2 * Math.PI) / 3) * radius, Math.sin((2 * Math.PI) / 3) * radius);
  ctx.lineTo(Math.cos((4 * Math.PI) / 3) * radius, Math.sin((4 * Math.PI) / 3) * radius);
  ctx.closePath();
}

function getPlayerEntityAlpha(gameState, team) {
  if (team?.id !== "player") return 1;

  return 0.18 + getSpawnProgress(gameState) * 0.82;
}

function drawUnitTurret(ctx, transform, turret, screenOrigin, alpha = 1) {
  const worldRotation = transform.rotation + turret.relativeRotation;
  const x = screenOrigin.x + transform.x;
  const y = screenOrigin.y + transform.y;
  const rearLength = turret.length * turret.rearRatio;
  const frontLength = turret.length * (1 - turret.rearRatio);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(worldRotation);
  ctx.strokeStyle = "rgba(255, 236, 126, 0.96)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-rearLength, 0);
  ctx.lineTo(frontLength, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 236, 126, 0.9)";
  ctx.fill();
  ctx.restore();
}

function drawTriangleEntity(ctx, entityId, ecsWorld, screenOrigin, gameState) {
  const transform = ecsWorld.components.transform.get(entityId);
  const renderable = ecsWorld.components.triangleRenderable.get(entityId);
  const team = ecsWorld.components.team.get(entityId);
  const playerControlled = ecsWorld.components.playerControlled.get(entityId);
  const turret = ecsWorld.components.unitTurret.get(entityId);
  const radius = renderable.radius;
  const x = screenOrigin.x + transform.x;
  const y = screenOrigin.y + transform.y;
  const entityAlpha = getPlayerEntityAlpha(gameState, team);

  if (team?.id === "player" && playerControlled?.exhaustParticles?.length && entityAlpha >= 0.99) {
    drawPlayerExhaust(ctx, playerControlled.exhaustParticles, screenOrigin);
  }

  ctx.save();
  ctx.globalAlpha = entityAlpha;
  ctx.translate(x, y);
  ctx.rotate(transform.rotation);
  ctx.strokeStyle = renderable.stroke ?? DEFAULT_RENDER_COLORS.stroke;
  ctx.fillStyle = renderable.fill ?? DEFAULT_RENDER_COLORS.fill;
  ctx.lineWidth = renderable.lineWidth;

  if (renderable.equilateral) {
    drawEquilateralTriangle(ctx, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(-radius * 0.78, -radius * 0.66);
    ctx.lineTo(-radius * 0.46, 0);
    ctx.lineTo(-radius * 0.78, radius * 0.66);
    ctx.closePath();
  }

  ctx.fill();
  ctx.stroke();

  if (!renderable.equilateral) {
    ctx.beginPath();
    ctx.moveTo(-radius * 0.24, 0);
    ctx.lineTo(radius * 0.58, 0);
    ctx.stroke();
  }

  ctx.restore();

  if (turret) {
    drawUnitTurret(ctx, transform, turret, screenOrigin, entityAlpha);
  }

  if (renderable.showLabel !== false) {
    ctx.save();
    ctx.globalAlpha = entityAlpha;
    ctx.font = "11px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = renderable.labelColor ?? DEFAULT_RENDER_COLORS.label;
    ctx.fillText(renderable.label, x, y + radius + 14);
    ctx.restore();
  }

  if (team?.id === "player") {
    ctx.save();
    ctx.globalAlpha = entityAlpha;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = renderable.aura ?? DEFAULT_RENDER_COLORS.aura;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCircleEntity(ctx, entityId, ecsWorld, screenOrigin) {
  const transform = ecsWorld.components.transform.get(entityId);
  const renderable = ecsWorld.components.circleRenderable.get(entityId);
  const radius = renderable.radius;
  const x = screenOrigin.x + transform.x;
  const y = screenOrigin.y + transform.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(transform.rotation);
  ctx.strokeStyle = renderable.stroke ?? DEFAULT_RENDER_COLORS.stroke;
  ctx.fillStyle = renderable.fill ?? DEFAULT_RENDER_COLORS.fill;
  ctx.lineWidth = renderable.lineWidth;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radius * 0.9, 0);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.font = "10px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = renderable.labelColor ?? DEFAULT_RENDER_COLORS.label;
  ctx.fillText(renderable.label, x, y + radius + 12);
  ctx.restore();
}

function drawLineEntity(ctx, entityId, ecsWorld, screenOrigin) {
  const transform = ecsWorld.components.transform.get(entityId);
  const renderable = ecsWorld.components.lineRenderable.get(entityId);
  const x = screenOrigin.x + transform.x;
  const y = screenOrigin.y + transform.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(transform.rotation);
  ctx.strokeStyle = renderable.stroke ?? DEFAULT_RENDER_COLORS.stroke;
  ctx.lineWidth = renderable.lineWidth;
  ctx.beginPath();
  ctx.moveTo(-renderable.length * 0.5, 0);
  ctx.lineTo(renderable.length * 0.5, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawEntitiesOnLayer(ctx, ecsWorld, layerId, origin, gameState) {
  const lineEntities = queryEntities(ecsWorld, ["transform", "lineRenderable", "mapLayer"]);

  for (const entityId of lineEntities) {
    if (ecsWorld.components.mapLayer.get(entityId).id === layerId) {
      drawLineEntity(ctx, entityId, ecsWorld, origin);
    }
  }

  const triangleEntities = queryEntities(ecsWorld, ["transform", "triangleRenderable", "mapLayer"]);

  for (const entityId of triangleEntities) {
    if (ecsWorld.components.mapLayer.get(entityId).id === layerId) {
      drawTriangleEntity(ctx, entityId, ecsWorld, origin, gameState);
    }
  }

  const circleEntities = queryEntities(ecsWorld, ["transform", "circleRenderable", "mapLayer"]);

  for (const entityId of circleEntities) {
    if (ecsWorld.components.mapLayer.get(entityId).id === layerId) {
      drawCircleEntity(ctx, entityId, ecsWorld, origin);
    }
  }
}
