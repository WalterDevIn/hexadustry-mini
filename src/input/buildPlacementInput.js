import { axialToPixel, pixelToAxial, roundAxial } from "../hex/hexMath.js";
import { getBuildingDefinition, getBuildingFootprint, getBuildingRotationCount } from "../content/buildingDefinitions.js";
import { requestBuildAt, requestDeconstructAt } from "../systems/constructionSystem.js";

function getCameraTarget(gameState) {
  return gameState.ecsWorld.components.transform.get(gameState.playerEntityId) ?? { x: 0, y: 0 };
}

function getPointerWorldPoint(canvas, gameState, event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  const cameraTarget = getCameraTarget(gameState);
  const origin = {
    x: canvas.clientWidth / 2 - cameraTarget.x,
    y: canvas.clientHeight / 2 - cameraTarget.y,
  };

  return {
    x: screenPoint.x - origin.x,
    y: screenPoint.y - origin.y,
  };
}

function getFootprintCenterOffset(footprint, hexSize) {
  const total = footprint.reduce(
    (sum, hex) => {
      const center = axialToPixel(hex, hexSize);

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

function getSelectedBuildDefinition(gameState) {
  return getBuildingDefinition(gameState.ui.buildMenu.selectedBlockId);
}

function getPointerAnchorHex(gameState, pointerWorld) {
  const definition = getSelectedBuildDefinition(gameState);
  const hexSize = gameState.mapWorld.hexSize;

  if (!definition?.snapMouseToFootprintCenter) {
    return roundAxial(pixelToAxial(pointerWorld, hexSize));
  }

  const footprint = getBuildingFootprint(definition, gameState.ui.buildMenu.rotationIndex);
  const footprintCenter = getFootprintCenterOffset(footprint, hexSize);
  const anchorPoint = {
    x: pointerWorld.x - footprintCenter.x,
    y: pointerWorld.y - footprintCenter.y,
  };

  return roundAxial(pixelToAxial(anchorPoint, hexSize));
}

function updateHoveredHexFromPointer(gameState) {
  if (!gameState.input.pointerWorld) {
    gameState.ui.buildMenu.hoveredHex = null;
    return;
  }

  gameState.ui.buildMenu.hoveredHex = getPointerAnchorHex(gameState, gameState.input.pointerWorld);
}

function cycleSelectedBlockRotation(gameState) {
  const definition = getSelectedBuildDefinition(gameState);
  const rotationCount = getBuildingRotationCount(definition);

  if (rotationCount <= 1) return;

  gameState.ui.buildMenu.rotationIndex = (gameState.ui.buildMenu.rotationIndex + 1) % rotationCount;
  updateHoveredHexFromPointer(gameState);
}

export function bindBuildPlacementInput(canvas, gameState) {
  function updatePointer(event) {
    const pointerWorld = getPointerWorldPoint(canvas, gameState, event);

    gameState.input.pointerWorld = pointerWorld;
    updateHoveredHexFromPointer(gameState);
  }

  function handlePointerMove(event) {
    updatePointer(event);
  }

  function handlePointerLeave() {
    gameState.input.pointerWorld = null;
    gameState.ui.buildMenu.hoveredHex = null;
  }

  function handlePointerDown(event) {
    updatePointer(event);
    const hoveredHex = gameState.ui.buildMenu.hoveredHex;

    if (!hoveredHex) return;

    if (event.button === 0) {
      const construction = requestBuildAt(gameState, hoveredHex.q, hoveredHex.r);

      if (construction) {
        gameState.playerAimLock = {
          constructionId: construction.id,
          target: axialToPixel(hoveredHex, gameState.mapWorld.hexSize),
        };
      }

      event.preventDefault();
    }

    if (event.button === 2) {
      requestDeconstructAt(gameState, hoveredHex.q, hoveredHex.r);
      event.preventDefault();
    }
  }

  function handleKeyDown(event) {
    if (event.code !== "KeyR") return;

    cycleSelectedBlockRotation(gameState);
    event.preventDefault();
  }

  function handleContextMenu(event) {
    event.preventDefault();
  }

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", handlePointerLeave);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("keydown", handleKeyDown);

  return () => {
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerleave", handlePointerLeave);
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("keydown", handleKeyDown);
  };
}
