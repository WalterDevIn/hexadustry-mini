const KEY_BINDINGS = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

export function bindKeyboardInput(input, actions = {}) {
  function setInputState(event, value) {
    const action = KEY_BINDINGS[event.code];

    if (!action) return false;

    input[action] = value;
    event.preventDefault();

    return true;
  }

  function handleKeyDown(event) {
    if (setInputState(event, true)) return;

    if (event.code === "KeyV" && !event.repeat) {
      actions.respawnAtCore?.();
      event.preventDefault();
    }
  }

  function handleKeyUp(event) {
    setInputState(event, false);
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}
