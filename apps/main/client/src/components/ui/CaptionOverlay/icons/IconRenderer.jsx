import EmojiIcon from "./EmojiIcon";
import ImageIcon from "./ImageIcon";
import SFSymbolIcon from "./SFSymbolIcon";

const ICON_COMPONENTS = {
  emoji: EmojiIcon,
  image: ImageIcon,
  sf_symbol: SFSymbolIcon,
};

function IconRenderer({ icon }) {
  if (!icon) return null;

  const normalizedIcon =
    typeof icon === "string"
      ? {
          data: icon,
          type: /^https?:\/\//i.test(icon) ? "image" : "emoji",
        }
      : icon;
  if (!normalizedIcon?.data) return null;

  const inferredType =
    normalizedIcon.type ||
    (/^https?:\/\//i.test(normalizedIcon.data || "") ? "image" : "emoji");
  const Component = ICON_COMPONENTS[inferredType];
  if (!Component) return null;

  return <Component {...normalizedIcon} type={inferredType} />;
}

export default IconRenderer;
