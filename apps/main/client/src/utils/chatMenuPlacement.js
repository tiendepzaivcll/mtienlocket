export const getChatMenuPlacement = ({
  anchorTop,
  anchorBottom,
  boundaryTop,
  boundaryBottom,
  menuHeight = 190,
  gap = 8,
}) => {
  const spaceAbove = Number(anchorTop) - Number(boundaryTop);
  const spaceBelow = Number(boundaryBottom) - Number(anchorBottom);
  const requiredSpace = Number(menuHeight) + Number(gap);

  if (spaceAbove >= requiredSpace) return "above";
  if (spaceBelow >= requiredSpace) return "below";
  return spaceBelow >= spaceAbove ? "below" : "above";
};
