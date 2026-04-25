async function runWithConcurrency(items, concurrency, worker) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const size = Math.max(1, Number(concurrency) || 1);
  const results = new Array(items.length);
  let index = 0;

  async function consume() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(size, items.length) }, () => consume());
  await Promise.all(runners);
  return results;
}

module.exports = {
  runWithConcurrency
};
