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
const blockForm = el("#blockForm");
const stampForm = el("#stampForm");
const stampBlockSelect = el("#stampBlockSelect");
const blockFormError = document.getElementById("blockFormError");
const stampFormError = document.getElementById("stampFormError");
const stampSearchInput = document.getElementById("stampSearchInput");
const toggleCollapseAllBtn = document.getElementById("toggleCollapseAllBtn");
let currentSearch = "";
const collapsedBlockIds = new Set();

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

export function bindSearchFilter(onSearch) {
  if (!stampSearchInput) return;
  stampSearchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value || "";
    onSearch(currentSearch);
  });
}

export function blockFormData() {
  const formData = new FormData(blockForm);
  return {
    block_id: formData.get("block_id"),
    country: formData.get("country"),
    year: formData.get("year"),
    title: formData.get("title"),
    nr_of_stamps: Number(formData.get("nr_of_stamps") || 0),
    starting_stamp: formData.get("starting_stamp"),
    next_block_starting_stamp: formData.get("next_block_starting_stamp"),
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
  blockForm.elements.country.value = defaults.country ?? "";
  blockForm.elements.year.value = defaults.year ?? "";
  blockForm.elements.title.value = defaults.title ?? "";
  blockForm.elements.nr_of_stamps.value = defaults.nr_of_stamps ?? 0;
  blockForm.elements.starting_stamp.value = defaults.starting_stamp ?? "";
  blockForm.elements.next_block_starting_stamp.value =
    defaults.next_block_starting_stamp ?? "";
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
  el("#newBlockBtn").addEventListener("click", handlers.onNewBlock);
  el("#newStampBtn").addEventListener("click", handlers.onNewStamp);
  blockForm.addEventListener("submit", handlers.onSubmitBlock);
  stampForm.addEventListener("submit", handlers.onSubmitStamp);
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

export function renderBlocks(handlers, filter) {
  blocksContainer.innerHTML = "";
  const search = (filter || currentSearch || "").toLowerCase();
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
      renderBlocks(handlers, filter);
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
    meta.textContent = `${blockHeaderText(block)} | ${block.nr_of_stamps} stamps`;
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
      renderBlocks(handlers, filter);
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
    if (search) {
      stamps = stamps.filter((s) =>
        (s.catalog_number || "").toLowerCase().includes(search),
      );
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
      card.querySelector(".catalog").textContent =
        stamp.catalog_number || `Stamp ${stamp.stamp_id}`;
      card.querySelector(".meta").textContent = stampMetaText(stamp);
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
