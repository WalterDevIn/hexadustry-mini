import { createInitialGameState } from "../game/createInitialGameState.js";
import { bindKeyboardInput } from "../input/keyboardInput.js";
import { createCanvasRenderer } from "../render/canvasRenderer.js";
import { enemyAiSystem } from "../systems/enemyAiSystem.js";
import { groundEnemySystem } from "../systems/groundEnemySystem.js";
import { movementSystem } from "../systems/movementSystem.js";
import { playerControlSystem } from "../systems/playerControlSystem.js";
import { bindBuildMenu } from "../ui/buildMenu.js";

const MAX_DT = 1 / 20;

export function createGame(canvas) {
  const gameState = createInitialGameState();
  const renderer = createCanvasRenderer(canvas, gameState);
  const unbindKeyboardInput = bindKeyboardInput(gameState.input);
  const unbindBuildMenu = bindBuildMenu(gameState);

  let animationFrameId = null;

  function update(dt) {
    playerControlSystem(gameState, dt);
    enemyAiSystem(gameState, dt);
    groundEnemySystem(gameState, dt);
    movementSystem(gameState, dt);
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
      window.removeEventListener("resize", handleResize);
    },
  };
}
