export const PHOTOBOOTH_OUTPUT_SIZE = 1920;
export const PHOTOBOOTH_PHOTO_COUNT = 4;

const FRAME_IDS = new Set(["dark-sparkle", "blue-sky", "kitty-pink"]);

const defaultCanvasFactory = () => document.createElement("canvas");
const defaultFileFactory = (parts, name, options) => new File(parts, name, options);

export function getCenteredSquareCrop(width, height) {
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Ảnh hoặc camera chưa có kích thước hợp lệ.");
  }
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

export function getPhotoboothGrid({
  size = PHOTOBOOTH_OUTPUT_SIZE,
  gap = 8,
  border = 8,
} = {}) {
  if (
    !Number.isInteger(size) || size <= 0 ||
    !Number.isInteger(gap) || gap < 0 ||
    !Number.isInteger(border) || border < 0 ||
    size - 2 * border - gap < 2
  ) {
    throw new Error("Kích thước khung Photobooth không hợp lệ.");
  }
  const usable = size - 2 * border - gap;
  const first = Math.floor(usable / 2);
  const second = usable - first;
  const tiles = [
    { x: border, y: border, width: first, height: first },
    { x: border + first + gap, y: border, width: second, height: first },
    { x: border, y: border + first + gap, width: first, height: second },
    { x: border + first + gap, y: border + first + gap, width: second, height: second },
  ];
  return { size, gap, border, tiles };
}

function prepareCanvas(size, createCanvas) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Kích thước ảnh Photobooth không hợp lệ.");
  }
  const canvas = createCanvas();
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không tạo được canvas ảnh.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

function exportJpeg(canvas, { quality, filename, createFile }) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob || blob.size <= 0) {
          reject(new Error("Không thể tạo ảnh Photobooth. Vui lòng thử lại."));
          return;
        }
        try {
          resolve(createFile([blob], filename, { type: "image/jpeg", lastModified: Date.now() }));
        } catch (error) {
          reject(error);
        }
      }, "image/jpeg", quality);
    } catch (error) {
      reject(error);
    }
  });
}

// Captures are already mirrored here; composition must never mirror them again.
export async function capturePhotoboothFrame(video, {
  mirror = false,
  size = PHOTOBOOTH_OUTPUT_SIZE,
  quality = 0.94,
  filename = `locket-pro-photobooth-${Date.now()}.jpg`,
  createCanvas = defaultCanvasFactory,
  createFile = defaultFileFactory,
} = {}) {
  if (!video || video.readyState < 2 || !Number.isFinite(video.readyState)) {
    throw new Error("Camera chưa sẵn sàng, vui lòng chờ giây lát.");
  }
  const crop = getCenteredSquareCrop(video.videoWidth, video.videoHeight);
  const { canvas, context } = prepareCanvas(size, createCanvas);
  context.save();
  if (mirror) {
    context.translate(size, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, crop.sx, crop.sy, crop.side, crop.side, 0, 0, size, size);
  context.restore();
  return exportJpeg(canvas, { quality, filename, createFile });
}

function assertLocalImageSource(source) {
  const isLocalUrl = typeof source === "string" && /^blob:/i.test(source);
  const isImageBlob = typeof Blob !== "undefined" && source instanceof Blob &&
    source.size > 0 && source.type.startsWith("image/");
  if (!isLocalUrl && !isImageBlob) {
    throw new Error("Photobooth chỉ ghép các ảnh đã chụp trên thiết bị.");
  }
}

function loadLocalImage(source) {
  assertLocalImageSource(source);
  return new Promise((resolve, reject) => {
    const ownsUrl = typeof source !== "string";
    const url = ownsUrl ? URL.createObjectURL(source) : source;
    const image = new Image();
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      if (ownsUrl) URL.revokeObjectURL(url);
    };
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("Không thể đọc một ảnh Photobooth. Hãy chụp lại ảnh đó.")); };
    image.src = url;
  });
}

function assertFrameSource(id, src) {
  if (!FRAME_IDS.has(id) || src !== `/images/photobooth/frames/${id}.png`) {
    throw new Error("Khung Photobooth không hợp lệ hoặc chưa được hỗ trợ.");
  }
}

function frameTiles(frame, size) {
  assertFrameSource(frame?.id, frame?.src);
  if (!Array.isArray(frame.photoRegions) || frame.photoRegions.length !== PHOTOBOOTH_PHOTO_COUNT) {
    throw new Error("Khung Photobooth phải có đủ 4 vùng ảnh.");
  }
  const tiles = frame.photoRegions.map((region) => {
    const { x, y, width, height } = region || {};
    if (![x, y, width, height].every(Number.isFinite) ||
      x < 0 || y < 0 || width <= 0 || height <= 0 ||
      x + width > 1 + 1e-9 || y + height > 1 + 1e-9) {
      throw new Error("Vùng ảnh trong khung Photobooth không hợp lệ.");
    }
    const left = Math.round(x * size);
    const top = Math.round(y * size);
    const right = Math.round((x + width) * size);
    const bottom = Math.round((y + height) * size);
    if (right <= left || bottom <= top || right > size || bottom > size) {
      throw new Error("Vùng ảnh trong khung Photobooth quá nhỏ hoặc vượt khỏi khung.");
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
  if (tiles.some((tile, index) => tiles.slice(index + 1).some((other) =>
    tile.x < other.x + other.width && tile.x + tile.width > other.x &&
    tile.y < other.y + other.height && tile.y + tile.height > other.y))) {
    throw new Error("Các vùng ảnh trong khung Photobooth không được chồng lên nhau.");
  }
  return tiles;
}

function loadApprovedFrameImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => { image.onload = null; image.onerror = null; };
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("Không tải được khung Photobooth đã chọn. Hãy thử lại.")); };
    // Only an approved same-origin asset reaches this loader. No remote CORS sources.
    image.src = src;
  });
}

function centeredCoverCrop(image, tile) {
  const width = image?.naturalWidth ?? image?.width;
  const height = image?.naturalHeight ?? image?.height;
  getCenteredSquareCrop(width, height); // Reject unloaded/empty sources consistently.
  const ratio = tile.width / tile.height;
  const cropWidth = Math.min(width, height * ratio);
  const cropHeight = Math.min(height, width / ratio);
  return { sx: (width - cropWidth) / 2, sy: (height - cropHeight) / 2,
    width: cropWidth, height: cropHeight };
}

export async function composePhotoboothGrid(sources, {
  size = PHOTOBOOTH_OUTPUT_SIZE,
  gap = 8,
  border = 8,
  background = "#ffffff",
  frame = null,
  quality = 0.94,
  filename = `locket-pro-photobooth-grid-${Date.now()}.jpg`,
  createCanvas = defaultCanvasFactory,
  loadImage = loadLocalImage,
  loadFrameImage = loadApprovedFrameImage,
  createFile = defaultFileFactory,
} = {}) {
  if (!Array.isArray(sources) || sources.length !== PHOTOBOOTH_PHOTO_COUNT ||
    new Set(sources).size !== PHOTOBOOTH_PHOTO_COUNT) {
    throw new Error("Cần chụp đủ 4 ảnh riêng trước khi ghép Photobooth.");
  }
  sources.forEach(assertLocalImageSource);
  const layout = getPhotoboothGrid({ size, gap, border });
  const tiles = frame ? frameTiles(frame, size) : layout.tiles;
  // Load and validate every frame before drawing, so an incomplete grid is never exported.
  const [images, overlay] = await Promise.all([
    Promise.all(sources.map((source) => loadImage(source))),
    frame ? loadFrameImage(frame.src) : null,
  ]);
  const crops = images.map((image, index) => {
    if (frame) return centeredCoverCrop(image, tiles[index]);
    const crop = getCenteredSquareCrop(image?.naturalWidth ?? image?.width,
      image?.naturalHeight ?? image?.height);
    return { ...crop, width: crop.side, height: crop.side };
  });
  if (frame) {
    const width = overlay?.naturalWidth ?? overlay?.width;
    const height = overlay?.naturalHeight ?? overlay?.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error("Khung Photobooth chưa tải xong hoặc không thể đọc được.");
    }
  }
  const { canvas, context } = prepareCanvas(size, createCanvas);
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  images.forEach((image, index) => {
    const crop = crops[index];
    const tile = tiles[index];
    context.drawImage(image, crop.sx, crop.sy, crop.width, crop.height,
      tile.x, tile.y, tile.width, tile.height);
  });
  if (overlay) context.drawImage(overlay, 0, 0, size, size);
  return exportJpeg(canvas, { quality, filename, createFile });
}
