export async function reorderBlocks(orderedIds) {
  return request("/api/blocks/reorder", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

export async function reorderStamps(blockId, orderedIds) {
  return request(`/api/blocks/${blockId}/stamps/reorder`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}
const jsonHeaders = {
  "Content-Type": "application/json",
};

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err.error || JSON.stringify(err);
    } catch {
      detail = await response.text();
    }
    throw new Error(`${response.status} ${response.statusText} - ${detail}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function fetchBlocks() {
  return request("/api/blocks");
}

export async function createBlock(payload) {
  return request("/api/blocks", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
}

export async function updateBlock(blockId, payload) {
  return request(`/api/blocks/${blockId}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
}

export async function deleteBlock(blockId) {
  return request(`/api/blocks/${blockId}`, {
    method: "DELETE",
  });
}

export async function createStamp(payload) {
  return request("/api/stamps", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
}

export async function updateStamp(stampId, payload) {
  return request(`/api/stamps/${stampId}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
}

export async function deleteStamp(stampId) {
  return request(`/api/stamps/${stampId}`, {
    method: "DELETE",
  });
}

export async function moveStamp(stampId, blockId) {
  return request(`/api/stamps/${stampId}/move`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ block_id: blockId }),
  });
}

export async function fetchExportJson() {
  return request("/api/export/json");
}
