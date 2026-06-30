import { axialToPixel } from "../hex/hexMath.js";
import { getTile } from "../world/createInitialWorld.js";
import {
  getWallBoundarySegments,
  getWallCenter,
  getWallCorners,
  makeHexKeyFromHex,
  makeRelativeKey,
  strokeSegments,
} from "./wallShapeRenderer.js";
import { drawPath } from "./renderUtils.js";

export const ORE_COLORS = {
  copper: "rgba(255, 139, 46, 0.92)",
  lead: "rgba(132, 158, 178, 0.9)",
  carbon: "rgba(150, 150, 150, 0.86)",
};

const ROCK_CLUSTER_FOOTPRINTS = {
  single: [{ q: 0, r: 0 }],
  largeA: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 1, r: -1 }],
  largeB: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
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

export function getOreColor(ore) {
  return ORE_COLORS[ore?.type] ?? ORE_COLORS[ore?.colorId] ?? "rgba(255, 255, 255, 0.78)";
}

function isGroundCovered(tile) {
  const surfaceLayer = tile.layers.surface;

  return Boolean(surfaceLayer.naturalBlock || surfaceLayer.buildingId || surfaceLayer.groundUnitId);
}

export function drawGroundLayer(ctx, hex, tile, size, origin) {
  const ore = tile.layers.ground.ore;

  if (!ore || isGroundCovered(tile)) return;

  const center = axialToPixel(hex, size, origin);

  ctx.save();
  ctx.font = `700 ${Math.floor(size * 0.72)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = getOreColor(ore);
  ctx.fillText("x", center.x, center.y + size * 0.02);
  ctx.restore();
}

export function drawSurfaceLayer(ctx, hex, tile, size, origin) {
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

function getGeneratedNaturalBlock(mapWorld, q, r) {
  const naturalBlock = getTile(mapWorld, q, r).layers.surface.naturalBlock;

  if (!naturalBlock?.generated) return null;

  return naturalBlock;
}

function canPlaceRockVisualCluster(mapWorld, anchor, footprint, naturalBlockType) {
  for (const relativeHex of footprint) {
    const q = anchor.q + relativeHex.q;
    const r = anchor.r + relativeHex.r;
    const key = makeRelativeKey(q, r);
    const naturalBlock = getGeneratedNaturalBlock(mapWorld, q, r);

    if (mapWorld.rockVisualClusterOccupied.has(key)) return false;
    if (naturalBlock?.type !== naturalBlockType) return false;
  }

  return true;
}

function getValidRockClusterOptions(mapWorld, anchor, naturalBlockType) {
  const largeFootprintIds = ["largeA", "largeB"].filter((id) => {
    return canPlaceRockVisualCluster(mapWorld, anchor, ROCK_CLUSTER_FOOTPRINTS[id], naturalBlockType);
  });
  const options = [];

  if (canPlaceRockVisualCluster(mapWorld, anchor, ROCK_CLUSTER_FOOTPRINTS.huge, naturalBlockType)) {
    options.push({ sizeId: "huge", footprintIds: ["huge"] });
  }

  if (largeFootprintIds.length > 0) {
    options.push({ sizeId: "large", footprintIds: largeFootprintIds });
  }

  if (canPlaceRockVisualCluster(mapWorld, anchor, ROCK_CLUSTER_FOOTPRINTS.single, naturalBlockType)) {
    options.push({ sizeId: "single", footprintIds: ["single"] });
  }

  return options;
}

function canPlaceHugeRockVisualCluster(mapWorld, candidate) {
  return canPlaceRockVisualCluster(mapWorld, candidate, ROCK_CLUSTER_FOOTPRINTS.huge, candidate.naturalBlockType);
}

function occupyRockVisualCluster(mapWorld, cluster) {
  for (const relativeHex of cluster.footprint) {
    mapWorld.rockVisualClusterOccupied.add(makeRelativeKey(cluster.q + relativeHex.q, cluster.r + relativeHex.r));
  }
}

function createRockVisualCluster(mapWorld, anchor, naturalBlockType) {
  const options = getValidRockClusterOptions(mapWorld, anchor, naturalBlockType);

  if (options.length === 0) return null;

  const option = options[getStableHash(anchor.q, anchor.r, mapWorld.seed) % options.length];
  const footprintId = option.footprintIds[
    getStableHash(anchor.q, anchor.r, mapWorld.seed + 17) % option.footprintIds.length
  ];

  return {
    q: anchor.q,
    r: anchor.r,
    naturalBlockType,
    sizeId: option.sizeId,
    footprintId,
    footprint: ROCK_CLUSTER_FOOTPRINTS[footprintId],
  };
}

function ensureRockVisualClusters(mapWorld, visibleHexes) {
  const candidates = [];

  for (const hex of visibleHexes) {
    const key = makeHexKeyFromHex(hex);
    const naturalBlock = getGeneratedNaturalBlock(mapWorld, hex.q, hex.r);

    if (!naturalBlock) continue;
    if (mapWorld.rockVisualClusters.has(key)) continue;
    if (mapWorld.rockVisualClusterOccupied.has(key)) continue;

    candidates.push({
      ...hex,
      key,
      naturalBlockType: naturalBlock.type,
    });
  }

  candidates.sort((a, b) => {
    const hugePriority = Number(canPlaceHugeRockVisualCluster(mapWorld, b)) - Number(canPlaceHugeRockVisualCluster(mapWorld, a));

    if (hugePriority !== 0) return hugePriority;

    return getStableHash(a.q, a.r, mapWorld.seed) - getStableHash(b.q, b.r, mapWorld.seed);
  });

  for (const candidate of candidates) {
    if (mapWorld.rockVisualClusters.has(candidate.key)) continue;
    if (mapWorld.rockVisualClusterOccupied.has(candidate.key)) continue;

    const cluster = createRockVisualCluster(mapWorld, candidate, candidate.naturalBlockType);

    if (!cluster) continue;

    mapWorld.rockVisualClusters.set(candidate.key, cluster);
    occupyRockVisualCluster(mapWorld, cluster);
  }
}

export function drawGeneratedRockClusters(ctx, mapWorld, visibleHexes, size, origin) {
  ensureRockVisualClusters(mapWorld, visibleHexes);

  for (const cluster of mapWorld.rockVisualClusters.values()) {
    const anchorCenter = axialToPixel(cluster, size, origin);
    const clusterCenter = getWallCenter(cluster.footprint, size);

    if (anchorCenter.x + clusterCenter.x < -size * 3) continue;
    if (anchorCenter.x + clusterCenter.x > ctx.canvas.clientWidth + size * 3) continue;
    if (anchorCenter.y + clusterCenter.y < -size * 3) continue;
    if (anchorCenter.y + clusterCenter.y > ctx.canvas.clientHeight + size * 3) continue;

    ctx.save();
    ctx.translate(anchorCenter.x, anchorCenter.y);
    drawRockClusterShape(ctx, cluster.footprint, cluster.naturalBlockType, size, 1);
    ctx.restore();
  }
}
