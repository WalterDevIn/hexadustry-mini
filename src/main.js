import "./styles.css";
import { createGame } from "./app/createGame.js";

const canvas = document.querySelector("#game-canvas");

if (!canvas) {
  throw new Error("No se encontró #game-canvas en el documento.");
}

const game = createGame(canvas);
game.start();

window.__HEXADUSTRY_MINI__ = game;
