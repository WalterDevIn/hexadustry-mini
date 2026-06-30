import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { getOreColor } from "./terrainRenderer.js";

const TEAM_YELLOW = "rgba(255, 226, 64, 0.96)";
const TEAM_YELLOW_DIM = "rgba(255, 226, 64, 0.48)";

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
  ctx.fillStyle = `rgba(255, 255, 255, ${0.026 * alpha})`;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.72 * alpha})`;
  ctx.lineWidth = 1.6;
  ctx.fill();
  ctx.stroke();
}

function getLocalSidePoint(directionIndex, size) {
  const vector = getDirectionVector(directionIndex, size);
  const sideDistance = size * 0.76;

  return {
    x: vector.x * sideDistance,
    y: vector.y * sideDistance,
    angle: vector.angle,
  };
}

function drawPathStroke(ctx, points, width, strokeStyle) {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawStraightBeltBody(ctx, size, alpha) {
  const halfLength = size * 0.73;
  const halfHeight = size * 0.18;

  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${0.045 * alpha})`;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.46 * alpha})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(-halfLength, -halfHeight, halfLength * 2, halfHeight * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawInputBranch(ctx, sideIndex, size, alpha) {
  const start = getLocalSidePoint(sideIndex, size);
  const bend = { x: start.x * 0.36, y: start.y * 0.36 };
  const center = { x: 0, y: 0 };

  drawPathStroke(ctx, [start, bend, center], size * 0.22, `rgba(255, 255, 255, ${0.13 * alpha})`);
  drawPathStroke(ctx, [start, bend, center], size * 0.035, `rgba(255, 255, 255, ${0.38 * alpha})`);
}

function drawOutputChannel(ctx, size, alpha) {
  const center = { x: 0, y: 0 };
  const exit = getLocalSidePoint(0, size);

  drawPathStroke(ctx, [center, exit], size * 0.24, `rgba(255, 255, 255, ${0.16 * alpha})`);
  drawPathStroke(ctx, [center, exit], size * 0.04, `rgba(255, 255, 255, ${0.55 * alpha})`);
}

function drawOutputMarker(ctx, size, alpha) {
  const exit = getLocalSidePoint(0, size);

  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.strokeStyle = `rgba(255, 226, 64, ${0.95 * alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.16, -size * 0.18);
  ctx.lineTo(size * 0.05, 0);
  ctx.lineTo(-size * 0.16, size * 0.18);
  ctx.stroke();
  ctx.restore();
}

function drawBeltRouteNetwork(ctx, size, alpha) {
  drawStraightBeltBody(ctx, size, alpha);
  for (let sideIndex = 1; sideIndex < HEX_DIRECTIONS.length; sideIndex += 1) drawInputBranch(ctx, sideIndex, size, alpha);
  drawOutputChannel(ctx, size, alpha);
  drawOutputMarker(ctx, size, alpha);
}

function drawPathArrow(ctx, position, angle, size, alpha, scale = 1) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  ctx.font = `700 ${Math.floor(size * 0.5 * scale)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = alpha > 0.75 ? TEAM_YELLOW : TEAM_YELLOW_DIM;
  ctx.globalAlpha *= alpha;
  ctx.fillText(">", 0, size * 0.02);
  ctx.restore();
}

function getSegmentPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function drawMainBeltArrows(ctx, phase, size, alpha) {
  const start = { x: -size * 0.63, y: 0 };
  const end = { x: size * 0.63, y: 0 };

  drawPathArrow(ctx, getSegmentPoint(start, end, phase), 0, size, alpha, 1);
  drawPathArrow(ctx, getSegmentPoint(start, end, (phase + 0.5) % 1), 0, size, alpha * 0.72, 0.88);
}

function drawBranchArrows(ctx, phase, size, alpha) {
  for (let sideIndex = 1; sideIndex < HEX_DIRECTIONS.length; sideIndex += 1) {
    const start = getLocalSidePoint(sideIndex, size);
    const center = { x: 0, y: 0 };
    const t = (phase + sideIndex * 0.17) % 1;
    const point = getSegmentPoint(start, center, t);
    const angle = Math.atan2(center.y - start.y, center.x - start.x);

    drawPathArrow(ctx, point, angle, size, alpha * 0.38, 0.62);
  }
}

function drawConveyorItem(ctx, building, size, alpha) {
  const item = building.conveyor?.item;
  if (!item) return;

  const transferSeconds = building.conveyor.transferSeconds || 0.33;
  const progress = Math.min(1, building.conveyor.progress / transferSeconds);
  const position = getSegmentPoint({ x: -size * 0.56, y: -size * 0.02 }, { x: size * 0.56, y: -size * 0.02 }, progress);

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.font = `700 ${Math.floor(size * 0.42)}px Courier New`;
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
  drawBeltRouteNetwork(ctx, size, alpha);
  drawBranchArrows(ctx, phase, size, alpha);
  drawMainBeltArrows(ctx, phase, size, alpha);
  drawConveyorItem(ctx, building, size, alpha);
  ctx.restore();
}
