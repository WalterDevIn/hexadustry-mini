import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { getOreColor } from "./terrainRenderer.js";

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

function getBuildingAt(mapWorld, q, r) {
  const buildingId = mapWorld?.getOrCreateTile(q, r).layers.surface.buildingId;

  if (!buildingId) return null;

  return mapWorld.buildings.find((building) => building.id === buildingId) ?? null;
}

function canVisuallyConnect(building) {
  if (!building) return false;
  if (building.type === "conveyor") return true;
  if (building.type === "core") return true;
  if (building.type === "drill") return true;
  if (building.drill || building.conveyor || building.storage) return true;

  return false;
}

function getConnectedInputSides(mapWorld, building) {
  if (!mapWorld) return [3];

  const outputSide = building.direction ?? 0;
  const sides = [];

  for (let sideIndex = 0; sideIndex < HEX_DIRECTIONS.length; sideIndex += 1) {
    if (sideIndex === outputSide) continue;

    const direction = HEX_DIRECTIONS[sideIndex];
    const neighbor = getBuildingAt(mapWorld, building.q + direction.q, building.r + direction.r);

    if (canVisuallyConnect(neighbor)) sides.push(sideIndex);
  }

  if (sides.length === 0) return [(outputSide + 3) % HEX_DIRECTIONS.length];

  return sides;
}

function drawHexShell(ctx, size, alpha) {
  const polygon = buildHexPolygon({ q: 0, r: 0 }, size, { x: 0, y: 0 });

  ctx.beginPath();
  ctx.moveTo(polygon.corners[0].x, polygon.corners[0].y);
  for (let i = 1; i < polygon.corners.length; i += 1) ctx.lineTo(polygon.corners[i].x, polygon.corners[i].y);
  ctx.closePath();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.014 * alpha})`;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.64 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
}

function getSidePoint(sideIndex, size) {
  const vector = getDirectionVector(sideIndex, size);

  return {
    x: vector.x * size,
    y: vector.y * size,
    angle: vector.angle,
  };
}

function drawWideBand(ctx, points, width, alpha) {
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.17 * alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.44 * alpha})`;
  ctx.lineWidth = Math.max(1.3, width * 0.075);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function getBandRoute(sideIndex, size) {
  const start = getSidePoint(sideIndex, size);
  const exit = getSidePoint(0, size);
  const center = { x: 0, y: 0 };

  if (sideIndex === 3) return [start, exit];

  return [
    start,
    { x: start.x * 0.58, y: start.y * 0.58 },
    center,
    { x: exit.x * 0.64, y: exit.y * 0.64 },
    exit,
  ];
}

function drawBeltBands(ctx, inputSides, size, alpha) {
  const mainWidth = size * 0.62;

  for (const sideIndex of inputSides) {
    const isStraight = sideIndex === 3;
    drawWideBand(ctx, getBandRoute(sideIndex, size), isStraight ? mainWidth : mainWidth * 0.82, isStraight ? alpha : alpha * 0.92);
  }
}

function getSegmentPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function getRoutePoint(route, t) {
  const segmentCount = route.length - 1;
  const scaled = Math.min(0.999, Math.max(0, t)) * segmentCount;
  const index = Math.floor(scaled);
  const localT = scaled - index;

  return getSegmentPoint(route[index], route[index + 1], localT);
}

function drawConveyorItem(ctx, building, size, alpha) {
  const item = building.conveyor?.item;
  if (!item) return;

  const transferSeconds = building.conveyor.transferSeconds || 0.33;
  const progress = Math.min(1, building.conveyor.progress / transferSeconds);
  const entrySide = item.entryDirection ?? 3;
  const route = getBandRoute(entrySide, size);
  const position = getRoutePoint(route, progress);

  ctx.save();
  ctx.translate(position.x, position.y - size * 0.02);
  ctx.font = `700 ${Math.floor(size * 0.48)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = getOreColor({ type: item.type });
  ctx.fillText("x", 0, size * 0.02);
  ctx.restore();
}

export function drawTransportBelt(ctx, building, size, alpha = 1, mapWorld = null) {
  const direction = getDirectionVector(building.direction ?? 0, size);
  const inputSides = getConnectedInputSides(mapWorld, building);

  drawHexShell(ctx, size, alpha);

  ctx.save();
  ctx.rotate(direction.angle);
  drawBeltBands(ctx, inputSides, size, alpha);
  drawConveyorItem(ctx, building, size, alpha);
  ctx.restore();
}
