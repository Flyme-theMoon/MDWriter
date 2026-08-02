export interface FuzzyRange {
  start: number
  end: number
}

export function findFuzzyRanges(text: string, query: string): FuzzyRange[] {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const ranges: FuzzyRange[] = []

  if (!lowerQuery || !lowerText) return ranges

  let startIndex = 0
  while (startIndex < lowerText.length) {
    const index = lowerText.indexOf(lowerQuery, startIndex)
    if (index === -1) break
    ranges.push({ start: index, end: index + lowerQuery.length })
    startIndex = index + 1
  }

  return ranges
}
