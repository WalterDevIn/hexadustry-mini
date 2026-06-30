import { createInitialGameState } from "../game/createInitialGameState.js";
import { bindBuildPlacementInput } from "../input/buildPlacementInput.js";
import { bindKeyboardInput } from "../input/keyboardInput.js";
import { createCanvasRenderer } from "../render/canvasRenderer.js";
import { constructionSystem } from "../systems/constructionSystem.js";
import { respawnPlayerAtCore } from "../systems/coreRespawnSystem.js";
import { drillSystem } from "../systems/drillSystem.js";
import { enemyAiSystem } from "../systems/enemyAiSystem.js";
import { groundEnemySystem } from "../systems/groundEnemySystem.js";
import { movementSystem } from "../systems/movementSystem.js";
import { playerControlSystem } from "../systems/playerControlSystem.js";
import { playerTurretSystem } from "../systems/playerTurretSystem.js";
import { projectileSystem } from "../systems/projectileSystem.js";
import { bindBuildMenu } from "../ui/buildMenu.js";

const MAX_DT = 1 / 20;

export function createGame(canvas) {
  const gameState = createInitialGameState();
  const renderer = createCanvasRenderer(canvas, gameState);
  const unbindKeyboardInput = bindKeyboardInput(gameState.input, {
    respawnAtCore: () => respawnPlayerAtCore(gameState),
  });
  const unbindBuildMenu = bindBuildMenu(gameState);
  const unbindBuildPlacementInput = bindBuildPlacementInput(canvas, gameState);

  let animationFrameId = null;

  function update(dt) {
    playerControlSystem(gameState, dt);
    playerTurretSystem(gameState, dt);
    enemyAiSystem(gameState, dt);
    groundEnemySystem(gameState, dt);
    movementSystem(gameState, dt);
    projectileSystem(gameState, dt);
    constructionSystem(gameState, dt);
    drillSystem(gameState, dt);
  }

  function frame(timestamp) {
    const previousTimestamp = gameState.time.lastTimestamp || timestamp;
    const dt = Math.min((timestamp - previousTimestamp) / 1000, MAX_DT);

    gameState.time.lastTimestamp = timestamp;

    update(dt);
    renderer.render();

    animationFrameId = requestAnimationFrame(frame);
  }

  function start() {
    renderer.resize();
    animationFrameId = requestAnimationFrame(frame);
  }

  function stop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function handleResize() {
    renderer.resize();
  }

  window.addEventListener("resize", handleResize);

  return {
    gameState,
    start,
    stop,
    destroy() {
      stop();
      unbindKeyboardInput();
      unbindBuildMenu();
      unbindBuildPlacementInput();
      window.removeEventListener("resize", handleResize);
    },
  };
}
