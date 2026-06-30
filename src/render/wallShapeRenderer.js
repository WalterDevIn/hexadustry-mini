import { axialToPixel, hexCorner, HEX_DIRECTIONS } from "../hex/hexMath.js";
import { drawPath, rgba } from "./renderUtils.js";

const HEX_EDGE_BY_DIRECTION = [0, 5, 4, 3, 2, 1];

export function makeRelativeKey(q, r) {
  return `${q},${r}`;
}

export function makeHexKeyFromHex(hex) {
  return makeRelativeKey(hex.q, hex.r);
}

export function getWallFootprint(source) {
  return source.footprint ?? [{ q: 0, r: 0 }];
}

export function getWallCorners(relativeHex, size) {
  const center = axialToPixel(relativeHex, size);
  const corners = [];

  for (let i = 0; i < 6; i += 1) {
    corners.push(hexCorner(center, size, i));
  }

  return corners;
}

export function getWallBoundarySegments(footprint, size) {
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

export function getWallCenter(footprint, size) {
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

export function strokeSegments(ctx, segments) {
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

export function drawHexWallShape(ctx, source, size, alpha = 1) {
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

function drawCoreHexShell(ctx, building, size, alpha = 1) {
  const footprint = getWallFootprint(building);
  const wallCenter = getWallCenter(footprint, size);
  const outerSegments = getWallBoundarySegments(footprint, size);
  const innerSegments = insetSegmentsToward(outerSegments, wallCenter, getInnerWallInset(size));

  fillWallFootprint(ctx, footprint, size, alpha);

  ctx.strokeStyle = `rgba(255, 226, 64, ${0.98 * alpha})`;
  ctx.lineWidth = 2.25;
  strokeSegments(ctx, outerSegments);

  ctx.strokeStyle = `rgba(255, 236, 126, ${0.96 * alpha})`;
  ctx.lineWidth = 1.75;
  strokeSegments(ctx, innerSegments);
}

function getSpawnProgress(gameState) {
  const spawn = gameState.playerSpawn;

  if (!spawn?.active) return 1;

  return Math.min(1, spawn.elapsed / spawn.duration);
}

function drawAssemblyLine(ctx, half, gameState) {
  const spawn = gameState.playerSpawn;

  if (!spawn?.active) return;

  const progress = getSpawnProgress(gameState);
  const y = Math.sin(progress * Math.PI * 4) * half * 0.62;

  ctx.strokeStyle = `rgba(255, 236, 126, ${0.4 + progress * 0.58})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-half * 0.72, y);
  ctx.lineTo(half * 0.72, y);
  ctx.stroke();
}

export function drawCoreShape(ctx, building, size, gameState, alpha = 1) {
  const footprint = getWallFootprint(building);
  const center = getWallCenter(footprint, size);
  const squareSize = size * 1.5;
  const half = squareSize / 2;

  drawCoreHexShell(ctx, building, size, alpha);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.fillStyle = `rgba(255, 226, 64, ${0.09 * alpha})`;
  ctx.strokeStyle = `rgba(255, 236, 126, ${0.98 * alpha})`;
  ctx.lineWidth = 2.4;
  ctx.fillRect(-half, -half, squareSize, squareSize);
  ctx.strokeRect(-half, -half, squareSize, squareSize);
  ctx.strokeStyle = `rgba(255, 226, 64, ${0.5 * alpha})`;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-half * 0.62, -half * 0.62, squareSize * 0.62, squareSize * 0.62);
  drawAssemblyLine(ctx, half, gameState);
  ctx.restore();
}

export function drawQueuedBuildPreviewShape(ctx, source, size) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  drawHexWallShape(ctx, source, size, 0.72);
  ctx.restore();
}

export function drawAnimatedWallShape(ctx, source, size, color, alpha, scale) {
  const footprint = getWallFootprint(source);
  const wallCenter = getWallCenter(footprint, size);

  ctx.save();
  ctx.translate(wallCenter.x, wallCenter.y);
  ctx.scale(scale, scale);
  ctx.translate(-wallCenter.x, -wallCenter.y);
  ctx.fillStyle = rgba(color, alpha);

  for (const hex of footprint) {
    drawPath(ctx, getWallCorners(hex, size));
    ctx.fill();
  }

  ctx.restore();
}
