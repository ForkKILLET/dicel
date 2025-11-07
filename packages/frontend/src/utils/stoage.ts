import { ref, watch } from 'vue'

export const tryJSONParse = <T>(json: string | null) => {
  if (json === null) return null
  try {
    return JSON.parse(json) as T
  }
  catch {
    return null
  }
}

export const refStorage = <T>(key: string, defVal: T) => {
  const storedVal = tryJSONParse<T>(localStorage.getItem(key))
  const valRef = ref<T>(storedVal ?? defVal)
  watch(valRef, val => {
    localStorage.setItem(key, JSON.stringify(val))
  })
  return valRef
}
