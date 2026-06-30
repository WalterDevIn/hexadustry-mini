import { queryEntities } from "../ecs/createWorld.js";
import { axialToPixel, buildHexPolygon, generateVisibleHexes, hexCorner, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { ensureChunksForHexes } from "../world/chunkedCaveGeneration.js";
import { getTile, MAP_LAYERS } from "../world/createInitialWorld.js";

const DEFAULT_RENDER_COLORS = {
  stroke: "rgba(255, 255, 255, 0.96)",
  fill: "rgba(0, 0, 0, 0.74)",
  label: "rgba(255, 255, 255, 0.9)",
  aura: "rgba(255, 255, 255, 0.22)",
};

const PLAYER_YELLOW = {
  stroke: "rgba(255, 226, 64, 0.98)",
  fill: "rgba(255, 226, 64, 0.12)",
  detail: "rgba(255, 236, 126, 0.78)",
};

const ENTITY_GLYPHS = {
  core: "CORE",
  drill: "DRL",
  conveyor: ">>>",
  turret: "TRT",
  wall: "WALL",
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

function makeRelativeKey(q, r) {
  return `${q},${r}`;
}

function getWallFootprint(source) {
  return source.footprint ?? [{ q: 0, r: 0 }];
}

function getWallCorners(relativeHex, size, radiusScale) {
  const center = axialToPixel(relativeHex, size);
  const corners = [];

  for (let i = 0; i < 6; i += 1) {
    corners.push(hexCorner(center, size * radiusScale, i));
  }

  return corners;
}

function drawCornerHexFrame(ctx, corners, segmentRatio) {
  for (let i = 0; i < corners.length; i += 1) {
    const previous = corners[(i + corners.length - 1) % corners.length];
    const current = corners[i];
    const next = corners[(i + 1) % corners.length];
    const towardPrevious = {
      x: current.x + (previous.x - current.x) * segmentRatio,
      y: current.y + (previous.y - current.y) * segmentRatio,
    };
    const towardNext = {
      x: current.x + (next.x - current.x) * segmentRatio,
      y: current.y + (next.y - current.y) * segmentRatio,
    };

    ctx.beginPath();
    ctx.moveTo(towardPrevious.x, towardPrevious.y);
    ctx.lineTo(current.x, current.y);
    ctx.lineTo(towardNext.x, towardNext.y);
    ctx.stroke();
  }
}

function drawWallExterior(ctx, footprint, size, alpha) {
  const footprintKeys = new Set(footprint.map((hex) => makeRelativeKey(hex.q, hex.r)));

  ctx.fillStyle = `rgba(255, 226, 64, ${0.04 * alpha})`;

  for (const hex of footprint) {
    drawPath(ctx, getWallCorners(hex, size, 1));
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(255, 226, 64, ${0.98 * alpha})`;
  ctx.lineWidth = 2.2;

  for (const hex of footprint) {
    const corners = getWallCorners(hex, size, 1);

    for (let directionIndex = 0; directionIndex < HEX_DIRECTIONS.length; directionIndex += 1) {
      const direction = HEX_DIRECTIONS[directionIndex];
      const neighborKey = makeRelativeKey(hex.q + direction.q, hex.r + direction.r);

      if (footprintKeys.has(neighborKey)) continue;

      const start = corners[directionIndex];
      const end = corners[(directionIndex + 1) % corners.length];

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }
}

function drawSingleWallInnerFrame(ctx, size, alpha) {
  const innerCorners = [];

  for (let i = 0; i < 6; i += 1) {
    innerCorners.push(hexCorner({ x: 0, y: 0 }, size * 0.56, i));
  }

  ctx.strokeStyle = `rgba(255, 236, 126, ${0.76 * alpha})`;
  ctx.lineWidth = 1.5;
  drawCornerHexFrame(ctx, innerCorners, 0.24);
}

function drawLargeWallDetail(ctx, footprint, size, alpha) {
  if (footprint.length <= 1) {
    drawSingleWallInnerFrame(ctx, size, alpha);
    return;
  }

  ctx.strokeStyle = `rgba(255, 236, 126, ${0.58 * alpha})`;
  ctx.lineWidth = 1.4;

  ctx.beginPath();
  ctx.moveTo(-size * 0.34, -size * 0.16);
  ctx.lineTo(size * 0.42, -size * 0.34);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.06, size * 0.46);
  ctx.lineTo(size * 0.84, size * 0.18);
  ctx.stroke();
}

function drawHexWallShape(ctx, source, size, alpha = 1) {
  const footprint = getWallFootprint(source);

  drawWallExterior(ctx, footprint, size, alpha);
  drawLargeWallDetail(ctx, footprint, size, alpha);
}

function drawCaveWall(ctx, naturalBlock, size) {
  const corners = [];
  const isDenseRock = naturalBlock.type === "dense-rock";

  for (let i = 0; i < 6; i += 1) {
    corners.push(hexCorner({ x: 0, y: 0 }, size * 0.96, i));
  }

  ctx.fillStyle = isDenseRock
    ? "rgba(255, 255, 255, 0.09)"
    : "rgba(255, 255, 255, 0.045)";
  ctx.strokeStyle = isDenseRock
    ? "rgba(255, 255, 255, 0.88)"
    : "rgba(255, 255, 255, 0.68)";
  ctx.lineWidth = isDenseRock ? 2.2 : 1.6;

  drawPath(ctx, corners);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = isDenseRock
    ? "rgba(255, 255, 255, 0.72)"
    : "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = isDenseRock ? 1.8 : 1.3;

  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.16);
  ctx.lineTo(-size * 0.16, -size * 0.38);
  ctx.lineTo(size * 0.34, -size * 0.14);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-size * 0.32, size * 0.34);
  ctx.lineTo(size * 0.04, size * 0.12);
  ctx.lineTo(size * 0.5, size * 0.28);
  ctx.stroke();

  if (isDenseRock) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.08, -size * 0.02);
    ctx.lineTo(size * 0.18, size * 0.18);
    ctx.stroke();
  }
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

    ctx.font = `${Math.floor(size * 0.18)}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.fillText(naturalBlock.type.toUpperCase().slice(0, 3), 0, radius + size * 0.22);
  }

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
  } else if (building.type === "wall") {
    drawHexWallShape(ctx, building, size, 1);
  }

  ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = building.type === "wall" ? PLAYER_YELLOW.detail : "rgba(255, 255, 255, 0.95)";
  ctx.fillText(ENTITY_GLYPHS[building.type] ?? "???", 0, radius + size * 0.22);

  ctx.restore();
}

function drawPendingConstruction(ctx, construction, size, origin) {
  const center = axialToPixel(construction, size, origin);
  const progress = Math.min(1, construction.elapsed / construction.totalTime);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.globalAlpha = 0.32 + progress * 0.34;
  drawHexWallShape(ctx, construction, size, 0.7);

  ctx.font = `${Math.floor(size * 0.18)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(255, 236, 126, ${0.72 + progress * 0.2})`;
  ctx.fillText(`${Math.round(progress * 100)}%`, 0, size * 0.54);
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

  ctx.strokeStyle = renderable.stroke ?? DEFAULT_RENDER_COLORS.stroke;
  ctx.fillStyle = renderable.fill ?? DEFAULT_RENDER_COLORS.fill;
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
  ctx.fillStyle = renderable.labelColor ?? DEFAULT_RENDER_COLORS.label;
  ctx.fillText(renderable.label, x, y + radius + 14);

  if (team?.id === "player") {
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.strokeStyle = renderable.aura ?? DEFAULT_RENDER_COLORS.aura;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
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

function drawEntitiesOnLayer(ctx, ecsWorld, layerId, origin) {
  const triangleEntities = queryEntities(ecsWorld, ["transform", "triangleRenderable", "mapLayer"]);

  for (const entityId of triangleEntities) {
    const mapLayer = ecsWorld.components.mapLayer.get(entityId);

    if (mapLayer.id === layerId) {
      drawTriangleEntity(ctx, entityId, ecsWorld, origin);
    }
  }

  const circleEntities = queryEntities(ecsWorld, ["transform", "circleRenderable", "mapLayer"]);

  for (const entityId of circleEntities) {
    const mapLayer = ecsWorld.components.mapLayer.get(entityId);

    if (mapLayer.id === layerId) {
      drawCircleEntity(ctx, entityId, ecsWorld, origin);
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
    const hexSize = mapWorld.hexSize * camera.zoom;
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

    for (const construction of mapWorld.pendingConstructions) {
      drawPendingConstruction(ctx, construction, hexSize, origin);
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
