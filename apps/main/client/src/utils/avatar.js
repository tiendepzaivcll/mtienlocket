export const DEFAULT_PROFILE_IMAGE = "/images/default_avatar_t97.png";

export const getAvatarSource = (user = {}) =>
  [
    user?.profilePicture,
    user?.profilePic,
    user?.profile_picture_url,
    user?.photoURL,
    user?.picture,
  ].find((value) => typeof value === "string" && value.trim()) ||
  DEFAULT_PROFILE_IMAGE;

export const handleAvatarError = (event) => {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") return;

  image.dataset.fallbackApplied = "true";
  image.src = DEFAULT_PROFILE_IMAGE;
};
