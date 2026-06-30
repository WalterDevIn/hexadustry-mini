import { createCanvasRenderer } from "../render/canvasRenderer.js";
import { createInitialWorld } from "../world/createInitialWorld.js";

export function createGame(canvas) {
  const world = createInitialWorld();
  const renderer = createCanvasRenderer(canvas, world);

  let animationFrameId = null;

  function frame() {
    renderer.render();
    animationFrameId = requestAnimationFrame(frame);
  }

  function start() {
    renderer.resize();
    frame();
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
    world,
    start,
    stop,
    destroy() {
      stop();
      window.removeEventListener("resize", handleResize);
    },
  };
}
