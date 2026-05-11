import {
  createBlock,
  createStamp,
  deleteBlock,
  deleteStamp,
  fetchExportJson,
  fetchBlocks,
  importJson,
  moveStamp,
  updateBlock,
  updateStamp,
} from "./api.js";
import { appState, findBlockById, setBlocks } from "./state.js";
import {
  bindStaticEvents,
  blockFormData,
  closeBlockDialog,
  closeImportDialog,
  closeStampDialog,
  openBlockDialog,
  openStampDialog,
  openImportDialog,
  resetBlockForm,
  resetImportForm,
  resetStampForm,
  stampFormData,
  importFormData,
  setBlockFormError,
  setImportFormError,
  setStampFormError,
  bindFilterPanel,
  renderBlocks,
  renderBlockSelectOptions,
} from "./ui.js";

async function loadData() {
  setBlockFormError("");
  setStampFormError("");
  try {
    const payload = await fetchBlocks();
    setBlocks(payload.blocks || []);
    renderBlockSelectOptions();
    renderBlocks(handlers);
  } catch (e) {
    setBlockFormError("Failed to load data: " + e.message);
  }
}

function firstBlockId() {
  return appState.blocks[0] ? appState.blocks[0].block_id : "";
}

function notify(message, which = "block") {
  if (which === "block") setBlockFormError(message);
  else setStampFormError(message);
}

const handlers = {
  onRefresh: async () => {
    await loadData();
  },

  onExportJson: async () => {
    try {
      const collection = await fetchExportJson();
      const json = JSON.stringify(collection, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateTag = new Date().toISOString().slice(0, 10);
      link.download = `collection-export-${dateTag}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Failed to export JSON: ${error.message}`);
    }
  },

  onImportJson: () => {
    setBlockFormError("");
    setStampFormError("");
    setImportFormError("");
    resetImportForm();
    openImportDialog();
  },

  onSubmitImport: async (event) => {
    event.preventDefault();
    setImportFormError("");
    setBlockFormError("");
    setStampFormError("");
    try {
      const { jsonText, mode } = await importFormData();
      if (!jsonText) {
        throw new Error(
          "Please provide JSON by file or paste it into the text box.",
        );
      }
      let collection;
      try {
        collection = JSON.parse(jsonText);
      } catch (parseError) {
        throw new Error(
          "Invalid JSON format. Please check the file or pasted content.",
        );
      }
      if (
        mode === "replace" &&
        !confirm("Replacing will delete the current collection. Continue?")
      ) {
        return;
      }
      await importJson(collection, mode);
      await loadData();
      closeImportDialog();
      notify("Import complete", "block");
    } catch (e) {
      setImportFormError(e.message);
    }
  },

  onNewBlock: () => {
    resetBlockForm({});
    openBlockDialog();
  },

  onNewStamp: () => {
    resetStampForm({ block_id: firstBlockId() });
    openStampDialog();
  },

  onSelectBlock: (block) => {
    appState.selectedBlockId = block.block_id;
    resetBlockForm(block);
    openBlockDialog();
  },

  onCreateStampInBlock: (block) => {
    resetStampForm({ block_id: block.block_id, catalog_number: "" });
    openStampDialog();
  },

  onDeleteBlock: async (block) => {
    setBlockFormError("");
    setStampFormError("");
    if (
      !confirm(
        `Remove block ${block.block_id} and all ${block.stamps.length} stamps?`,
      )
    )
      return;
    try {
      await deleteBlock(block.block_id);
      await loadData();
      resetBlockForm({});
      resetStampForm({ block_id: firstBlockId() });
    } catch (e) {
      setBlockFormError(e.message);
    }
  },

  onSubmitBlock: async (event) => {
    event.preventDefault();
    setBlockFormError("");
    setStampFormError("");
    const data = blockFormData();
    try {
      if (data.block_id) {
        await updateBlock(data.block_id, data);
        notify(`Block ${data.block_id} updated`, "block");
      } else {
        await createBlock(data);
        notify("Block created", "block");
      }
      await loadData();
      closeBlockDialog();
    } catch (e) {
      setBlockFormError(e.message);
    }
  },

  onSelectStamp: (stamp) => {
    appState.selectedStampId = stamp.stamp_id;
    resetStampForm(stamp);
    openStampDialog();
  },

  onDeleteStamp: async (stamp) => {
    setStampFormError("");
    if (!confirm(`Remove stamp ${stamp.catalog_number || stamp.stamp_id}?`))
      return;
    try {
      await deleteStamp(stamp.stamp_id);
      await loadData();
    } catch (e) {
      setStampFormError(e.message);
    }
  },

  onSubmitStamp: async (event) => {
    event.preventDefault();
    setStampFormError("");
    setBlockFormError("");
    const data = stampFormData();
    if (!data.block_id) {
      setStampFormError("Select a block for this stamp.");
      return;
    }
    try {
      if (data.stamp_id) {
        await updateStamp(data.stamp_id, data);
        notify(`Stamp ${data.stamp_id} updated`, "stamp");
      } else {
        await createStamp(data);
        notify("Stamp created", "stamp");
      }
      await loadData();
      closeStampDialog();
    } catch (e) {
      setStampFormError(e.message);
    }
  },

  onMoveStamp: async (stampId, targetBlockId) => {
    setBlockFormError("");
    setStampFormError("");
    const block = findBlockById(targetBlockId);
    if (!block) {
      setBlockFormError("Target block not found");
      return;
    }
    try {
      await moveStamp(stampId, targetBlockId);
      await loadData();
    } catch (e) {
      setBlockFormError(e.message);
    }
  },
};

bindStaticEvents(handlers);
bindFilterPanel(() => renderBlocks(handlers));

loadData()
  .then(() => {
    resetStampForm({ block_id: firstBlockId() });
  })
  .catch((error) => {
    setBlockFormError(`Failed to load data: ${error.message}`);
  });
