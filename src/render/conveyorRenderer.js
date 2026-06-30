import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { getOreColor } from "./terrainRenderer.js";

const EDGE_BY_DIRECTION = [0, 5, 4, 3, 2, 1];
const DIRECTION_COUNT = HEX_DIRECTIONS.length;
const INNER_SCALE = 0.82;
const HUB_SCALE = 0.18;
const BELT_STROKE = [255, 226, 64];

function yellow(alpha) {
  return `rgba(${BELT_STROKE[0]}, ${BELT_STROKE[1]}, ${BELT_STROKE[2]}, ${alpha})`;
}

function getDirectionVector(directionIndex, size) {
  const direction = HEX_DIRECTIONS[directionIndex % DIRECTION_COUNT];
  const end = axialToPixel(direction, size);
  return { angle: Math.atan2(end.y, end.x) };
}

function getBuildingAt(mapWorld, q, r) {
  const buildingId = mapWorld?.getOrCreateTile(q, r).layers.surface.buildingId;
  if (!buildingId) return null;
  return mapWorld.buildings.find((building) => building.id === buildingId) ?? null;
}

function conveyorOutputsTo(neighbor, target) {
  const direction = HEX_DIRECTIONS[(neighbor.direction ?? 0) % DIRECTION_COUNT];
  return neighbor.q + direction.q === target.q && neighbor.r + direction.r === target.r;
}

function canFeedThisConveyor(neighbor, target) {
  if (!neighbor) return false;
  if (neighbor.type === "conveyor") return conveyorOutputsTo(neighbor, target);
  if (neighbor.type === "drill") return true;
  if (neighbor.type === "core") return false;
  return Boolean(neighbor.storage || neighbor.drill);
}

function toLocalSide(worldSide, outputSide) {
  return (worldSide - outputSide + DIRECTION_COUNT) % DIRECTION_COUNT;
}

function toWorldSide(localSide, outputSide) {
  return (localSide + outputSide) % DIRECTION_COUNT;
}

function getConnectedInputSides(mapWorld, building) {
  const outputSide = building.direction ?? 0;
  if (!mapWorld) return [3];
  const localSides = [];

  for (let worldSide = 0; worldSide < DIRECTION_COUNT; worldSide += 1) {
    if (worldSide === outputSide) continue;
    const direction = HEX_DIRECTIONS[worldSide];
    const neighbor = getBuildingAt(mapWorld, building.q + direction.q, building.r + direction.r);
    if (canFeedThisConveyor(neighbor, building)) localSides.push(toLocalSide(worldSide, outputSide));
  }

  const entryDirection = building.conveyor?.item?.entryDirection;
  if (typeof entryDirection === "number" && entryDirection !== outputSide) {
    const itemLocalSide = toLocalSide(entryDirection, outputSide);
    if (!localSides.includes(itemLocalSide)) localSides.push(itemLocalSide);
  }

  if (localSides.length === 0) return [3];
  return [...new Set(localSides)].sort((a, b) => a - b);
}

function getOuterCorners(size) {
  return buildHexPolygon({ q: 0, r: 0 }, size, { x: 0, y: 0 }).corners;
}

function getScaledCorners(size, scale) {
  return getOuterCorners(size).map((corner) => ({ x: corner.x * scale, y: corner.y * scale }));
}

function getSideEdge(corners, sideIndex) {
  const edgeIndex = EDGE_BY_DIRECTION[sideIndex % EDGE_BY_DIRECTION.length];
  return { a: corners[edgeIndex], b: corners[(edgeIndex + 1) % corners.length] };
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

function sameEdge(edgeA, edgeB) {
  return (samePoint(edgeA.a, edgeB.a) && samePoint(edgeA.b, edgeB.b))
    || (samePoint(edgeA.a, edgeB.b) && samePoint(edgeA.b, edgeB.a));
}

function drawEdges(ctx, corners, alpha, removedEdges = []) {
  ctx.save();
  ctx.strokeStyle = yellow(0.72 * alpha);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "butt";

  for (let i = 0; i < corners.length; i += 1) {
    const edge = { a: corners[i], b: corners[(i + 1) % corners.length] };
    if (removedEdges.some((removedEdge) => sameEdge(edge, removedEdge))) continue;
    ctx.beginPath();
    ctx.moveTo(edge.a.x, edge.a.y);
    ctx.lineTo(edge.b.x, edge.b.y);
    ctx.stroke();
  }

  ctx.restore();
}

function getPointKey(point) {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

function groupContiguousSides(localInputSides) {
  const sides = [...new Set(localInputSides)].filter((side) => side !== 0).sort((a, b) => a - b);
  const groups = [];

  for (const side of sides) {
    const last = groups[groups.length - 1];
    const previous = last?.[last.length - 1];
    if (last && side === previous + 1) last.push(side);
    else groups.push([side]);
  }

  return groups;
}

function getOpenEdgeForSideGroup(corners, sideGroup) {
  const pointCounts = new Map();
  const pointByKey = new Map();

  for (const side of sideGroup) {
    const edge = getSideEdge(corners, side);
    for (const point of [edge.a, edge.b]) {
      const key = getPointKey(point);
      pointByKey.set(key, point);
      pointCounts.set(key, (pointCounts.get(key) ?? 0) + 1);
    }
  }

  const endpoints = [...pointCounts.entries()].filter(([, count]) => count === 1).map(([key]) => pointByKey.get(key));
  if (endpoints.length >= 2) return { a: endpoints[0], b: endpoints[endpoints.length - 1] };
  return getSideEdge(corners, sideGroup[0]);
}

function midpoint(edge) {
  return { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 };
}

function getSegmentPoint(start, end, t) {
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
}

function getPointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getRouteLength(route) {
  let length = 0;
  for (let i = 0; i < route.length - 1; i += 1) length += getPointDistance(route[i], route[i + 1]);
  return length;
}

function getRoutePoint(route, t) {
  const targetDistance = getRouteLength(route) * Math.min(1, Math.max(0, t));
  let travelled = 0;

  for (let i = 0; i < route.length - 1; i += 1) {
    const start = route[i];
    const end = route[i + 1];
    const segmentLength = getPointDistance(start, end);
    if (travelled + segmentLength >= targetDistance) return getSegmentPoint(start, end, (targetDistance - travelled) / segmentLength);
    travelled += segmentLength;
  }

  return route[route.length - 1];
}

function getRouteAngle(route, t) {
  const targetDistance = getRouteLength(route) * Math.min(1, Math.max(0, t));
  let travelled = 0;

  for (let i = 0; i < route.length - 1; i += 1) {
    const start = route[i];
    const end = route[i + 1];
    const segmentLength = getPointDistance(start, end);
    if (travelled + segmentLength >= targetDistance) return Math.atan2(end.y - start.y, end.x - start.x);
    travelled += segmentLength;
  }

  const start = route[route.length - 2];
  const end = route[route.length - 1];
  return Math.atan2(end.y - start.y, end.x - start.x);
}

function extendRouteForArrow(route, size) {
  const arrowHeight = size * 0.3;
  const firstAngle = Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x);
  const lastAngle = Math.atan2(route.at(-1).y - route.at(-2).y, route.at(-1).x - route.at(-2).x);
  const start = { x: route[0].x - Math.cos(firstAngle) * arrowHeight, y: route[0].y - Math.sin(firstAngle) * arrowHeight };
  const end = { x: route.at(-1).x + Math.cos(lastAngle) * arrowHeight, y: route.at(-1).y + Math.sin(lastAngle) * arrowHeight };
  return [start, ...route.slice(1, -1), end];
}

function getDuctRoute(inputEdge, outputEdge) {
  return [midpoint(inputEdge), { x: 0, y: 0 }, midpoint(outputEdge)];
}

function getEndpointPair(fromEdge, toEdge) {
  const directDistance = getPointDistance(fromEdge.a, toEdge.a) + getPointDistance(fromEdge.b, toEdge.b);
  const crossedDistance = getPointDistance(fromEdge.a, toEdge.b) + getPointDistance(fromEdge.b, toEdge.a);
  if (crossedDistance < directDistance) return [{ start: fromEdge.a, end: toEdge.b }, { start: fromEdge.b, end: toEdge.a }];
  return [{ start: fromEdge.a, end: toEdge.a }, { start: fromEdge.b, end: toEdge.b }];
}

function drawEdgePairConnector(ctx, fromEdge, toEdge, alpha) {
  const pairs = getEndpointPair(fromEdge, toEdge);

  ctx.save();
  ctx.strokeStyle = yellow(0.72 * alpha);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "butt";

  for (const pair of pairs) {
    ctx.beginPath();
    ctx.moveTo(pair.start.x, pair.start.y);
    ctx.lineTo(pair.end.x, pair.end.y);
    ctx.stroke();
  }

  ctx.restore();
}

function clipToHex(ctx, corners) {
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.clip();
}

function drawEquilateralArrow(ctx, route, phase, size, alpha, clipCorners) {
  const arrowRoute = extendRouteForArrow(route, size);
  const tip = getRoutePoint(arrowRoute, phase);
  const angle = getRouteAngle(arrowRoute, phase);
  const height = size * 0.28;
  const halfBase = height / Math.sqrt(3);

  ctx.save();
  clipToHex(ctx, clipCorners);
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  ctx.fillStyle = yellow(0.55 * alpha);
  ctx.strokeStyle = yellow(0.92 * alpha);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-height, -halfBase);
  ctx.lineTo(-height, halfBase);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawConveyorItem(ctx, building, inputEdgesByWorldSide, outputEdge, alpha) {
  const item = building.conveyor?.item;
  if (!item) return;
  const transferSeconds = building.conveyor.transferSeconds || 0.33;
  const progress = Math.min(1, building.conveyor.progress / transferSeconds);
  const inputEdge = inputEdgesByWorldSide.get(item.entryDirection) ?? inputEdgesByWorldSide.values().next().value;
  if (!inputEdge) return;
  const position = getRoutePoint(getDuctRoute(inputEdge, outputEdge), progress);

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.font = "700 14px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = getOreColor({ type: item.type });
  ctx.fillText("x", 0, 0);
  ctx.restore();
}

export function drawTransportBelt(ctx, building, size, alpha = 1, mapWorld = null) {
  const outputSide = building.direction ?? 0;
  const direction = getDirectionVector(outputSide, size);
  const localInputSides = getConnectedInputSides(mapWorld, building);
  const sideGroups = groupContiguousSides(localInputSides);
  const outerCorners = getOuterCorners(size);
  const innerCorners = getScaledCorners(size, INNER_SCALE);
  const hubCorners = getScaledCorners(size, HUB_SCALE);
  const outputOuterEdge = getSideEdge(outerCorners, 0);
  const outputInnerEdge = getSideEdge(innerCorners, 0);
  const outputHubEdge = getSideEdge(hubCorners, 0);
  const inputOuterEdges = localInputSides.map((localSide) => getSideEdge(outerCorners, localSide));
  const inputInnerEdges = localInputSides.map((localSide) => getSideEdge(innerCorners, localSide));
  const inputEdgesByWorldSide = new Map(localInputSides.map((localSide, index) => [toWorldSide(localSide, outputSide), inputInnerEdges[index]]));
  const arrowPhase = building.conveyor?.beltPhase ?? 0.22;

  ctx.save();
  ctx.rotate(direction.angle);
  drawEdges(ctx, outerCorners, alpha, [outputOuterEdge, ...inputOuterEdges]);
  drawEdges(ctx, innerCorners, alpha, [outputInnerEdge, ...inputInnerEdges]);
  drawEdgePairConnector(ctx, outputHubEdge, outputInnerEdge, alpha);

  for (const sideGroup of sideGroups) {
    const groupEdge = getOpenEdgeForSideGroup(innerCorners, sideGroup);
    const groupCenterSide = Math.round(sideGroup.reduce((sum, side) => sum + side, 0) / sideGroup.length) % DIRECTION_COUNT;
    const hubEdge = getSideEdge(hubCorners, groupCenterSide);
    drawEdgePairConnector(ctx, groupEdge, hubEdge, alpha);
  }

  localInputSides.forEach((localSide, index) => {
    const inputEdge = getSideEdge(innerCorners, localSide);
    const route = getDuctRoute(inputEdge, outputInnerEdge);
    drawEquilateralArrow(ctx, route, (arrowPhase + index * 0.23) % 1, size, alpha, outerCorners);
  });

  drawConveyorItem(ctx, building, inputEdgesByWorldSide, outputInnerEdge, alpha);
  ctx.restore();
}
