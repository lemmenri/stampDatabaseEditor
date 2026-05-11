import { appState, allBlockOptions } from "./state.js";
import { moveStamp, reorderBlocks, reorderStamps } from "./api.js";

function el(selector) {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing DOM node: ${selector}`);
  }
  return node;
}

const blocksContainer = el("#blocksContainer");
const stampCardTemplate = el("#stampCardTemplate");
const blockDialog = el("#blockDialog");
const stampDialog = el("#stampDialog");
const blockForm = el("#blockForm");
const stampForm = el("#stampForm");
const stampBlockSelect = el("#stampBlockSelect");
const addBlockBtn = document.getElementById("addBlockBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const blockFormError = document.getElementById("blockFormError");
const stampFormError = document.getElementById("stampFormError");
const toggleCollapseAllBtn = document.getElementById("toggleCollapseAllBtn");
const closeBlockDialogBtn = document.getElementById("closeBlockDialogBtn");
const closeStampDialogBtn = document.getElementById("closeStampDialogBtn");
const cancelBlockBtn = document.getElementById("cancelBlockBtn");
const cancelStampBtn = document.getElementById("cancelStampBtn");
const collapsedBlockIds = new Set();

const defaultFilter = () => ({
  yearAfter: null,
  yearBefore: null,
  catalogNumber: "",
  nvphNumber: "",
  blockName: "",
  stampCount: null,
  stampCountOperator: ">",
  color: "",
  denomination: "",
  width: null,
  widthMissing: false,
  height: null,
  heightMissing: false,
  missingImages: false,
});
let currentFilter = defaultFilter();

function parseYears(yearStr) {
  if (!yearStr) return [];
  return (String(yearStr).match(/\d{4}/g) || []).map(Number);
}

function blockPassesFilter(f, block) {
  if (f.yearBefore !== null) {
    const years = parseYears(block.year);
    if (!years.length || Math.min(...years) >= f.yearBefore) return false;
  }
  if (f.yearAfter !== null) {
    const years = parseYears(block.year);
    if (!years.length || Math.max(...years) <= f.yearAfter) return false;
  }
  if (f.blockName) {
    if (!(block.title || "").toLowerCase().includes(f.blockName.toLowerCase()))
      return false;
  }
  if (f.stampCount !== null) {
    const stampCount = block.stamps?.length ?? 0;
    if (f.stampCountOperator === ">" && !(stampCount > f.stampCount)) {
      return false;
    }
    if (f.stampCountOperator === "<" && !(stampCount < f.stampCount)) {
      return false;
    }
    if (f.stampCountOperator === "=" && stampCount !== f.stampCount) {
      return false;
    }
  }
  return true;
}

function stampPassesFilter(f, stamp) {
  if (
    f.catalogNumber &&
    !(stamp.catalog_number || "")
      .toLowerCase()
      .includes(f.catalogNumber.toLowerCase())
  )
    return false;
  if (
    f.nvphNumber &&
    !(stamp.nvph_number || "")
      .toLowerCase()
      .includes(f.nvphNumber.toLowerCase())
  )
    return false;
  if (
    f.color &&
    !(stamp.color || "").toLowerCase().includes(f.color.toLowerCase())
  )
    return false;
  if (
    f.denomination &&
    !(stamp.denomination || "")
      .toLowerCase()
      .includes(f.denomination.toLowerCase())
  )
    return false;
  if (f.widthMissing) {
    if (Number(stamp.width) > 0) return false;
  } else if (f.width !== null) {
    if (Number(stamp.width) !== f.width) return false;
  }
  if (f.heightMissing) {
    if (Number(stamp.height) > 0) return false;
  } else if (f.height !== null) {
    if (Number(stamp.height) !== f.height) return false;
  }
  if (f.missingImages) {
    if (stamp.image_url || stamp.image_path) return false;
  }
  return true;
}

function hasStampLevelFilter(f) {
  return !!(
    f.catalogNumber ||
    f.nvphNumber ||
    f.color ||
    f.denomination ||
    f.width !== null ||
    f.widthMissing ||
    f.height !== null ||
    f.heightMissing ||
    f.missingImages
  );
}

function countActiveFilters(f) {
  let n = 0;
  if (f.yearAfter !== null) n++;
  if (f.yearBefore !== null) n++;
  if (f.catalogNumber) n++;
  if (f.nvphNumber) n++;
  if (f.blockName) n++;
  if (f.stampCount !== null) n++;
  if (f.color) n++;
  if (f.denomination) n++;
  if (f.width !== null) n++;
  if (f.widthMissing) n++;
  if (f.height !== null) n++;
  if (f.heightMissing) n++;
  if (f.missingImages) n++;
  return n;
}

export function bindFilterPanel(onFilterChange) {
  const filterToggleBtn = document.getElementById("filterToggleBtn");
  const filterPanel = document.getElementById("filterPanel");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  function updateToggleLabel() {
    const n = countActiveFilters(currentFilter);
    filterToggleBtn.textContent = n > 0 ? `Filters (${n})` : "Filters";
    filterToggleBtn.classList.toggle("filter-btn--active", n > 0);
  }

  function readAndApply() {
    currentFilter = {
      yearAfter: filterPanel.querySelector("#filterYearAfter").value
        ? Number(filterPanel.querySelector("#filterYearAfter").value)
        : null,
      yearBefore: filterPanel.querySelector("#filterYearBefore").value
        ? Number(filterPanel.querySelector("#filterYearBefore").value)
        : null,
      catalogNumber: filterPanel
        .querySelector("#filterCatalogNumber")
        .value.trim(),
      nvphNumber: filterPanel.querySelector("#filterNvphNumber").value.trim(),
      blockName: filterPanel.querySelector("#filterBlockName").value.trim(),
      stampCount: filterPanel.querySelector("#filterStampCount").value
        ? Number(filterPanel.querySelector("#filterStampCount").value)
        : null,
      stampCountOperator: filterPanel.querySelector("#filterStampCountOperator")
        .value,
      color: filterPanel.querySelector("#filterColor").value.trim(),
      denomination: filterPanel
        .querySelector("#filterDenomination")
        .value.trim(),
      width: filterPanel.querySelector("#filterWidth").value
        ? Number(filterPanel.querySelector("#filterWidth").value)
        : null,
      widthMissing: filterPanel.querySelector("#filterWidthMissing").checked,
      height: filterPanel.querySelector("#filterHeight").value
        ? Number(filterPanel.querySelector("#filterHeight").value)
        : null,
      heightMissing: filterPanel.querySelector("#filterHeightMissing").checked,
      missingImages: filterPanel.querySelector("#filterMissingImages").checked,
    };
    updateToggleLabel();
    onFilterChange();
  }

  filterToggleBtn.addEventListener("click", () => {
    filterPanel.hidden = !filterPanel.hidden;
  });

  clearFiltersBtn.addEventListener("click", () => {
    filterPanel
      .querySelectorAll("input[type='number'], input[type='search']")
      .forEach((input) => {
        input.value = "";
      });
    filterPanel.querySelectorAll("select").forEach((select) => {
      select.selectedIndex = 0;
    });
    filterPanel.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
    });
    readAndApply();
  });

  filterPanel.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", readAndApply);
    field.addEventListener("change", readAndApply);
  });
}

function openDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
  }
}

export function openBlockDialog() {
  openDialog(blockDialog);
}

export function openStampDialog() {
  openDialog(stampDialog);
}

export function closeBlockDialog() {
  if (blockDialog.open) {
    blockDialog.close();
  }
}

export function closeStampDialog() {
  if (stampDialog.open) {
    stampDialog.close();
  }
}

export function setBlockFormError(msg) {
  if (msg) {
    blockFormError.textContent = msg;
    blockFormError.style.display = "block";
  } else {
    blockFormError.textContent = "";
    blockFormError.style.display = "none";
  }
}

export function setStampFormError(msg) {
  if (msg) {
    stampFormError.textContent = msg;
    stampFormError.style.display = "block";
  } else {
    stampFormError.textContent = "";
    stampFormError.style.display = "none";
  }
}

export function blockFormData() {
  const formData = new FormData(blockForm);
  return {
    block_id: formData.get("block_id"),
    country: formData.get("country"),
    year: formData.get("year"),
    title: formData.get("title"),
  };
}

export function stampFormData() {
  const formData = new FormData(stampForm);
  return {
    stamp_id: formData.get("stamp_id"),
    block_id: Number(formData.get("block_id")),
    catalog_number: formData.get("catalog_number"),
    nvph_number: formData.get("nvph_number"),
    denomination: formData.get("denomination"),
    color: formData.get("color"),
    height: Number(formData.get("height") || 0),
    width: Number(formData.get("width") || 0),
    image_path: formData.get("image_path"),
    stamp_type: formData.get("stamp_type"),
  };
}

export function resetBlockForm(defaults = {}) {
  blockForm.reset();
  blockForm.elements.block_id.value = defaults.block_id ?? "";
  blockForm.elements.country.value = defaults.country ?? "Netherlands";
  blockForm.elements.year.value = defaults.year ?? "";
  blockForm.elements.title.value = defaults.title ?? "";
}

export function resetStampForm(defaults = {}) {
  stampForm.reset();
  stampForm.elements.stamp_id.value = defaults.stamp_id ?? "";
  stampForm.elements.block_id.value = defaults.block_id ?? "";
  stampForm.elements.catalog_number.value = defaults.catalog_number ?? "";
  stampForm.elements.nvph_number.value = defaults.nvph_number ?? "";
  stampForm.elements.denomination.value = defaults.denomination ?? "";
  stampForm.elements.color.value = defaults.color ?? "";
  stampForm.elements.height.value = defaults.height ?? 0;
  stampForm.elements.width.value = defaults.width ?? 0;
  stampForm.elements.image_path.value = defaults.image_path ?? "";
  stampForm.elements.stamp_type.value = defaults.stamp_type ?? "";
}

export function bindStaticEvents(handlers) {
  el("#refreshBtn").addEventListener("click", handlers.onRefresh);
  exportJsonBtn.addEventListener("click", handlers.onExportJson);
  addBlockBtn.addEventListener("click", handlers.onNewBlock);
  blockForm.addEventListener("submit", handlers.onSubmitBlock);
  stampForm.addEventListener("submit", handlers.onSubmitStamp);

  closeBlockDialogBtn.addEventListener("click", closeBlockDialog);
  closeStampDialogBtn.addEventListener("click", closeStampDialog);
  cancelBlockBtn.addEventListener("click", closeBlockDialog);
  cancelStampBtn.addEventListener("click", closeStampDialog);
}

function blockHeaderText(block) {
  return `${block.country || "No country"} | ${block.year || "No year"}`;
}

function stampMetaText(stamp) {
  const size =
    Number(stamp.width) > 0 && Number(stamp.height) > 0
      ? `${stamp.width} x ${stamp.height}`
      : "size n/a";
  return [stamp.denomination, stamp.color, stamp.stamp_type, size]
    .filter(Boolean)
    .join(" | ");
}

export function renderBlockSelectOptions() {
  const options = allBlockOptions();
  stampBlockSelect.innerHTML = "";
  for (const optionData of options) {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    stampBlockSelect.append(option);
  }
}

export function renderBlocks(handlers) {
  blocksContainer.innerHTML = "";
  const f = currentFilter;
  const existingBlockIds = new Set(appState.blocks.map((b) => b.block_id));
  collapsedBlockIds.forEach((blockId) => {
    if (!existingBlockIds.has(blockId)) {
      collapsedBlockIds.delete(blockId);
    }
  });

  if (toggleCollapseAllBtn) {
    const hasBlocks = appState.blocks.length > 0;
    const allCollapsed =
      hasBlocks &&
      appState.blocks.every((block) => collapsedBlockIds.has(block.block_id));
    toggleCollapseAllBtn.disabled = !hasBlocks;
    toggleCollapseAllBtn.textContent = allCollapsed
      ? "Expand All"
      : "Collapse All";
    toggleCollapseAllBtn.title = allCollapsed
      ? "Expand all blocks"
      : "Collapse all blocks";
    toggleCollapseAllBtn.onclick = () => {
      if (!appState.blocks.length) return;

      const shouldCollapseAll = appState.blocks.some(
        (block) => !collapsedBlockIds.has(block.block_id),
      );
      if (shouldCollapseAll) {
        appState.blocks.forEach((block) =>
          collapsedBlockIds.add(block.block_id),
        );
      } else {
        appState.blocks.forEach((block) =>
          collapsedBlockIds.delete(block.block_id),
        );
      }
      renderBlocks(handlers);
    };
  }

  // --- BLOCK DRAGGABLES ---
  let dragBlockId = null;
  let dragOverBlockId = null;
  let dragStampId = null;
  let dragStampSourceBlockId = null;
  const dropIndicator = document.createElement("div");
  dropIndicator.className = "stamp-drop-indicator";
  // Helper to trigger block reorder
  async function handleBlockDrop() {
    const ids = Array.from(blocksContainer.children).map((el) =>
      Number(el.dataset.blockId),
    );
    try {
      await reorderBlocks(ids);
      setBlockFormError("");
      return true;
    } catch (error) {
      setBlockFormError(`Failed to save block order: ${error.message}`);
      return false;
    }
  }
  // Helper to trigger stamp reorder
  async function handleStampDrop(blockId, stampList) {
    const ids = Array.from(stampList.children).map((el) =>
      Number(el.dataset.stampId),
    );
    try {
      await reorderStamps(blockId, ids);
      setStampFormError("");
      return true;
    } catch (error) {
      setStampFormError(`Failed to save stamp order: ${error.message}`);
      return false;
    }
  }
  appState.blocks.forEach((block, blockIdx) => {
    if (!blockPassesFilter(f, block)) return;
    const isCollapsed = collapsedBlockIds.has(block.block_id);
    const blockNode = document.createElement("section");
    blockNode.className = "block-column";
    if (isCollapsed) {
      blockNode.classList.add("is-collapsed");
    }
    blockNode.dataset.blockId = String(block.block_id);
    blockNode.draggable = true;

    // Block drag events
    blockNode.addEventListener("dragstart", (e) => {
      if (e.target !== blockNode || dragStampId !== null) {
        return;
      }
      dragBlockId = block.block_id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("block-id", String(block.block_id));
      blockNode.classList.add("dragging");
    });
    blockNode.addEventListener("dragend", async (e) => {
      blockNode.classList.remove("dragging");
      if (
        dragBlockId !== null &&
        dragOverBlockId !== null &&
        dragBlockId !== dragOverBlockId
      ) {
        await handleBlockDrop();
      }
      dragBlockId = null;
      dragOverBlockId = null;
    });
    blockNode.addEventListener("dragover", (e) => {
      if (
        dragStampId === null &&
        dragBlockId !== null &&
        dragBlockId !== block.block_id
      ) {
        e.preventDefault();
        blockNode.classList.add("drag-over-block");
        dragOverBlockId = block.block_id;
      }
    });
    blockNode.addEventListener("dragleave", (e) => {
      blockNode.classList.remove("drag-over-block");
    });
    blockNode.addEventListener("drop", async (e) => {
      blockNode.classList.remove("drag-over-block");
      if (
        dragStampId === null &&
        dragBlockId !== null &&
        dragBlockId !== block.block_id
      ) {
        // Move block in DOM
        const children = Array.from(blocksContainer.children);
        const fromIdx = children.findIndex(
          (el) => Number(el.dataset.blockId) === dragBlockId,
        );
        const toIdx = children.findIndex(
          (el) => Number(el.dataset.blockId) === block.block_id,
        );
        if (fromIdx !== -1 && toIdx !== -1) {
          blocksContainer.insertBefore(
            children[fromIdx],
            toIdx > fromIdx ? children[toIdx].nextSibling : children[toIdx],
          );
        }
        await handleBlockDrop();
      }
      dragBlockId = null;
      dragOverBlockId = null;
    });

    // ...existing code for head/buttons...
    const head = document.createElement("div");
    head.className = "block-head";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "block-title";
    title.textContent = block.title || `Block ${block.block_id}`;
    const meta = document.createElement("p");
    meta.className = "block-meta";
    meta.textContent = blockHeaderText(block);
    titleWrap.append(title, meta);
    const buttons = document.createElement("div");
    buttons.className = "block-actions";
    const collapseBtn = document.createElement("button");
    collapseBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    collapseBtn.type = "button";
    collapseBtn.className = "icon-btn collapse-toggle";
    if (isCollapsed) {
      collapseBtn.classList.add("is-collapsed");
    }
    collapseBtn.title = isCollapsed ? "Expand block" : "Collapse block";
    collapseBtn.setAttribute("aria-label", collapseBtn.title);
    collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
    collapseBtn.addEventListener("click", () => {
      if (collapsedBlockIds.has(block.block_id)) {
        collapsedBlockIds.delete(block.block_id);
      } else {
        collapsedBlockIds.add(block.block_id);
      }
      renderBlocks(handlers);
    });
    const editBtn = document.createElement("button");
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.3-10.3-4-4L4 16v4zm13.7-13.7 1.4-1.4a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4l-1.4 1.4-2.6-2.6z"/></svg>';
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.title = "Edit block";
    editBtn.setAttribute("aria-label", "Edit block");
    editBtn.addEventListener("click", () => handlers.onSelectBlock(block));
    const addStampBtn = document.createElement("button");
    addStampBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z"/></svg>';
    addStampBtn.type = "button";
    addStampBtn.className = "icon-btn";
    addStampBtn.title = "Add stamp";
    addStampBtn.setAttribute("aria-label", "Add stamp");
    addStampBtn.addEventListener("click", () =>
      handlers.onCreateStampInBlock(block),
    );
    const removeBtn = document.createElement("button");
    removeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"/></svg>';
    removeBtn.type = "button";
    removeBtn.className = "danger icon-btn";
    removeBtn.title = "Remove block";
    removeBtn.setAttribute("aria-label", "Remove block");
    removeBtn.addEventListener("click", () => handlers.onDeleteBlock(block));
    buttons.append(collapseBtn, editBtn, addStampBtn, removeBtn);
    head.append(titleWrap, buttons);

    // --- STAMP DRAGGABLES ---
    const stampList = document.createElement("div");
    stampList.className = "stamp-list";
    stampList.hidden = isCollapsed;
    stampList.dataset.blockId = String(block.block_id);
    let stamps = block.stamps || [];
    if (hasStampLevelFilter(f)) {
      stamps = stamps.filter((s) => stampPassesFilter(f, s));
      if (!stamps.length) return;
    }
    stamps.forEach((stamp, stampIdx) => {
      const card = stampCardTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.stampId = String(stamp.stamp_id);
      card.draggable = true;
      // Stamp drag events
      card.addEventListener("dragstart", (event) => {
        event.stopPropagation();
        dragStampId = stamp.stamp_id;
        dragStampSourceBlockId = block.block_id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("stamp-id", String(stamp.stamp_id));

        // Ensure block drag state cannot linger when dragging stamps.
        dragBlockId = null;
        dragOverBlockId = null;
        blocksContainer
          .querySelectorAll(".block-column")
          .forEach((node) =>
            node.classList.remove("dragging", "drag-over-block"),
          );

        card.classList.add("dragging");
      });
      card.addEventListener("dragend", async (event) => {
        event.stopPropagation();
        card.classList.remove("dragging");
        if (dropIndicator.parentElement) {
          dropIndicator.parentElement.removeChild(dropIndicator);
        }
        blocksContainer
          .querySelectorAll(".block-column")
          .forEach((node) =>
            node.classList.remove("dragging", "drag-over-block"),
          );
        dragStampId = null;
        dragStampSourceBlockId = null;
      });

      // ...existing code for image, text, and events...
      const img = card.querySelector("img");
      img.src = stamp.image_url || "";
      img.alt = stamp.catalog_number || "stamp image";
      const titleText =
        stamp.nvph_number || stamp.catalog_number || `Stamp ${stamp.stamp_id}`;
      card.querySelector(".catalog").textContent = titleText;
      const metaLines = [];
      if (stamp.catalog_number && stamp.catalog_number !== stamp.nvph_number) {
        metaLines.push(stamp.catalog_number);
      }
      const metaText = stampMetaText(stamp);
      if (metaText) {
        metaLines.push(metaText);
      }
      card.querySelector(".meta").textContent = metaLines.join("\n");
      card.addEventListener("click", (event) => {
        if (event.target.closest(".remove-stamp")) {
          return;
        }
        handlers.onSelectStamp(stamp);
      });
      card
        .querySelector(".remove-stamp")
        .addEventListener("click", () => handlers.onDeleteStamp(stamp));
      stampList.append(card);
    });
    // Allow dropping at end of stamp list
    stampList.addEventListener("dragover", (event) => {
      if (dragStampId !== null) {
        event.preventDefault();
        stampList.classList.add("drag-over");

        const targetCard = event.target.closest(".stamp-card");
        if (targetCard && targetCard.parentElement === stampList) {
          const targetRect = targetCard.getBoundingClientRect();
          const insertBeforeTarget =
            event.clientY < targetRect.top + targetRect.height / 2;
          stampList.insertBefore(
            dropIndicator,
            insertBeforeTarget ? targetCard : targetCard.nextSibling,
          );
          return;
        }

        const cards = Array.from(stampList.querySelectorAll(".stamp-card"));
        if (!cards.length) {
          stampList.append(dropIndicator);
          return;
        }

        const firstCard = cards[0];
        const lastCard = cards[cards.length - 1];
        if (event.clientY < firstCard.getBoundingClientRect().top) {
          stampList.insertBefore(dropIndicator, firstCard);
          return;
        }
        if (event.clientY > lastCard.getBoundingClientRect().bottom) {
          stampList.append(dropIndicator);
        }
      }
    });
    stampList.addEventListener("dragleave", () => {
      stampList.classList.remove("drag-over");
    });
    stampList.addEventListener("drop", async (event) => {
      stampList.classList.remove("drag-over");
      let canReorderInTarget = true;
      if (dragStampId !== null) {
        const targetBlockId = Number(stampList.dataset.blockId);
        const sourceBlockId = Number(dragStampSourceBlockId);
        const draggedCard = blocksContainer.querySelector(
          `.stamp-card[data-stamp-id="${dragStampId}"]`,
        );
        const sourceStampList = draggedCard
          ? draggedCard.closest(".stamp-list")
          : null;
        const sourceNextSibling = draggedCard ? draggedCard.nextSibling : null;

        if (draggedCard) {
          if (dropIndicator.parentElement === stampList) {
            stampList.insertBefore(draggedCard, dropIndicator);
          } else {
            stampList.appendChild(draggedCard);
          }
        }

        if (
          dragStampSourceBlockId !== null &&
          Number.isFinite(sourceBlockId) &&
          Number.isFinite(targetBlockId) &&
          sourceBlockId !== targetBlockId
        ) {
          try {
            await moveStamp(dragStampId, targetBlockId);
            setStampFormError("");
          } catch (error) {
            setStampFormError(`Failed to move stamp: ${error.message}`);
            canReorderInTarget = false;

            // Restore UI to original location if the backend move failed.
            if (draggedCard && sourceStampList) {
              if (
                sourceNextSibling &&
                sourceNextSibling.parentElement === sourceStampList
              ) {
                sourceStampList.insertBefore(draggedCard, sourceNextSibling);
              } else {
                sourceStampList.appendChild(draggedCard);
              }
            }
          }
        }

        if (draggedCard && canReorderInTarget) {
          await handleStampDrop(block.block_id, stampList);
        }
      }
      if (dropIndicator.parentElement) {
        dropIndicator.parentElement.removeChild(dropIndicator);
      }
      dragStampId = null;
      dragStampSourceBlockId = null;
    });

    blockNode.append(head, stampList);
    blocksContainer.append(blockNode);
  });
}
