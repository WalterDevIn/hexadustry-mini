import { getBuildingDefinition, getBuildingFootprint } from "../content/buildingDefinitions.js";
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
  detail: "rgba(255, 236, 126, 0.88)",
};

const ROCK_CLUSTER_FOOTPRINTS = {
  single: [{ q: 0, r: 0 }],
  largeA: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
  ],
  largeB: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
  ],
  huge: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ],
};

const HEX_EDGE_BY_DIRECTION = [0, 5, 4, 3, 2, 1];

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
  const groundLayer = tile.layers.ground;

  if (!groundLayer.ore) return;

  const polygon = buildHexPolygon(hex, size, origin);

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

function makeRelativeKey(q, r) {
  return `${q},${r}`;
}

function makeHexKeyFromHex(hex) {
  return makeRelativeKey(hex.q, hex.r);
}

function getWallFootprint(source) {
  return source.footprint ?? [{ q: 0, r: 0 }];
}

function getWallCorners(relativeHex, size) {
  const center = axialToPixel(relativeHex, size);
  const corners = [];

  for (let i = 0; i < 6; i += 1) {
    corners.push(hexCorner(center, size, i));
  }

  return corners;
}

function getWallBoundarySegments(footprint, size) {
  const footprintKeys = new Set(footprint.map((hex) => makeRelativeKey(hex.q, hex.r)));
  const segments = [];

  for (const hex of footprint) {
    const corners = getWallCorners(hex, size);

    for (let directionIndex = 0; directionIndex < HEX_DIRECTIONS.length; directionIndex += 1) {
      const direction = HEX_DIRECTIONS[directionIndex];
      const neighborKey = makeRelativeKey(hex.q + direction.q, hex.r + direction.r);

      if (footprintKeys.has(neighborKey)) continue;

      const edgeIndex = HEX_EDGE_BY_DIRECTION[directionIndex];
      segments.push({
        start: corners[edgeIndex],
        end: corners[(edgeIndex + 1) % corners.length],
      });
    }
  }

  return segments;
}

function getWallCenter(footprint, size) {
  const total = footprint.reduce(
    (sum, hex) => {
      const center = axialToPixel(hex, size);

      return {
        x: sum.x + center.x,
        y: sum.y + center.y,
      };
    },
    { x: 0, y: 0 },
  );

  return {
    x: total.x / footprint.length,
    y: total.y / footprint.length,
  };
}

function insetPointToward(point, target, insetPixels) {
  const dx = target.x - point.x;
  const dy = target.y - point.y;
  const distance = Math.hypot(dx, dy);

  if (distance < 0.001) return point;

  return {
    x: point.x + (dx / distance) * insetPixels,
    y: point.y + (dy / distance) * insetPixels,
  };
}

function insetSegmentsToward(segments, target, insetPixels) {
  return segments.map((segment) => ({
    start: insetPointToward(segment.start, target, insetPixels),
    end: insetPointToward(segment.end, target, insetPixels),
  }));
}

function strokeSegments(ctx, segments) {
  for (const segment of segments) {
    ctx.beginPath();
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(segment.end.x, segment.end.y);
    ctx.stroke();
  }
}

function strokeCornerSegments(ctx, segments, cornerRatio) {
  for (const segment of segments) {
    const startPieceEnd = {
      x: segment.start.x + (segment.end.x - segment.start.x) * cornerRatio,
      y: segment.start.y + (segment.end.y - segment.start.y) * cornerRatio,
    };
    const endPieceStart = {
      x: segment.end.x + (segment.start.x - segment.end.x) * cornerRatio,
      y: segment.end.y + (segment.start.y - segment.end.y) * cornerRatio,
    };

    ctx.beginPath();
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(startPieceEnd.x, startPieceEnd.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(endPieceStart.x, endPieceStart.y);
    ctx.lineTo(segment.end.x, segment.end.y);
    ctx.stroke();
  }
}

function fillWallFootprint(ctx, footprint, size, alpha) {
  ctx.fillStyle = `rgba(255, 226, 64, ${0.06 * alpha})`;

  for (const hex of footprint) {
    drawPath(ctx, getWallCorners(hex, size));
    ctx.fill();
  }
}

function getInnerWallInset(size) {
  return Math.min(5.5, Math.max(3.5, size * 0.18));
}

function drawHexWallShape(ctx, source, size, alpha = 1) {
  const footprint = getWallFootprint(source);
  const wallCenter = getWallCenter(footprint, size);
  const outerSegments = getWallBoundarySegments(footprint, size);
  const innerSegments = insetSegmentsToward(outerSegments, wallCenter, getInnerWallInset(size));

  fillWallFootprint(ctx, footprint, size, alpha);

  ctx.strokeStyle = `rgba(255, 226, 64, ${0.98 * alpha})`;
  ctx.lineWidth = 2.25;
  strokeSegments(ctx, outerSegments);

  ctx.strokeStyle = `rgba(255, 236, 126, ${0.96 * alpha})`;
  ctx.lineWidth = 1.75;
  strokeCornerSegments(ctx, innerSegments, 0.28);
}

function getRockClusterStyle(naturalBlockType, alpha) {
  if (naturalBlockType === "dense-rock") {
    return {
      fill: `rgba(255, 255, 255, ${0.08 * alpha})`,
      stroke: `rgba(255, 255, 255, ${0.84 * alpha})`,
      lineWidth: 2.1,
    };
  }

  return {
    fill: `rgba(255, 255, 255, ${0.04 * alpha})`,
    stroke: `rgba(255, 255, 255, ${0.58 * alpha})`,
    lineWidth: 1.5,
  };
}

function fillRockFootprint(ctx, footprint, size, fillStyle) {
  ctx.fillStyle = fillStyle;

  for (const hex of footprint) {
    drawPath(ctx, getWallCorners(hex, size * 0.98));
    ctx.fill();
  }
}

function drawRockClusterShape(ctx, footprint, naturalBlockType, size, alpha = 1) {
  const style = getRockClusterStyle(naturalBlockType, alpha);
  const outerSegments = getWallBoundarySegments(footprint, size * 0.98);

  fillRockFootprint(ctx, footprint, size, style.fill);

  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;
  strokeSegments(ctx, outerSegments);
}

function getStableHash(q, r, seed = 0) {
  let hash = (q * 374761393 + r * 668265263 + seed * 2246822519) | 0;
  hash = (hash ^ (hash >>> 13)) * 1274126177;

  return (hash ^ (hash >>> 16)) >>> 0;
}

function getRockClusterPreference(q, r, seed) {
  const roll = getStableHash(q, r, seed) % 100;

  if (roll < 18) return ["huge", "largeA", "largeB", "single"];
  if (roll < 58) return ["largeA", "largeB", "huge", "single"];
  if (roll < 82) return ["largeB", "largeA", "huge", "single"];

  return ["single"];
}

function getGeneratedNaturalBlock(mapWorld, q, r) {
  const naturalBlock = getTile(mapWorld, q, r).layers.surface.naturalBlock;

  if (!naturalBlock?.generated) return null;

  return naturalBlock;
}

function canPlaceRockVisualCluster(mapWorld, anchor, footprint, consumedKeys, naturalBlockType) {
  for (const relativeHex of footprint) {
    const q = anchor.q + relativeHex.q;
    const r = anchor.r + relativeHex.r;
    const key = makeRelativeKey(q, r);
    const naturalBlock = getGeneratedNaturalBlock(mapWorld, q, r);

    if (consumedKeys.has(key)) return false;
    if (naturalBlock?.type !== naturalBlockType) return false;
  }

  return true;
}

function consumeRockVisualCluster(anchor, footprint, consumedKeys) {
  for (const relativeHex of footprint) {
    consumedKeys.add(makeRelativeKey(anchor.q + relativeHex.q, anchor.r + relativeHex.r));
  }
}

function chooseRockVisualFootprint(mapWorld, anchor, naturalBlockType, consumedKeys) {
  const preferredFootprints = getRockClusterPreference(anchor.q, anchor.r, mapWorld.seed);

  for (const footprintId of preferredFootprints) {
    const footprint = ROCK_CLUSTER_FOOTPRINTS[footprintId];

    if (canPlaceRockVisualCluster(mapWorld, anchor, footprint, consumedKeys, naturalBlockType)) {
      return footprint;
    }
  }

  return ROCK_CLUSTER_FOOTPRINTS.single;
}

function drawGeneratedRockClusters(ctx, mapWorld, visibleHexes, size, origin) {
  const consumedKeys = new Set();
  const sortedHexes = [...visibleHexes].sort((a, b) => a.q - b.q || a.r - b.r);

  for (const hex of sortedHexes) {
    const key = makeHexKeyFromHex(hex);
    const naturalBlock = getGeneratedNaturalBlock(mapWorld, hex.q, hex.r);

    if (!naturalBlock || consumedKeys.has(key)) continue;

    const footprint = chooseRockVisualFootprint(mapWorld, hex, naturalBlock.type, consumedKeys);
    const center = axialToPixel(hex, size, origin);

    consumeRockVisualCluster(hex, footprint, consumedKeys);

    ctx.save();
    ctx.translate(center.x, center.y);
    drawRockClusterShape(ctx, footprint, naturalBlock.type, size, 1);
    ctx.restore();
  }
}

function drawSurfaceLayer(ctx, hex, tile, size, origin) {
  const surfaceLayer = tile.layers.surface;

  if (!surfaceLayer.naturalBlock) return;
  if (surfaceLayer.naturalBlock.generated) return;

  const center = axialToPixel(hex, size, origin);
  const radius = size * 0.34;
  const naturalBlock = surfaceLayer.naturalBlock;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);

  ctx.font = `${Math.floor(size * 0.18)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fillText(naturalBlock.type.toUpperCase().slice(0, 3), 0, radius + size * 0.22);
  ctx.restore();
}

function drawBuilding(ctx, building, size, origin) {
  const center = axialToPixel(building, size, origin);
  const radius = size * 0.48;

  ctx.save();
  ctx.translate(center.x, center.y);

  if (building.deconstructing) {
    ctx.globalAlpha = 0.46;
  }

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

  if (building.type !== "wall") {
    ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillText(ENTITY_GLYPHS[building.type] ?? "???", 0, radius + size * 0.22);
  }

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

function drawPendingDeconstruction(ctx, deconstruction, size, origin) {
  const center = axialToPixel(deconstruction, size, origin);
  const progress = Math.min(1, deconstruction.elapsed / deconstruction.totalTime);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.globalAlpha = 0.26 + (1 - progress) * 0.28;
  drawHexWallShape(ctx, deconstruction, size, 0.7);

  ctx.font = `${Math.floor(size * 0.18)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(255, 236, 126, ${0.84 - progress * 0.28})`;
  ctx.fillText(`${Math.round(progress * 100)}%`, 0, size * 0.54);
  ctx.restore();
}

function drawBuildPreview(ctx, gameState, size, origin) {
  const hoveredHex = gameState.ui.buildMenu.hoveredHex;
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!hoveredHex || !definition) return;

  const footprint = getBuildingFootprint(definition, gameState.ui.buildMenu.rotationIndex);
  const center = axialToPixel(hoveredHex, size, origin);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.globalAlpha = 0.18;
  drawHexWallShape(ctx, { footprint }, size, 0.72);
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

    drawGeneratedRockClusters(ctx, mapWorld, visibleHexes, hexSize, origin);
    drawBuildPreview(ctx, gameState, hexSize, origin);

    for (const construction of mapWorld.pendingConstructions) {
      drawPendingConstruction(ctx, construction, hexSize, origin);
    }

    for (const building of mapWorld.buildings) {
      drawBuilding(ctx, building, hexSize, origin);
    }

    for (const deconstruction of mapWorld.pendingDeconstructions) {
      drawPendingDeconstruction(ctx, deconstruction, hexSize, origin);
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
