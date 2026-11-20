const sciscape = "https://sciscape.io/";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const digest = /^[0-9a-f]{64}$/;

async function destination() {
  const id = (new URLSearchParams(location.search).get("id") || "").toLowerCase();
  if (!uuid.test(id)) return sciscape;

  // Each static file contains accepted publications with the same first UUID digit.
  const response = await fetch(`../redirect/${id[0]}.json`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return sciscape;

  const ids = await response.json();
  return digest.test(ids[id]) ? `${sciscape}p/${ids[id]}` : sciscape;
}

destination().catch(() => sciscape).then(url => location.replace(url));
