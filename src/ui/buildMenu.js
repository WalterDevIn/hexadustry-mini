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

export function bindBuildMenu(gameState) {
  const tabs = [...document.querySelectorAll("[data-build-category]")];
  const categoryLabel = document.querySelector("#build-menu-category-label");
  const status = document.querySelector("#build-menu-status");

  function selectCategory(categoryId) {
    gameState.ui.buildMenu.activeCategory = categoryId;
    gameState.ui.buildMenu.selectedBlockId = null;

    for (const tab of tabs) {
      tab.classList.toggle("is-active", tab.dataset.buildCategory === categoryId);
    }

    if (categoryLabel) {
      categoryLabel.textContent = getCategoryLabel(categoryId);
    }

    if (status) {
      status.textContent = "sin bloque seleccionado";
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
