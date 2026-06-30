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

export function bindKeyboardInput(input) {
  function setInputState(event, value) {
    const action = KEY_BINDINGS[event.code];

    if (!action) return;

    input[action] = value;
    event.preventDefault();
  }

  function handleKeyDown(event) {
    setInputState(event, true);
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
