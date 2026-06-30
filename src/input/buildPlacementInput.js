import { axialToPixel, pixelToAxial, roundAxial } from "../hex/hexMath.js";
import { getBuildingDefinition, getBuildingRotationCount } from "../content/buildingDefinitions.js";
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

function cycleSelectedBlockRotation(gameState) {
  const selectedBlockId = gameState.ui.buildMenu.selectedBlockId;
  const definition = getBuildingDefinition(selectedBlockId);
  const rotationCount = getBuildingRotationCount(definition);

  if (rotationCount <= 1) return;

  gameState.ui.buildMenu.rotationIndex = (gameState.ui.buildMenu.rotationIndex + 1) % rotationCount;
}

export function bindBuildPlacementInput(canvas, gameState) {
  function updatePointer(event) {
    const pointerWorld = getPointerWorldPoint(canvas, gameState, event);

    gameState.input.pointerWorld = pointerWorld;
    gameState.ui.buildMenu.hoveredHex = roundAxial(pixelToAxial(pointerWorld, gameState.mapWorld.hexSize));
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
