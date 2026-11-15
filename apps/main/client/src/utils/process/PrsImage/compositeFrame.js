import { createImage } from "./createImage";

/**
 * Composite a camera frame onto an image
 * @param {File|Blob} imageFile - The base image file
 * @param {string} frameImageUrl - The frame image URL
 * @returns {Promise<File>} - A new File with frame composited on top
 */
export const compositeFrameOnImage = async (imageFile, frameImageUrl) => {
  try {
    // Create image from the uploaded file
    const imageBlob = imageFile instanceof File ? imageFile : imageFile;
    const imageUrl = URL.createObjectURL(imageBlob);
    const baseImage = await createImage(imageUrl);

    // Create image from the frame
    const frameImage = await createImage(frameImageUrl);

    // Create canvas with same dimensions as base image
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context not available");
    }

    canvas.width = baseImage.width;
    canvas.height = baseImage.height;

    // Draw base image
    ctx.drawImage(baseImage, 0, 0, baseImage.width, baseImage.height);

    // Draw frame on top (scaled to fit the canvas)
    ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

    // Clean up object URL
    URL.revokeObjectURL(imageUrl);

    // Convert canvas to File
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        // Create a new File with the composited image
        const fileName = imageFile instanceof File ? imageFile.name : "framed-image.jpg";
        const compositeFile = new File([blob], fileName, { type: "image/jpeg" });
        resolve(compositeFile);
      }, "image/jpeg", 0.95); // 95% quality to maintain visual fidelity
    });
  } catch (error) {
    console.error("Error compositing frame on image:", error);
    throw error;
  }
};
