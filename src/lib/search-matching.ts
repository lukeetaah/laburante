export const normalizeSearchText = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

function wordVariants(word: string) {
  const variants = new Set([word])

  if (word.endsWith('as') || word.endsWith('os')) {
    const singularStem = word.slice(0, -1)
    const base = word.slice(0, -2)
    variants.add(singularStem)
    variants.add(base)
    variants.add(`${base}a`)
    variants.add(`${base}o`)
  } else if (word.endsWith('es')) {
    variants.add(word.slice(0, -2))
  } else if (word.endsWith('s')) {
    variants.add(word.slice(0, -1))
  }

  if (word.endsWith('a')) variants.add(`${word.slice(0, -1)}o`)
  if (word.endsWith('o')) variants.add(`${word.slice(0, -1)}a`)

  // Common Spanish occupational forms: contador/contadora,
  // contador/contadores and their feminine plural.
  if (word.endsWith('or')) {
    variants.add(`${word}a`)
    variants.add(`${word}es`)
    variants.add(`${word}as`)
  }

  return variants
}

export function expandSearchTermVariants(term: string) {
  const normalized = normalizeSearchText(term)
  if (!normalized) return []

  const words = normalized.split(' ')
  const lastWord = words[words.length - 1]
  return Array.from(wordVariants(lastWord)).map((variant) => [
    ...words.slice(0, -1),
    variant,
  ].join(' '))
}

export interface SearchDocument {
  publicText: string
  workText: string
}

/** Category membership is based on declared work evidence only. */
export function categoryWorkTerms(category: { subcategories?: string[] }) {
  return (category.subcategories || [])
    .map(normalizeSearchText)
    .filter(Boolean)
}

export function expandCategorySearchTerms(
  input: string,
  categories: Array<{ name: string; subcategories?: string[] }>,
) {
  const normalized = normalizeSearchText(input)
  if (normalized.length <= 2) return []

  const expanded = new Set<string>()
  categories.forEach((category) => {
    const categoryName = normalizeSearchText(category.name)
    if (normalized === categoryName || categoryName.includes(normalized)) {
      expanded.add(categoryName)
      ;(category.subcategories || []).forEach((subcategory) => {
        const normalizedSubcategory = normalizeSearchText(subcategory)
        expanded.add(normalizedSubcategory)
        expandSearchTermVariants(normalizedSubcategory).forEach((variant) => expanded.add(variant))
      })
    }
  })
  return Array.from(expanded)
}

function tokens(value: string) {
  return normalizeSearchText(value).split(/[^a-z0-9]+/).filter(Boolean)
}

function containsWholeTerm(text: string, term: string) {
  const textTokens = tokens(text)
  const termTokens = tokens(term)
  if (!termTokens.length || termTokens.length > textTokens.length) return false

  return textTokens.some((_, index) => termTokens.every((token, offset) => textTokens[index + offset] === token))
}

export function matchesCategoryDocument(document: SearchDocument, categoryTerms: string[]) {
  const terms = categoryTerms.flatMap((term) => [term, ...expandSearchTermVariants(term)])
  return terms.some((term) => containsWholeTerm(document.workText, term))
}

function normalizedTerms(terms: string[]) {
  return Array.from(new Set(terms.flatMap((term) => [
    normalizeSearchText(term),
    ...expandSearchTermVariants(term),
  ]).filter(Boolean)))
}

export function isCatalogSearch(input: string, catalogTerms: string[], expandedTerms: string[]) {
  const query = normalizeSearchText(input)
  const catalog = new Set(catalogTerms.map(normalizeSearchText))
  const expanded = normalizedTerms(expandedTerms)
  return catalog.has(query) || expanded.some((term) => catalog.has(term))
}

export function matchesSearchDocument(
  input: string,
  document: SearchDocument,
  catalogTerms: string[],
  expandedTerms: string[],
) {
  const query = normalizeSearchText(input)
  if (!query) return false

  const publicText = normalizeSearchText(document.publicText)
  const workText = normalizeSearchText(document.workText)
  const terms = normalizedTerms(expandedTerms.length ? expandedTerms : [query])
  const catalog = new Set(catalogTerms.map(normalizeSearchText))

  if (catalog.has(query) || terms.some((term) => catalog.has(term))) {
    // Catalog terms remain relevant to work fields, while public profile text
    // is also searchable so gender/plural variants do not change semantics.
    return terms.some((term) => workText.includes(term) || publicText.includes(term))
  }

  return terms.some((term) => publicText.includes(term) || workText.includes(term))
}

export function scoreSearchDocument(
  input: string,
  document: SearchDocument,
  expandedTerms: string[],
) {
  const query = normalizeSearchText(input)
  const publicText = normalizeSearchText(document.publicText)
  const workText = normalizeSearchText(document.workText)
  const text = `${publicText} ${workText}`
  const terms = normalizedTerms(expandedTerms.length ? expandedTerms : [query])
  const exact = text.includes(query) ? 3 : 0
  const hits = terms.filter((term) => text.includes(term)).length
  return exact + hits
}
