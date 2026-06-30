import { getBuildingsByCategory } from "../content/buildingDefinitions.js";

export const BUILD_CATEGORIES = [
  { id: "turrets", label: "TORRETAS" },
  { id: "extractors", label: "EXTRACTORES" },
  { id: "transporters", label: "TRANSPORTADORES" },
  { id: "factories", label: "FABRICAS" },
  { id: "walls", label: "MUROS" },
  { id: "units", label: "UNIDADES" },
  { id: "support", label: "APOYO" },
];

function getCategoryLabel(categoryId) {
  return BUILD_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function renderBlockButtons(gameState, blockList, status) {
  const categoryId = gameState.ui.buildMenu.activeCategory;
  const definitions = getBuildingsByCategory(categoryId);

  blockList.innerHTML = "";

  if (definitions.length === 0) {
    const empty = document.createElement("span");
    empty.className = "build-menu__empty";
    empty.textContent = "sin bloques";
    blockList.append(empty);
    return;
  }

  for (const definition of definitions) {
    const button = document.createElement("button");
    button.className = "build-menu__block";
    button.type = "button";
    button.dataset.blockId = definition.id;
    button.textContent = definition.label;
    button.classList.toggle("is-active", gameState.ui.buildMenu.selectedBlockId === definition.id);

    button.addEventListener("click", () => {
      gameState.ui.buildMenu.selectedBlockId = definition.id;
      gameState.ui.buildMenu.rotationIndex = 0;

      for (const blockButton of blockList.querySelectorAll(".build-menu__block")) {
        blockButton.classList.toggle("is-active", blockButton.dataset.blockId === definition.id);
      }

      if (status) {
        const rotateHelp = definition.directionMode === "two-way" ? " / R rota" : "";
        status.textContent = `${definition.label}: listo para colocar${rotateHelp}`;
      }
    });

    blockList.append(button);
  }
}

export function bindBuildMenu(gameState) {
  const tabs = [...document.querySelectorAll("[data-build-category]")];
  const categoryLabel = document.querySelector("#build-menu-category-label");
  const status = document.querySelector("#build-menu-status");
  const blockList = document.querySelector("#build-menu-block-list");

  function selectCategory(categoryId) {
    gameState.ui.buildMenu.activeCategory = categoryId;
    gameState.ui.buildMenu.selectedBlockId = null;
    gameState.ui.buildMenu.rotationIndex = 0;

    for (const tab of tabs) {
      tab.classList.toggle("is-active", tab.dataset.buildCategory === categoryId);
    }

    if (categoryLabel) {
      categoryLabel.textContent = getCategoryLabel(categoryId);
    }

    if (status) {
      status.textContent = "sin bloque seleccionado";
    }

    if (blockList) {
      renderBlockButtons(gameState, blockList, status);
    }
  }

  function handleTabClick(event) {
    const categoryId = event.currentTarget.dataset.buildCategory;
    selectCategory(categoryId);
  }

  for (const tab of tabs) {
    tab.addEventListener("click", handleTabClick);
  }

  selectCategory(gameState.ui.buildMenu.activeCategory);

  return () => {
    for (const tab of tabs) {
      tab.removeEventListener("click", handleTabClick);
    }
  };
}
