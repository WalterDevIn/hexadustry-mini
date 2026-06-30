import { queryEntities } from "../ecs/createWorld.js";
import { axialToPixel, buildHexPolygon, generateVisibleHexes } from "../hex/hexMath.js";
import { ensureChunksForHexes } from "../world/chunkedCaveGeneration.js";
import { getTile, MAP_LAYERS } from "../world/createInitialWorld.js";

const HEX_VISUAL_SCALE = 0.8;

const ENTITY_GLYPHS = {
  core: "CORE",
  drill: "DRL",
  conveyor: ">>>",
  turret: "TRT",
};

function drawPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.closePath();
}

function drawGroundLayer(ctx, hex, tile, size, origin) {
  const polygon = buildHexPolygon(hex, size, origin);
  const groundLayer = tile.layers.ground;

  drawPath(ctx, polygon.corners);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (groundLayer.ore) {
    ctx.beginPath();
    ctx.arc(polygon.center.x, polygon.center.y, size * 0.16, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fillText("ORE", polygon.center.x, polygon.center.y + size * 0.36);
  }
}

function drawCaveWall(ctx, naturalBlock, size) {
  const radius = size * 0.42;
  const inset = naturalBlock.type === "dense-rock" ? 0 : size * 0.08;

  ctx.strokeStyle = naturalBlock.type === "dense-rock"
    ? "rgba(255, 255, 255, 0.82)"
    : "rgba(255, 255, 255, 0.62)";
  ctx.lineWidth = naturalBlock.type === "dense-rock" ? 2 : 1.5;

  ctx.beginPath();
  ctx.moveTo(-radius + inset, -radius * 0.35);
  ctx.lineTo(-radius * 0.35, -radius + inset);
  ctx.lineTo(radius * 0.45, -radius * 0.78);
  ctx.lineTo(radius - inset, -radius * 0.12);
  ctx.lineTo(radius * 0.58, radius * 0.72);
  ctx.lineTo(-radius * 0.5, radius - inset);
  ctx.lineTo(-radius + inset, radius * 0.28);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-radius * 0.38, -radius * 0.18);
  ctx.lineTo(radius * 0.24, -radius * 0.42);
  ctx.moveTo(-radius * 0.1, radius * 0.34);
  ctx.lineTo(radius * 0.46, radius * 0.08);
  ctx.stroke();
}

function drawSurfaceLayer(ctx, hex, tile, size, origin) {
  const surfaceLayer = tile.layers.surface;

  if (!surfaceLayer.naturalBlock) return;

  const center = axialToPixel(hex, size, origin);
  const radius = size * 0.34;
  const naturalBlock = surfaceLayer.naturalBlock;

  ctx.save();
  ctx.translate(center.x, center.y);

  if (naturalBlock.generated) {
    drawCaveWall(ctx, naturalBlock, size);
  } else {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
  }

  ctx.font = `${Math.floor(size * 0.18)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = naturalBlock.generated
    ? "rgba(255, 255, 255, 0.5)"
    : "rgba(255, 255, 255, 0.72)";
  ctx.fillText(naturalBlock.type.toUpperCase().slice(0, 3), 0, radius + size * 0.22);
  ctx.restore();
}

function drawBuilding(ctx, building, size, origin) {
  const center = axialToPixel(building, size, origin);
  const radius = size * 0.48;

  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
  ctx.lineWidth = 2;

  if (building.type === "core") {
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, radius);
    ctx.stroke();
  } else if (building.type === "drill") {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.55, -radius * 0.55);
    ctx.lineTo(radius * 0.55, radius * 0.55);
    ctx.moveTo(radius * 0.55, -radius * 0.55);
    ctx.lineTo(-radius * 0.55, radius * 0.55);
    ctx.stroke();
  } else if (building.type === "conveyor") {
    ctx.beginPath();
    ctx.moveTo(-radius, -radius * 0.45);
    ctx.lineTo(radius, 0);
    ctx.lineTo(-radius, radius * 0.45);
    ctx.closePath();
    ctx.stroke();
  } else if (building.type === "turret") {
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 1.05, -radius * 0.25);
    ctx.stroke();
  }

  ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(ENTITY_GLYPHS[building.type] ?? "???", 0, radius + size * 0.22);

  ctx.restore();
}

function drawTriangleEntity(ctx, entityId, ecsWorld, screenOrigin) {
  const transform = ecsWorld.components.transform.get(entityId);
  const renderable = ecsWorld.components.triangleRenderable.get(entityId);
  const team = ecsWorld.components.team.get(entityId);
  const radius = renderable.radius;
  const x = screenOrigin.x + transform.x;
  const y = screenOrigin.y + transform.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(transform.rotation);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.74)";
  ctx.lineWidth = renderable.lineWidth;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(-radius * 0.78, -radius * 0.66);
  ctx.lineTo(-radius * 0.46, 0);
  ctx.lineTo(-radius * 0.78, radius * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-radius * 0.24, 0);
  ctx.lineTo(radius * 0.58, 0);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.font = "11px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(renderable.label, x, y + radius + 14);

  if (team?.id === "player") {
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawEntitiesOnLayer(ctx, ecsWorld, layerId, origin) {
  const triangleEntities = queryEntities(ecsWorld, ["transform", "triangleRenderable", "mapLayer"]);

  for (const entityId of triangleEntities) {
    const mapLayer = ecsWorld.components.mapLayer.get(entityId);

    if (mapLayer.id === layerId) {
      drawTriangleEntity(ctx, entityId, ecsWorld, origin);
    }
  }
}

function drawScanlines(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;

  for (let y = 0; y < height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function getCameraTarget(gameState) {
  const playerTransform = gameState.ecsWorld.components.transform.get(gameState.playerEntityId);

  return playerTransform ?? { x: 0, y: 0 };
}

export function createCanvasRenderer(canvas, gameState) {
  const ctx = canvas.getContext("2d");
  const camera = {
    zoom: 1,
  };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    const { mapWorld, ecsWorld } = gameState;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const baseHexSize = Math.max(22, Math.min(width, height) / 22);
    const hexSize = baseHexSize * HEX_VISUAL_SCALE * camera.zoom;
    const cameraTarget = getCameraTarget(gameState);
    const origin = {
      x: width / 2 - cameraTarget.x,
      y: height / 2 - cameraTarget.y,
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#020202";
    ctx.fillRect(0, 0, width, height);

    const visibleHexes = generateVisibleHexes({
      cameraCenter: cameraTarget,
      viewport: { width, height },
      hexSize,
      mapRadius: mapWorld.mapRadius,
      padding: 4,
    });

    ensureChunksForHexes(mapWorld, visibleHexes);

    for (const hex of visibleHexes) {
      const tile = getTile(mapWorld, hex.q, hex.r);
      drawGroundLayer(ctx, hex, tile, hexSize, origin);
    }

    for (const hex of visibleHexes) {
      const tile = getTile(mapWorld, hex.q, hex.r);
      drawSurfaceLayer(ctx, hex, tile, hexSize, origin);
    }

    for (const building of mapWorld.buildings) {
      drawBuilding(ctx, building, hexSize, origin);
    }

    drawEntitiesOnLayer(ctx, ecsWorld, MAP_LAYERS.surface, origin);
    drawEntitiesOnLayer(ctx, ecsWorld, MAP_LAYERS.air, origin);

    drawScanlines(ctx, width, height);
  }

  return {
    resize,
    render,
  };
}
