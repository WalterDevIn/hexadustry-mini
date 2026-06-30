import { axialToPixel, buildHexPolygon, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { getOreColor } from "./terrainRenderer.js";

const EDGE_BY_DIRECTION = [0, 5, 4, 3, 2, 1];
const DIRECTION_COUNT = HEX_DIRECTIONS.length;

function getDirectionVector(directionIndex, size) {
  const direction = HEX_DIRECTIONS[directionIndex % DIRECTION_COUNT];
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

    if (canVisuallyConnect(neighbor)) {
      localSides.push(toLocalSide(worldSide, outputSide));
    }
  }

  if (localSides.length === 0) return [3];

  return localSides;
}

function getHexCorners(size) {
  return buildHexPolygon({ q: 0, r: 0 }, size, { x: 0, y: 0 }).corners;
}

function getSideEdge(corners, sideIndex) {
  const edgeIndex = EDGE_BY_DIRECTION[sideIndex % EDGE_BY_DIRECTION.length];

  return {
    a: corners[edgeIndex],
    b: corners[(edgeIndex + 1) % corners.length],
  };
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

function sameEdge(edgeA, edgeB) {
  return (samePoint(edgeA.a, edgeB.a) && samePoint(edgeA.b, edgeB.b))
    || (samePoint(edgeA.a, edgeB.b) && samePoint(edgeA.b, edgeB.a));
}

function drawOuterHexWithoutEdges(ctx, corners, removedEdges, alpha) {
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.68 * alpha})`;
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
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.68 * alpha})`;
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

function getSegmentPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function getMiddleRoute(inputEdge, outputEdge) {
  const start = {
    x: (inputEdge.a.x + inputEdge.b.x) / 2,
    y: (inputEdge.a.y + inputEdge.b.y) / 2,
  };
  const end = {
    x: (outputEdge.a.x + outputEdge.b.x) / 2,
    y: (outputEdge.a.y + outputEdge.b.y) / 2,
  };

  return { start, end };
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
  const corners = getHexCorners(size);
  const outputEdge = getSideEdge(corners, 0);
  const inputEdges = localInputSides.map((localSide) => getSideEdge(corners, localSide));
  const inputEdgesByWorldSide = new Map(localInputSides.map((localSide, index) => {
    return [toWorldSide(localSide, outputSide), inputEdges[index]];
  }));

  ctx.save();
  ctx.rotate(direction.angle);
  drawOuterHexWithoutEdges(ctx, corners, [outputEdge, ...inputEdges], alpha);

  for (const inputEdge of inputEdges) {
    drawConnectorLines(ctx, inputEdge, outputEdge, alpha);
  }

  drawConveyorItem(ctx, building, inputEdgesByWorldSide, outputEdge, alpha);
  ctx.restore();
}
