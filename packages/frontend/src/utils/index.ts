export const incrementMap = <K>(map: Map<K, number>, key: K) => {
  const count = (map.get(key) ?? 0) + 1
  map.set(key, count)
  return count
}