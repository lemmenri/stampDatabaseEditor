export const appState = {
  blocks: [],
  selectedBlockId: null,
  selectedStampId: null,
};

export function setBlocks(blocks) {
  appState.blocks = blocks;

  if (
    appState.selectedBlockId !== null &&
    !blocks.some((block) => block.block_id === appState.selectedBlockId)
  ) {
    appState.selectedBlockId = null;
  }

  if (appState.selectedStampId !== null) {
    const allStamps = blocks.flatMap((block) => block.stamps || []);
    if (
      !allStamps.some((stamp) => stamp.stamp_id === appState.selectedStampId)
    ) {
      appState.selectedStampId = null;
    }
  }
}

export function findBlockById(blockId) {
  return appState.blocks.find((block) => block.block_id === Number(blockId));
}

export function findStampById(stampId) {
  for (const block of appState.blocks) {
    const found = (block.stamps || []).find(
      (stamp) => stamp.stamp_id === Number(stampId),
    );
    if (found) {
      return found;
    }
  }
  return null;
}

export function allBlockOptions() {
  return appState.blocks.map((block) => ({
    value: String(block.block_id),
    label: `#${block.block_id} ${block.title || "Untitled"}`,
  }));
}
