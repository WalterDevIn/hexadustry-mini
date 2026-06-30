import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { getOreColor } from "./terrainRenderer.js";

const TEAM_YELLOW = "rgba(255, 226, 64, 0.96)";
const TEAM_YELLOW_DIM = "rgba(255, 226, 64, 0.5)";

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

function drawHexShell(ctx, size, alpha) {
  const polygon = buildHexPolygon({ q: 0, r: 0 }, size, { x: 0, y: 0 });

  ctx.beginPath();
  ctx.moveTo(polygon.corners[0].x, polygon.corners[0].y);
  for (let i = 1; i < polygon.corners.length; i += 1) ctx.lineTo(polygon.corners[i].x, polygon.corners[i].y);
  ctx.closePath();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.018 * alpha})`;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.68 * alpha})`;
  ctx.lineWidth = 1.6;
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

function drawWidePath(ctx, points, width, alpha) {
  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.42 * alpha})`;
  ctx.lineWidth = Math.max(1.25, width * 0.08);
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
    { x: start.x * 0.55, y: start.y * 0.55 },
    center,
    { x: exit.x * 0.62, y: exit.y * 0.62 },
    exit,
  ];
}

function drawBeltBands(ctx, size, alpha) {
  const bandWidth = size * 0.56;

  drawWidePath(ctx, getBandRoute(3, size), bandWidth, alpha);

  for (let sideIndex = 1; sideIndex < HEX_DIRECTIONS.length; sideIndex += 1) {
    if (sideIndex === 3) continue;
    drawWidePath(ctx, getBandRoute(sideIndex, size), bandWidth * 0.72, alpha * 0.58);
  }
}

function drawOutputMarker(ctx, size, alpha) {
  const exit = getSidePoint(0, size);

  ctx.save();
  ctx.translate(exit.x * 0.88, exit.y * 0.88);
  ctx.strokeStyle = `rgba(255, 226, 64, ${0.95 * alpha})`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-size * 0.17, -size * 0.22);
  ctx.lineTo(size * 0.08, 0);
  ctx.lineTo(-size * 0.17, size * 0.22);
  ctx.stroke();
  ctx.restore();
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

function getRouteAngle(route, t) {
  const segmentCount = route.length - 1;
  const scaled = Math.min(0.999, Math.max(0, t)) * segmentCount;
  const index = Math.floor(scaled);
  const start = route[index];
  const end = route[index + 1];

  return Math.atan2(end.y - start.y, end.x - start.x);
}

function drawPathArrow(ctx, route, t, size, alpha, scale = 1) {
  const point = getRoutePoint(route, t);
  const angle = getRouteAngle(route, t);

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  ctx.font = `700 ${Math.floor(size * 0.52 * scale)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = alpha > 0.7 ? TEAM_YELLOW : TEAM_YELLOW_DIM;
  ctx.globalAlpha *= alpha;
  ctx.fillText(">", 0, size * 0.02);
  ctx.restore();
}

function drawBeltArrows(ctx, phase, size, alpha) {
  const mainRoute = getBandRoute(3, size);

  drawPathArrow(ctx, mainRoute, phase, size, alpha, 1.05);
  drawPathArrow(ctx, mainRoute, (phase + 0.5) % 1, size, alpha * 0.78, 0.9);

  for (let sideIndex = 1; sideIndex < HEX_DIRECTIONS.length; sideIndex += 1) {
    if (sideIndex === 3) continue;
    const route = getBandRoute(sideIndex, size);
    const branchPhase = (phase + sideIndex * 0.19) % 1;
    drawPathArrow(ctx, route, branchPhase, size, alpha * 0.42, 0.66);
  }
}

function drawConveyorItem(ctx, building, size, alpha) {
  const item = building.conveyor?.item;
  if (!item) return;

  const transferSeconds = building.conveyor.transferSeconds || 0.33;
  const progress = Math.min(1, building.conveyor.progress / transferSeconds);
  const route = getBandRoute(3, size);
  const position = getRoutePoint(route, progress);

  ctx.save();
  ctx.translate(position.x, position.y - size * 0.02);
  ctx.font = `700 ${Math.floor(size * 0.44)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = getOreColor({ type: item.type });
  ctx.fillText("x", 0, size * 0.02);
  ctx.restore();
}

export function drawTransportBelt(ctx, building, size, alpha = 1) {
  const direction = getDirectionVector(building.direction ?? 0, size);
  const phase = building.conveyor?.beltPhase ?? 0;

  drawHexShell(ctx, size, alpha);

  ctx.save();
  ctx.rotate(direction.angle);
  drawBeltBands(ctx, size, alpha);
  drawBeltArrows(ctx, phase, size, alpha);
  drawOutputMarker(ctx, size, alpha);
  drawConveyorItem(ctx, building, size, alpha);
  ctx.restore();
}
