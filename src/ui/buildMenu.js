import { getBuildingFootprint, getBuildingsByCategory } from "../content/buildingDefinitions.js";
import { isConstructionModeLocked } from "../systems/constructionSystem.js";

export const BUILD_CATEGORIES = [
  { id: "turrets", label: "TORRETAS", icon: "⌖" },
  { id: "extractors", label: "EXTRACTORES", icon: "⌬" },
  { id: "transporters", label: "TRANSPORTADORES", icon: "⇢" },
  { id: "factories", label: "FABRICAS", icon: "⚙" },
  { id: "walls", label: "MUROS", icon: "⬡" },
  { id: "units", label: "UNIDADES", icon: "△" },
  { id: "support", label: "APOYO", icon: "+" },
];

function getCategoryLabel(categoryId) {
  return BUILD_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function getCategoryIcon(categoryId) {
  return BUILD_CATEGORIES.find((category) => category.id === categoryId)?.icon ?? "?";
}

function getMiniHexCenter(hex, hexSize) {
  return {
    x: hexSize * Math.sqrt(3) * (hex.q + hex.r / 2),
    y: hexSize * 1.5 * hex.r,
  };
}

function getMiniHexPoints(center, hexSize) {
  const points = [];

  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i - 30);

    points.push(`${center.x + hexSize * Math.cos(angle)},${center.y + hexSize * Math.sin(angle)}`);
  }

  return points.join(" ");
}

function createBlockPreview(definition) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const footprint = getBuildingFootprint(definition, 0);
  const hexSize = 8;
  const centers = footprint.map((hex) => getMiniHexCenter(hex, hexSize));
  const minX = Math.min(...centers.map((center) => center.x)) - hexSize;
  const maxX = Math.max(...centers.map((center) => center.x)) + hexSize;
  const minY = Math.min(...centers.map((center) => center.y)) - hexSize;
  const maxY = Math.max(...centers.map((center) => center.y)) + hexSize;
  const offsetX = 32 - (minX + maxX) / 2;
  const offsetY = 24 - (minY + maxY) / 2;

  svg.classList.add("build-menu__block-preview");
  svg.setAttribute("viewBox", "0 0 64 48");
  svg.setAttribute("aria-hidden", "true");
  group.setAttribute("transform", `translate(${offsetX} ${offsetY})`);

  for (const hex of footprint) {
    const center = getMiniHexCenter(hex, hexSize);
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

    polygon.setAttribute("points", getMiniHexPoints(center, hexSize));
    polygon.classList.add("build-menu__block-hex");
    group.append(polygon);
  }

  svg.append(group);

  return svg;
}

function syncBlockSelection(gameState, blockList) {
  for (const blockButton of blockList.querySelectorAll(".build-menu__block")) {
    blockButton.classList.toggle("is-active", blockButton.dataset.blockId === gameState.ui.buildMenu.selectedBlockId);
  }
}

function showConstructionLockStatus(status) {
  if (status) {
    status.textContent = "construccion en curso";
  }
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
    const label = document.createElement("span");

    button.className = "build-menu__block";
    button.type = "button";
    button.dataset.blockId = definition.id;
    button.title = definition.label;
    button.setAttribute("aria-label", definition.label);
    button.classList.toggle("is-active", gameState.ui.buildMenu.selectedBlockId === definition.id);

    label.className = "build-menu__block-label";
    label.textContent = definition.label;

    button.append(createBlockPreview(definition), label);

    button.addEventListener("click", () => {
      if (isConstructionModeLocked(gameState)) {
        showConstructionLockStatus(status);
        syncBlockSelection(gameState, blockList);
        return;
      }

      gameState.ui.buildMenu.selectedBlockId = definition.id;
      gameState.ui.buildMenu.rotationIndex = 0;
      syncBlockSelection(gameState, blockList);

      if (status) {
        const rotateHelp = definition.directionMode === "two-way" ? " / R rota" : "";
        status.textContent = `${definition.label}: listo${rotateHelp}`;
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
    if (isConstructionModeLocked(gameState)) {
      showConstructionLockStatus(status);
      return;
    }

    gameState.ui.buildMenu.activeCategory = categoryId;
    gameState.ui.buildMenu.selectedBlockId = null;
    gameState.ui.buildMenu.rotationIndex = 0;

    for (const tab of tabs) {
      const isActive = tab.dataset.buildCategory === categoryId;

      tab.classList.toggle("is-active", isActive);
      tab.textContent = getCategoryIcon(tab.dataset.buildCategory);
      tab.title = getCategoryLabel(tab.dataset.buildCategory);
      tab.setAttribute("aria-label", getCategoryLabel(tab.dataset.buildCategory));
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
