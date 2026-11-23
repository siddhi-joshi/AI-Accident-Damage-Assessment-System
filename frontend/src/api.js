const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, options);
  } catch {
    throw new Error('Cannot reach the assessment server. Make sure the backend is running.');
  }
  if (!response.ok) {
    let detail;
    try { detail = (await response.json()).detail; } catch { /* empty response */ }
    const message = Array.isArray(detail) ? detail.map(item => item.msg).join(', ') : detail;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json();
}

export const imageUrl = (claimId, imageId) => `${base}/api/claims/${claimId}/images/${imageId}`;
