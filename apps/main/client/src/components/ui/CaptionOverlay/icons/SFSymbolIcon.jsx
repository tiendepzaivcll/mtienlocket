import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Clock3,
  MoonStar,
  Flame,
  Heart,
  Map,
  LocateFixed,
  Sun,
  Wind,
} from "lucide-react";
import { PiMapPinFill } from "react-icons/pi";

const SFSymbolIcon = ({ data, color }) => {
  const normalizedData = SF_SYMBOL_ALIASES[data] || data;
  const Icon = SF_SYMBOL_ICONS[normalizedData];
  if (!Icon) return null;

  const iconColor = color || "#FFFFFF";

  return (
    <Icon
      aria-label={normalizedData}
      className="w-6 h-6 shrink-0"
      color={iconColor}
      fill={
        normalizedData === "clock.fill" || normalizedData === "clock"
          ? "none"
          : iconColor
      }
      strokeWidth={2}
    />
  );
};

const SF_SYMBOL_ALIASES = {
  cloud: "cloud.fill",
  "cloud.sun": "cloud.sun.fill",
  "cloud.moon": "cloud.moon.fill",
  "cloud.rain": "cloud.rain.fill",
  "cloud.sun.rain": "cloud.rain.fill",
  "cloud.sun.rain.fill": "cloud.rain.fill",
  "cloud.moon.rain": "cloud.rain.fill",
  "cloud.moon.rain.fill": "cloud.rain.fill",
  "cloud.heavyrain": "cloud.heavyrain.fill",
  "cloud.drizzle": "cloud.drizzle.fill",
  "cloud.snow": "cloud.snow.fill",
  "cloud.fog": "cloud.fog.fill",
  "cloud.bolt": "cloud.bolt.rain.fill",
  "cloud.bolt.fill": "cloud.bolt.rain.fill",
  "cloud.bolt.rain": "cloud.bolt.rain.fill",
  "cloud.hail": "cloud.hail.fill",
  moon: "moon.fill",
  "moon.stars": "moon.stars.fill",
  sun: "sun.max.fill",
  "sun.max": "sun.max.fill",
  "location.circle": "mappin.and.ellipse",
  "location.circle.fill": "mappin.and.ellipse",
  "mappin.circle": "mappin.circle.fill",
};

const SF_SYMBOL_ICONS = {
  "sun.max.fill": Sun,
  "moon.fill": MoonStar,
  "moon.stars.fill": MoonStar,
  "cloud.fill": Cloud,
  "cloud.sun.fill": CloudSun,
  "cloud.moon.fill": CloudMoon,
  "cloud.rain.fill": CloudRain,
  "cloud.heavyrain.fill": CloudRain,
  "cloud.drizzle.fill": CloudDrizzle,
  "cloud.snow.fill": CloudSnow,
  "cloud.fog.fill": CloudFog,
  "cloud.bolt.rain.fill": CloudLightning,
  "cloud.hail.fill": CloudHail,
  "clock.fill": Clock3,
  clock: Clock3,
  wind: Wind,
  "flame.fill": Flame,
  flame: Flame,
  "suit.heart.fill": Heart,
  "heart.fill": Heart,
  "mappin.and.ellipse": PiMapPinFill,
  "mappin.circle.fill": PiMapPinFill,
  "mappin.circle": PiMapPinFill,
  "mappin": PiMapPinFill,
  "location.fill": LocateFixed,
  location: LocateFixed,
  map: Map,
};

export default SFSymbolIcon;
