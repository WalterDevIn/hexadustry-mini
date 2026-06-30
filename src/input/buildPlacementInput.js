import { pixelToAxial, roundAxial } from "../hex/hexMath.js";
import { requestBuildAt, requestDeconstructAt } from "../systems/constructionSystem.js";

function getCameraTarget(gameState) {
  return gameState.ecsWorld.components.transform.get(gameState.playerEntityId) ?? { x: 0, y: 0 };
}

function getPointerHex(canvas, gameState, event) {
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
  const worldPoint = {
    x: screenPoint.x - origin.x,
    y: screenPoint.y - origin.y,
  };

  return roundAxial(pixelToAxial(worldPoint, gameState.mapWorld.hexSize));
}

export function bindBuildPlacementInput(canvas, gameState) {
  function updateHover(event) {
    gameState.ui.buildMenu.hoveredHex = getPointerHex(canvas, gameState, event);
  }

  function handlePointerMove(event) {
    updateHover(event);
  }

  function handlePointerLeave() {
    gameState.ui.buildMenu.hoveredHex = null;
  }

  function handlePointerDown(event) {
    updateHover(event);
    const hoveredHex = gameState.ui.buildMenu.hoveredHex;

    if (!hoveredHex) return;

    if (event.button === 0) {
      requestBuildAt(gameState, hoveredHex.q, hoveredHex.r);
      event.preventDefault();
    }

    if (event.button === 2) {
      requestDeconstructAt(gameState, hoveredHex.q, hoveredHex.r);
      event.preventDefault();
    }
  }

  function handleContextMenu(event) {
    event.preventDefault();
  }

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", handlePointerLeave);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("contextmenu", handleContextMenu);

  return () => {
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerleave", handlePointerLeave);
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("contextmenu", handleContextMenu);
  };
}
