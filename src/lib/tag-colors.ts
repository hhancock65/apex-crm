// Tags are free-form text with no stored color, so we derive a stable chip
// color per tag string by hashing it into a fixed palette — same tag always
// renders the same color without persisting anything.
const TAG_PALETTE = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-green-50 text-green-700 border-green-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-pink-50 text-pink-700 border-pink-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
]

export function tagColorClasses(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % TAG_PALETTE.length
  return TAG_PALETTE[index]
}
