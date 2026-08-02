export interface FuzzyRange {
  start: number
  end: number
}

export function findFuzzyRanges(text: string, query: string): FuzzyRange[] {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const ranges: FuzzyRange[] = []

  if (!lowerQuery || !lowerText) return ranges

  for (let start = 0; start < lowerText.length; start += 1) {
    if (lowerText[start] !== lowerQuery[0]) continue

    let queryIndex = 1
    let end = start + 1
    for (
      let index = start + 1;
      index < lowerText.length && queryIndex < lowerQuery.length;
      index += 1
    ) {
      if (lowerText[index] === lowerQuery[queryIndex]) {
        queryIndex += 1
        end = index + 1
      }
    }

    if (queryIndex === lowerQuery.length) {
      ranges.push({ start, end })
    }
  }

  return ranges
}
