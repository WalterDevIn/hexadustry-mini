import { axialToPixel, buildHexPolygon } from "../hex/hexMath.js";

const ENTITY_GLYPHS = {
  core: "CORE",
  drill: "DRL",
  conveyor: ">>>",
  turret: "TRT",
  crawler: "BUG",
};

function drawPath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.closePath();
}

function drawHex(ctx, hex, tile, size, origin) {
  const polygon = buildHexPolygon(hex, size, origin);

  drawPath(ctx, polygon.corners);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (tile?.ore) {
    ctx.beginPath();
    ctx.arc(polygon.center.x, polygon.center.y, size * 0.16, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fillText("ORE", polygon.center.x, polygon.center.y + size * 0.36);
  }
}

function drawBuilding(ctx, building, size, origin) {
  const center = axialToPixel(building, size, origin);
  const radius = size * 0.48;

  ctx.save();
  ctx.translate(center.x, center.y);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
  ctx.lineWidth = 2;

  if (building.type === "core") {
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, radius);
    ctx.stroke();
  } else if (building.type === "drill") {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.55, -radius * 0.55);
    ctx.lineTo(radius * 0.55, radius * 0.55);
    ctx.moveTo(radius * 0.55, -radius * 0.55);
    ctx.lineTo(-radius * 0.55, radius * 0.55);
    ctx.stroke();
  } else if (building.type === "conveyor") {
    ctx.beginPath();
    ctx.moveTo(-radius, -radius * 0.45);
    ctx.lineTo(radius, 0);
    ctx.lineTo(-radius, radius * 0.45);
    ctx.closePath();
    ctx.stroke();
  } else if (building.type === "turret") {
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 1.05, -radius * 0.25);
    ctx.stroke();
  }

  ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(ENTITY_GLYPHS[building.type] ?? "???", 0, radius + size * 0.22);

  ctx.restore();
}

function drawEnemy(ctx, enemy, size, origin) {
  const center = axialToPixel(enemy, size, origin);
  const radius = size * 0.34;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius, radius);
  ctx.lineTo(-radius, radius);
  ctx.closePath();
  ctx.stroke();

  ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ENTITY_GLYPHS[enemy.type] ?? "ENM", 0, radius + size * 0.22);

  ctx.restore();
}

function drawScanlines(ctx, width, height) {
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

export function createCanvasRenderer(canvas, world) {
  const ctx = canvas.getContext("2d");
  const camera = {
    zoom: 1,
    origin: { x: 0, y: 0 },
  };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const hexSize = Math.max(22, Math.min(width, height) / 22) * camera.zoom;
    const origin = {
      x: width / 2 + camera.origin.x,
      y: height / 2 + camera.origin.y,
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#020202";
    ctx.fillRect(0, 0, width, height);

    for (const hex of world.hexes) {
      const tile = world.tileMap.get(`${hex.q},${hex.r}`);
      drawHex(ctx, hex, tile, hexSize, origin);
    }

    for (const building of world.buildings) {
      drawBuilding(ctx, building, hexSize, origin);
    }

    for (const enemy of world.enemies) {
      drawEnemy(ctx, enemy, hexSize, origin);
    }

    drawScanlines(ctx, width, height);
  }

  return {
    resize,
    render,
  };
}
