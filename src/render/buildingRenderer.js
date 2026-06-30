import { getBuildingDefinition, getBuildingFootprint } from "../content/buildingDefinitions.js";
import { axialToPixel } from "../hex/hexMath.js";
import { easeOutCubic } from "./renderUtils.js";
import {
  drawAnimatedWallShape,
  drawCoreShape,
  drawHexWallShape,
  drawQueuedBuildPreviewShape,
} from "./wallShapeRenderer.js";

const BUILD_ANIMATION_YELLOW = [255, 226, 64];
const BUILD_ANIMATION_RED = [255, 64, 64];
const ENTITY_GLYPHS = {
  drill: "DRL",
  conveyor: ">>>",
  turret: "TRT",
};

export function drawBuilding(ctx, building, size, origin, gameState) {
  const center = axialToPixel(building, size, origin);
  const radius = size * 0.48;

  ctx.save();
  ctx.translate(center.x, center.y);

  if (building.deconstructing) {
    ctx.globalAlpha = 0.46;
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillStyle = "rgba(0, 0, 0, 0.84)";
  ctx.lineWidth = 2;

  if (building.type === "core") {
    drawCoreShape(ctx, building, size, gameState, 1);
  } else if (building.type === "drill") {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
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
  } else if (building.type === "wall") {
    drawHexWallShape(ctx, building, size, 1);
  }

  if (building.type !== "wall" && building.type !== "core") {
    ctx.font = `${Math.floor(size * 0.22)}px Courier New`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillText(ENTITY_GLYPHS[building.type] ?? "???", 0, radius + size * 0.22);
  }

  ctx.restore();
}

export function drawPendingConstruction(ctx, construction, size, origin) {
  const center = axialToPixel(construction, size, origin);
  const progress = Math.min(1, construction.elapsed / construction.totalTime);

  ctx.save();
  ctx.translate(center.x, center.y);
  drawQueuedBuildPreviewShape(ctx, construction, size);

  if (progress > 0) {
    const scale = 0.16 + easeOutCubic(progress) * 0.84;
    drawAnimatedWallShape(ctx, construction, size, BUILD_ANIMATION_YELLOW, 0.34, scale);
  }

  ctx.restore();
}

export function drawPendingDeconstruction(ctx, deconstruction, size, origin) {
  const center = axialToPixel(deconstruction, size, origin);
  const progress = Math.min(1, deconstruction.elapsed / deconstruction.totalTime);
  const scale = Math.max(0.06, 1 - easeOutCubic(progress) * 0.94);

  ctx.save();
  ctx.translate(center.x, center.y);
  drawAnimatedWallShape(ctx, deconstruction, size, BUILD_ANIMATION_RED, 0.42, scale);
  ctx.restore();
}

export function drawBuildPreview(ctx, gameState, size, origin) {
  const hoveredHex = gameState.ui.buildMenu.hoveredHex;
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const definition = getBuildingDefinition(selectedBlockId);

  if (!hoveredHex || !definition) return;

  const footprint = getBuildingFootprint(definition, gameState.ui.buildMenu.rotationIndex);
  const center = axialToPixel(hoveredHex, size, origin);

  ctx.save();
  ctx.translate(center.x, center.y);
  drawQueuedBuildPreviewShape(ctx, { footprint }, size);
  ctx.restore();
}
