export const TAXONOMY_BANNER_COLORS = [
  'Emerald', 'Teal', 'Blue', 'Indigo', 'Violet', 'Magenta',
  'Rose', 'Coral', 'Amber', 'Olive', 'Lime', 'Green',
]

export function taxonomyBannerColor(color, id = 0) {
  return Number.isInteger(color) && color >= 0 && color < TAXONOMY_BANNER_COLORS.length
    ? color : (Number.isInteger(id) ? id : 0) % TAXONOMY_BANNER_COLORS.length
}
