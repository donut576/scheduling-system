/**
 * Group Color Assignment Utility
 *
 * Deterministically assigns a unique color code to each employee group.
 *
 * Design (Property 21: 群組色彩唯一性):
 * Colors are assigned from a fixed, ordered palette by first-seen order of
 * the group identifier. As long as the number of distinct groups does not
 * exceed the palette size (`GROUP_COLOR_PALETTE.length`), every group is
 * guaranteed to receive a color that is different from every other group's
 * color (pairwise uniqueness). If the number of distinct groups exceeds the
 * palette size, colors wrap around (modulo) and uniqueness is no longer
 * guaranteed - the palette should be extended if the system needs to support
 * more concurrent groups than `GROUP_COLOR_PALETTE.length`.
 *
 * Validates: Requirements 11.4
 */

/**
 * Fixed color palette used for group color assignment.
 * All colors are visually distinct and suitable for Ant Design `Tag` colors.
 */
export const GROUP_COLOR_PALETTE: readonly string[] = [
  '#1890FF',
  '#52C41A',
  '#FAAD14',
  '#F5222D',
  '#722ED1',
  '#13C2C2',
  '#EB2F96',
  '#FA8C16',
  '#A0D911',
  '#2F54EB',
  '#08979C',
  '#C41D7F',
  '#D4380D',
  '#531DAB',
  '#237804',
  '#AD6800',
  '#0050B3',
  '#9E1068',
  '#5B8C00',
  '#391085',
];

/**
 * Pure function that assigns a unique color to each distinct group identifier
 * in `groupIds`, based on first-seen insertion order.
 *
 * Guarantee: if the number of distinct group identifiers is <= GROUP_COLOR_PALETTE.length,
 * all assigned colors are pairwise unique (no two distinct groups share a color).
 *
 * @param groupIds - list of group identifiers (duplicates allowed; order matters for assignment)
 * @returns a Map from group identifier to assigned hex color code
 */
export function assignGroupColors(groupIds: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  let nextIndex = 0;

  for (const groupId of groupIds) {
    if (!colorMap.has(groupId)) {
      const color = GROUP_COLOR_PALETTE[nextIndex % GROUP_COLOR_PALETTE.length] as string;
      colorMap.set(groupId, color);
      nextIndex += 1;
    }
  }

  return colorMap;
}

/**
 * Module-level registry used to memoize color assignment across the app so
 * that the same group identifier always resolves to the same color once assigned,
 * without requiring callers to pass the full list of known groups every time.
 */
const groupColorRegistry = new Map<string, string>();
let registryNextIndex = 0;

/**
 * Returns the color assigned to `groupId`, assigning and caching a new one
 * from `GROUP_COLOR_PALETTE` (in first-seen order) if it hasn't been seen before.
 *
 * Intended as a fallback for records where `groupColor` is not provided by the
 * backend/mock data.
 */
export function getGroupColor(groupId: string): string {
  const cached = groupColorRegistry.get(groupId);
  if (cached) {
    return cached;
  }

  const color = GROUP_COLOR_PALETTE[registryNextIndex % GROUP_COLOR_PALETTE.length] as string;
  registryNextIndex += 1;
  groupColorRegistry.set(groupId, color);
  return color;
}

/**
 * Clears the module-level color registry. Exposed primarily for test isolation.
 */
export function resetGroupColorRegistry(): void {
  groupColorRegistry.clear();
  registryNextIndex = 0;
}
