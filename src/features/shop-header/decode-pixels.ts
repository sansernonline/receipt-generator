const SAMPLE_SIZE = 64; // the picture is shrunk to this many pixels wide or high: enough to find its main colour

/** Browser only: the picture's pixels as RGBA, shrunk. Rejects when the browser cannot decode the file. */
export async function decodePixels(file: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, SAMPLE_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    bitmap.close();
  }
}
