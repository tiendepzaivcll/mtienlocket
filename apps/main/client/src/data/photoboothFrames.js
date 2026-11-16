// Each PNG is a square alpha overlay. Photo bounds include a small overlap
// beneath its illustrated edges so the live preview and exported JPEG match.
const regions = (rectangles) => rectangles.map(([x, y, width, height]) => ({
  x: x / 1254,
  y: y / 1254,
  width: width / 1254,
  height: height / 1254,
}));

export const PHOTOBOOTH_FRAMES = [
  { id: "none", name: "Không khung", src: null, photoRegions: null },
  {
    id: "dark-sparkle",
    name: "Dark Sparkle",
    src: "/images/photobooth/frames/dark-sparkle.png",
    photoRegions: regions([
      [132, 136, 457, 454], [665, 136, 457, 454],
      [132, 668, 457, 455], [665, 668, 457, 455],
    ]),
  },
  {
    id: "blue-sky",
    name: "Blue Sky",
    src: "/images/photobooth/frames/blue-sky.png",
    photoRegions: regions([
      [120, 127, 480, 473], [654, 127, 480, 473],
      [120, 655, 480, 479], [654, 655, 481, 479],
    ]),
  },
  {
    id: "kitty-pink",
    name: "Kitty hồng",
    src: "/images/photobooth/frames/kitty-pink.png",
    photoRegions: regions([
      [126, 128, 450, 450], [679, 128, 449, 450],
      [126, 678, 450, 451], [679, 678, 449, 451],
    ]),
  },
];
