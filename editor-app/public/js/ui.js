import { appState, allBlockOptions } from "./state.js";
import { reorderBlocks, reorderStamps } from "./api.js";

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
let currentSearch = "";

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
  return [stamp.denomination, stamp.color, stamp.stamp_type]
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
  // --- BLOCK DRAGGABLES ---
  let dragBlockId = null;
  let dragOverBlockId = null;
  let dragStampId = null;
  let dragOverStampId = null;
  let dragOverStampBlockId = null;
  // Helper to trigger block reorder
  async function handleBlockDrop() {
    const ids = Array.from(blocksContainer.children).map((el) =>
      Number(el.dataset.blockId),
    );
    await reorderBlocks(ids);
  }
  // Helper to trigger stamp reorder
  async function handleStampDrop(blockId, stampList) {
    const ids = Array.from(stampList.children).map((el) =>
      Number(el.dataset.stampId),
    );
    await reorderStamps(blockId, ids);
  }
  appState.blocks.forEach((block, blockIdx) => {
    const blockNode = document.createElement("section");
    blockNode.className = "block-column";
    blockNode.dataset.blockId = String(block.block_id);
    blockNode.draggable = true;

    // Block drag events
    blockNode.addEventListener("dragstart", (e) => {
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
      if (dragBlockId !== null && dragBlockId !== block.block_id) {
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
      if (dragBlockId !== null && dragBlockId !== block.block_id) {
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
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.type = "button";
    editBtn.addEventListener("click", () => handlers.onSelectBlock(block));
    const addStampBtn = document.createElement("button");
    addStampBtn.textContent = "Add Stamp";
    addStampBtn.type = "button";
    addStampBtn.addEventListener("click", () =>
      handlers.onCreateStampInBlock(block),
    );
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.type = "button";
    removeBtn.className = "danger";
    removeBtn.addEventListener("click", () => handlers.onDeleteBlock(block));
    buttons.append(editBtn, addStampBtn, removeBtn);
    head.append(titleWrap, buttons);

    // --- STAMP DRAGGABLES ---
    const stampList = document.createElement("div");
    stampList.className = "stamp-list";
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
        dragStampId = stamp.stamp_id;
        dragOverStampBlockId = block.block_id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("stamp-id", String(stamp.stamp_id));
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", async (event) => {
        card.classList.remove("dragging");
        if (
          dragStampId !== null &&
          dragOverStampId !== null &&
          dragOverStampBlockId === block.block_id
        ) {
          await handleStampDrop(block.block_id, stampList);
        }
        dragStampId = null;
        dragOverStampId = null;
        dragOverStampBlockId = null;
      });
      card.addEventListener("dragover", (event) => {
        if (dragStampId !== null && dragStampId !== stamp.stamp_id) {
          event.preventDefault();
          card.classList.add("drag-over-stamp");
          dragOverStampId = stamp.stamp_id;
        }
      });
      card.addEventListener("dragleave", (event) => {
        card.classList.remove("drag-over-stamp");
      });
      card.addEventListener("drop", async (event) => {
        card.classList.remove("drag-over-stamp");
        if (dragStampId !== null && dragStampId !== stamp.stamp_id) {
          // Move card in DOM
          const children = Array.from(stampList.children);
          const fromIdx = children.findIndex(
            (el) => Number(el.dataset.stampId) === dragStampId,
          );
          const toIdx = children.findIndex(
            (el) => Number(el.dataset.stampId) === stamp.stamp_id,
          );
          if (fromIdx !== -1 && toIdx !== -1) {
            stampList.insertBefore(
              children[fromIdx],
              toIdx > fromIdx ? children[toIdx].nextSibling : children[toIdx],
            );
          }
          await handleStampDrop(block.block_id, stampList);
        }
        dragStampId = null;
        dragOverStampId = null;
        dragOverStampBlockId = null;
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
      }
    });
    stampList.addEventListener("dragleave", () => {
      stampList.classList.remove("drag-over");
    });
    stampList.addEventListener("drop", async (event) => {
      stampList.classList.remove("drag-over");
      if (dragStampId !== null) {
        // Move to end
        const children = Array.from(stampList.children);
        const fromIdx = children.findIndex(
          (el) => Number(el.dataset.stampId) === dragStampId,
        );
        if (fromIdx !== -1) {
          stampList.appendChild(children[fromIdx]);
        }
        await handleStampDrop(block.block_id, stampList);
      }
      dragStampId = null;
      dragOverStampId = null;
      dragOverStampBlockId = null;
    });

    blockNode.append(head, stampList);
    blocksContainer.append(blockNode);
  });
}
