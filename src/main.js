import { createGame } from "./app/createGame.js";

const canvas = document.querySelector("#game-canvas");
const bootStatus = document.querySelector("#boot-status");

function setBootStatus(text) {
  if (bootStatus) {
    bootStatus.textContent = text;
  }
}

if (!canvas) {
  throw new Error("No se encontró #game-canvas en el documento.");
}

try {
  const game = createGame(canvas);
  game.start();
  setBootStatus("canvas activo");
  window.__HEXADUSTRY_MINI__ = game;
} catch (error) {
  console.error(error);
  setBootStatus("error de arranque: mirar consola");

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#020202";
  ctx.fillRect(0, 0, canvas.width || 640, canvas.height || 360);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Courier New";
  ctx.fillText("HEXADUSTRY MINI - ERROR DE ARRANQUE", 24, 40);
  ctx.fillText(String(error?.message ?? error), 24, 70);
}
