export function exactKeyHits(text, keys) {
  const haystack = String(text || '').toLocaleLowerCase();
  return (keys || []).filter((key) => {
    if (!key) return false;
    const needle = String(key).toLocaleLowerCase();
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) return false;
      if (!/[不无未非]/u.test(haystack[at - 1] || '')) return true;
      from = at + needle.length;
    }
    return false;
  });
}

export function selectLoreEntries({ entries, primaryScan, secondaryScan, budget = 9000, maxEntries = 24 }) {
  const scored = entries.filter((entry) => entry.enabled !== false && !entry.constant).map((entry) => {
    const primaryHits = exactKeyHits(primaryScan, entry.keys);
    const secondaryHits = exactKeyHits(secondaryScan, entry.secondaryKeys);
    const excluded = exactKeyHits(secondaryScan, entry.excludeKeys).length > 0;
    const selectiveMiss = entry.selective && secondaryHits.length === 0;
    const score = primaryHits.reduce((sum, key) => sum + 120 + Math.min(String(key).length, 16) * 18, 0)
      + secondaryHits.reduce((sum, key) => sum + 80 + Math.min(String(key).length, 16) * 10, 0)
      + Number(entry.order || 0) / 100;
    return { entry, primaryHits, secondaryHits, excluded, selectiveMiss, score };
  }).filter((item) => item.primaryHits.length && !item.excluded && !item.selectiveMiss)
    .sort((a, b) => b.score - a.score || (b.entry.order || 0) - (a.entry.order || 0));

  const chosen = [];
  let usedCharacters = 0;
  for (const item of scored) {
    const packet = `【${item.entry.title || item.entry.memo || item.entry.id}】\n${item.entry.content}`;
    if (chosen.length && usedCharacters + packet.length > budget) continue;
    chosen.push({ ...item, packet });
    usedCharacters += packet.length;
    if (usedCharacters >= budget || chosen.length >= maxEntries) break;
  }
  return { chosen, usedCharacters, candidateCount: scored.length };
}
