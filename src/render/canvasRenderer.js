import { generateVisibleHexes } from "../hex/hexMath.js";
import { ensureChunksForHexes } from "../world/chunkedCaveGeneration.js";
import { getTile, MAP_LAYERS } from "../world/createInitialWorld.js";
import {
  drawBuildPreview,
  drawBuilding,
  drawPendingConstruction,
  drawPendingDeconstruction,
} from "./buildingRenderer.js";
import { drawEntitiesOnLayer } from "./entityRenderer.js";
import { drawScanlines } from "./renderUtils.js";
import {
  drawGeneratedRockClusters,
  drawGroundLayer,
  drawSurfaceLayer,
} from "./terrainRenderer.js";

function getCameraTarget(gameState) {
  return gameState.ecsWorld.components.transform.get(gameState.playerEntityId) ?? { x: 0, y: 0 };
}

function getScreenOrigin(width, height, cameraTarget) {
  return {
    x: width / 2 - cameraTarget.x,
    y: height / 2 - cameraTarget.y,
  };
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#020202";
  ctx.fillRect(0, 0, width, height);
}

function drawMapLayers(ctx, mapWorld, visibleHexes, hexSize, origin) {
  for (const hex of visibleHexes) {
    drawGroundLayer(ctx, hex, getTile(mapWorld, hex.q, hex.r), hexSize, origin);
  }

  for (const hex of visibleHexes) {
    drawSurfaceLayer(ctx, hex, getTile(mapWorld, hex.q, hex.r), hexSize, origin);
  }

  drawGeneratedRockClusters(ctx, mapWorld, visibleHexes, hexSize, origin);
}

function drawConstructionLayers(ctx, gameState, hexSize, origin) {
  drawBuildPreview(ctx, gameState, hexSize, origin);

  for (const construction of gameState.mapWorld.pendingConstructions) {
    drawPendingConstruction(ctx, construction, hexSize, origin);
  }

  for (const building of gameState.mapWorld.buildings) {
    drawBuilding(ctx, building, hexSize, origin, gameState);
  }

  for (const deconstruction of gameState.mapWorld.pendingDeconstructions) {
    drawPendingDeconstruction(ctx, deconstruction, hexSize, origin);
  }
}

export function createCanvasRenderer(canvas, gameState) {
  const ctx = canvas.getContext("2d");
  const camera = { zoom: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    const { mapWorld, ecsWorld } = gameState;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const hexSize = mapWorld.hexSize * camera.zoom;
    const cameraTarget = getCameraTarget(gameState);
    const origin = getScreenOrigin(width, height, cameraTarget);
    const visibleHexes = generateVisibleHexes({
      cameraCenter: cameraTarget,
      viewport: { width, height },
      hexSize,
      mapRadius: mapWorld.mapRadius,
      padding: 4,
    });

    clearCanvas(ctx, width, height);
    ensureChunksForHexes(mapWorld, visibleHexes);
    drawMapLayers(ctx, mapWorld, visibleHexes, hexSize, origin);
    drawConstructionLayers(ctx, gameState, hexSize, origin);
    drawEntitiesOnLayer(ctx, ecsWorld, MAP_LAYERS.surface, origin, gameState);
    drawEntitiesOnLayer(ctx, ecsWorld, MAP_LAYERS.air, origin, gameState);
    drawScanlines(ctx, width, height);
  }

  return { resize, render };
}
