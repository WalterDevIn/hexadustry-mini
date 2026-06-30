import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { getOreColor } from "./terrainRenderer.js";

const EDGE_BY_DIRECTION = [0, 5, 4, 3, 2, 1];
const DIRECTION_COUNT = HEX_DIRECTIONS.length;
const INNER_SCALE = 0.82;
const BELT_STROKE = [255, 226, 64];

function yellow(alpha) {
  return `rgba(${BELT_STROKE[0]}, ${BELT_STROKE[1]}, ${BELT_STROKE[2]}, ${alpha})`;
}

function getDirectionVector(directionIndex, size) {
  const direction = HEX_DIRECTIONS[directionIndex % DIRECTION_COUNT];
  const end = axialToPixel(direction, size);
  const length = Math.hypot(end.x, end.y) || 1;

  return {
    angle: Math.atan2(end.y, end.x),
  };
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

  return localSides.sort((a, b) => a - b);
}

function getOuterCorners(size) {
  return buildHexPolygon({ q: 0, r: 0 }, size, { x: 0, y: 0 }).corners;
}

function getInnerCorners(size) {
  return getOuterCorners(size).map((corner) => ({
    x: corner.x * INNER_SCALE,
    y: corner.y * INNER_SCALE,
  }));
}

function getSideEdge(corners, sideIndex) {
  const edgeIndex = EDGE_BY_DIRECTION[sideIndex % EDGE_BY_DIRECTION.length];

  return {
    a: corners[edgeIndex],
    b: corners[(edgeIndex + 1) % corners.length],
  };
}

function getPointKey(point) {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
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

function getEndpointPair(inputEdge, outputEdge) {
  const directDistance = Math.hypot(inputEdge.a.x - outputEdge.a.x, inputEdge.a.y - outputEdge.a.y)
    + Math.hypot(inputEdge.b.x - outputEdge.b.x, inputEdge.b.y - outputEdge.b.y);
  const crossedDistance = Math.hypot(inputEdge.a.x - outputEdge.b.x, inputEdge.a.y - outputEdge.b.y)
    + Math.hypot(inputEdge.b.x - outputEdge.a.x, inputEdge.b.y - outputEdge.a.y);

  if (crossedDistance < directDistance) {
    return [
      { start: inputEdge.a, end: outputEdge.b },
      { start: inputEdge.b, end: outputEdge.a },
    ];
  }

  return [
    { start: inputEdge.a, end: outputEdge.a },
    { start: inputEdge.b, end: outputEdge.b },
  ];
}

function drawConnectorLines(ctx, inputEdge, outputEdge, alpha) {
  const pairs = getEndpointPair(inputEdge, outputEdge);

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

function groupContiguousSides(localInputSides) {
  const uniqueSides = [...new Set(localInputSides)].filter((side) => side !== 0).sort((a, b) => a - b);
  const groups = [];

  for (const side of uniqueSides) {
    const lastGroup = groups[groups.length - 1];
    const previousSide = lastGroup?.[lastGroup.length - 1];

    if (lastGroup && side === previousSide + 1) lastGroup.push(side);
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

  const endpoints = [...pointCounts.entries()]
    .filter(([, count]) => count === 1)
    .map(([key]) => pointByKey.get(key));

  if (endpoints.length >= 2) return { a: endpoints[0], b: endpoints[endpoints.length - 1] };

  return getSideEdge(corners, sideGroup[0]);
}

function getSegmentPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function getMiddleRoute(inputEdge, outputEdge) {
  return {
    start: {
      x: (inputEdge.a.x + inputEdge.b.x) / 2,
      y: (inputEdge.a.y + inputEdge.b.y) / 2,
    },
    end: {
      x: (outputEdge.a.x + outputEdge.b.x) / 2,
      y: (outputEdge.a.y + outputEdge.b.y) / 2,
    },
  };
}

function getRouteAngle(route) {
  return Math.atan2(route.end.y - route.start.y, route.end.x - route.start.x);
}

function getRouteNormal(route) {
  const angle = getRouteAngle(route);

  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

function drawMovingArrow(ctx, route, phase, size, alpha) {
  const position = getSegmentPoint(route.start, route.end, phase);
  const angle = getRouteAngle(route);
  const normal = getRouteNormal(route);
  const arrowSize = size * 0.18;
  const arrowOffset = size * 0.12;

  ctx.save();
  ctx.translate(position.x + normal.x * arrowOffset, position.y + normal.y * arrowOffset);
  ctx.rotate(angle);
  ctx.fillStyle = yellow(0.9 * alpha);
  ctx.strokeStyle = yellow(0.95 * alpha);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(arrowSize, 0);
  ctx.lineTo(-arrowSize * 0.72, -arrowSize * 0.62);
  ctx.lineTo(-arrowSize * 0.34, 0);
  ctx.lineTo(-arrowSize * 0.72, arrowSize * 0.62);
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

  const route = getMiddleRoute(inputEdge, outputEdge);
  const position = getSegmentPoint(route.start, route.end, progress);
  const normal = getRouteNormal(route);

  ctx.save();
  ctx.translate(position.x - normal.x * 3, position.y - normal.y * 3);
  ctx.font = "700 14px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = getOreColor({ type: item.type });
  ctx.fillText("x", 0, 0);
  ctx.restore();
}

function getArrowRoute(inputEdgesByWorldSide, outputEdge) {
  const preferredInput = inputEdgesByWorldSide.get(3) ?? inputEdgesByWorldSide.values().next().value;

  if (!preferredInput) return null;

  return getMiddleRoute(preferredInput, outputEdge);
}

export function drawTransportBelt(ctx, building, size, alpha = 1, mapWorld = null) {
  const outputSide = building.direction ?? 0;
  const direction = getDirectionVector(outputSide, size);
  const localInputSides = getConnectedInputSides(mapWorld, building);
  const sideGroups = groupContiguousSides(localInputSides);
  const outerCorners = getOuterCorners(size);
  const innerCorners = getInnerCorners(size);
  const outputEdge = getSideEdge(innerCorners, 0);
  const inputEdges = localInputSides.map((localSide) => getSideEdge(innerCorners, localSide));
  const removedInnerEdges = [outputEdge, ...inputEdges];
  const inputEdgesByWorldSide = new Map(localInputSides.map((localSide, index) => {
    return [toWorldSide(localSide, outputSide), inputEdges[index]];
  }));
  const arrowRoute = getArrowRoute(inputEdgesByWorldSide, outputEdge);
  const arrowPhase = building.conveyor?.beltPhase ?? 0.22;

  ctx.save();
  ctx.rotate(direction.angle);
  drawEdges(ctx, outerCorners, alpha);
  drawEdges(ctx, innerCorners, alpha, removedInnerEdges);

  for (const sideGroup of sideGroups) {
    drawConnectorLines(ctx, getOpenEdgeForSideGroup(innerCorners, sideGroup), outputEdge, alpha);
  }

  if (arrowRoute) drawMovingArrow(ctx, arrowRoute, arrowPhase, size, alpha);

  drawConveyorItem(ctx, building, inputEdgesByWorldSide, outputEdge, alpha);
  ctx.restore();
}
