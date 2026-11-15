export const shouldHideNavigationDock = ({
  selectedFile,
  selectedQueue,
  imageToCrop,
  videoCrop,
} = {}) =>
  Boolean(
    selectedFile ||
      typeof selectedQueue === "number" ||
      imageToCrop ||
      videoCrop,
  );
