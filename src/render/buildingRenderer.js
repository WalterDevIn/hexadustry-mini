import { getBuildingDefinition, getBuildingFootprint } from "../content/buildingDefinitions.js";
import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { easeOutCubic } from "./renderUtils.js";
import { getOreColor } from "./terrainRenderer.js";
import {
  drawAnimatedWallShape,
  drawCoreShape,
  drawHexWallShape,
  drawQueuedBuildPreviewShape,
  getWallBoundarySegments,
  getWallCenter,
  strokeSegments,
} from "./wallShapeRenderer.js";

const BUILD_ANIMATION_YELLOW = [255, 226, 64];
const BUILD_ANIMATION_RED = [255, 64, 64];
const ENTITY_GLYPHS = {
  turret: "TRT",
};

function getDirectionVector(directionIndex, size) {
  const direction = HEX_DIRECTIONS[directionIndex % HEX_DIRECTIONS.length];
  const end = axialToPixel(direction, size);
  const length = Math.hypot(end.x, end.y) || 1;

  return {
    x: end.x / length,
    y: end.y / length,
    angle: Math.atan2(end.y, end.x),
  };
}

function drawTriangleBlade(ctx, distance, length, width) {
  ctx.beginPath();
  ctx.moveTo(distance + length, 0);
  ctx.lineTo(distance - length * 0.45, -width * 0.5);
  ctx.lineTo(distance - length * 0.45, width * 0.5);
  ctx.closePath();
  ctx.stroke();
}

function getDrillOre(mapWorld, building) {
  const oreType = building.drill?.extractedType;

  if (!oreType) return null;

  return { type: oreType };
}

function drawOuterFootprintOnly(ctx, building, size) {
  const footprint = building.footprint ?? [{ q: 0, r: 0 }];
  const outerSegments = getWallBoundarySegments(footprint, size);

  ctx.strokeStyle = "rgba(255, 226, 64, 0.96)";
  ctx.lineWidth = 2.25;
  strokeSegments(ctx, outerSegments);
}

function drawCommonDrill(ctx, building, size, gameState) {
  const center = getWallCenter(building.footprint ?? [{ q: 0, r: 0 }], size);
  const playerRadius = size * 0.4;
  const innerRadius = playerRadius * 0.5;
  const bladeDistance = innerRadius + size * 0.2;
  const bladeLength = size * 0.21;
  const bladeWidth = size * 0.18;
  const outerRadius = bladeDistance + bladeLength * 0.78;
  const drill = building.drill;
  const ore = getDrillOre(gameState.mapWorld, building);
  const oreColor = ore ? getOreColor(ore) : "rgba(255, 255, 255, 0.24)";
  const bladeRotation = drill?.bladeRotation ?? 0;

  drawOuterFootprintOnly(ctx, building, size);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.fillStyle = oreColor;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.rotate(bladeRotation);
  ctx.strokeStyle = drill?.isDrilling ? "rgba(255, 236, 126, 0.96)" : "rgba(255, 255, 255, 0.48)";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 3);
    drawTriangleBlade(ctx, bladeDistance, bladeLength, bladeWidth);
    ctx.restore();
  }

  ctx.rotate(-bladeRotation);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `${Math.floor(size * 0.2)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fillText(`${drill?.storedAmount ?? 0}/${drill?.capacity ?? 10}`, 0, outerRadius + size * 0.23);
  ctx.restore();
}

function drawMovingArrow(ctx, direction, offset, size) {
  ctx.save();
  ctx.translate(direction.x * offset, direction.y * offset);
  ctx.rotate(direction.angle);
  ctx.font = `700 ${Math.floor(size * 0.48)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.fillText(">", 0, size * 0.02);
  ctx.restore();
}

function drawConveyorItem(ctx, building, direction, size) {
  const item = building.conveyor?.item;

  if (!item) return;

  const transferSeconds = building.conveyor.transferSeconds || 0.33;
  const progress = Math.min(1, building.conveyor.progress / transferSeconds);
  const travel = -size * 0.42 + progress * size * 0.84;

  ctx.save();
  ctx.translate(direction.x * travel, direction.y * travel);
  ctx.font = `700 ${Math.floor(size * 0.42)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = getOreColor({ type: item.type });
  ctx.fillText("x", 0, size * 0.02);
  ctx.restore();
}

function drawTransportBelt(ctx, building, size) {
  const polygon = buildHexPolygon({ q: 0, r: 0 }, size * 0.78, { x: 0, y: 0 });
  const direction = getDirectionVector(building.direction ?? 0, size);
  const phase = building.conveyor?.beltPhase ?? 0;
  const offsetA = -size * 0.32 + phase * size * 0.64;
  const offsetB = offsetA - size * 0.34;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
  for (let i = 1; i < polygon.points.length; i += 1) ctx.lineTo(polygon.points[i].x, polygon.points[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.rotate(direction.angle);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, -size * 0.28);
  ctx.lineTo(size * 0.42, -size * 0.28);
  ctx.moveTo(-size * 0.42, size * 0.28);
  ctx.lineTo(size * 0.42, size * 0.28);
  ctx.stroke();
  ctx.restore();

  drawMovingArrow(ctx, direction, offsetA, size);
  drawMovingArrow(ctx, direction, offsetB, size);
  drawConveyorItem(ctx, building, direction, size);
}

export function drawBuilding(ctx, building, size, origin, gameState) {
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
    drawCoreShape(ctx, building, size, gameState, 1);
  } else if (building.type === "drill") {
    drawCommonDrill(ctx, building, size, gameState);
  } else if (building.type === "conveyor") {
    drawTransportBelt(ctx, building, size);
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

  if (building.type !== "wall" && building.type !== "core" && building.type !== "drill" && building.type !== "conveyor") {
    ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillText(ENTITY_GLYPHS[building.type] ?? "???", 0, radius + size * 0.22);
  }

  ctx.restore();
}

export function drawPendingConstruction(ctx, construction, size, origin) {
  const center = axialToPixel(construction, size, origin);
  const progress = Math.min(1, construction.elapsed / construction.totalTime);

  ctx.save();
  ctx.translate(center.x, center.y);
  drawQueuedBuildPreviewShape(ctx, construction, size);

  if (progress > 0) {
    const scale = 0.16 + easeOutCubic(progress) * 0.84;
    drawAnimatedWallShape(ctx, construction, size, BUILD_ANIMATION_YELLOW, 0.34, scale);
  }

  ctx.restore();
}

export function drawPendingDeconstruction(ctx, deconstruction, size, origin) {
  const center = axialToPixel(deconstruction, size, origin);
  const progress = Math.min(1, deconstruction.elapsed / deconstruction.totalTime);
  const scale = Math.max(0.06, 1 - easeOutCubic(progress) * 0.94);

  ctx.save();
  ctx.translate(center.x, center.y);
  drawAnimatedWallShape(ctx, deconstruction, size, BUILD_ANIMATION_RED, 0.42, scale);
  ctx.restore();
}

export function drawBuildPreview(ctx, gameState, size, origin) {
  const hoveredHex = gameState.ui.buildMenu.hoveredHex;
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!hoveredHex || !definition) return;

  const footprint = getBuildingFootprint(definition, gameState.ui.buildMenu.rotationIndex);
  const center = axialToPixel(hoveredHex, size, origin);

  ctx.save();
  ctx.translate(center.x, center.y);
  drawQueuedBuildPreviewShape(ctx, { footprint }, size);
  ctx.restore();
}
