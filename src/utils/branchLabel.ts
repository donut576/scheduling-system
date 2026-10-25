export const getBranchLabel = (name: string | undefined, fallback: string) =>
  name?.trim() || fallback;
