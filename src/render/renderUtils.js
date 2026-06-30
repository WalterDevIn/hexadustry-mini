export const DEFAULT_RENDER_COLORS = {
  stroke: "rgba(255, 255, 255, 0.96)",
  fill: "rgba(0, 0, 0, 0.74)",
  label: "rgba(255, 255, 255, 0.9)",
  aura: "rgba(255, 255, 255, 0.22)",
};

export function rgba(color, alpha) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export function drawPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.closePath();
}

export function getSpawnProgress(gameState) {
  const spawn = gameState.playerSpawn;

  if (!spawn?.active) return 1;

  return Math.min(1, spawn.elapsed / spawn.duration);
}

export function drawScanlines(ctx, width, height) {
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
