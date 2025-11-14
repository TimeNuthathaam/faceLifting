import { FaceLandmarks } from './faceDetection';

export interface FaceAdjustments {
  slimFace: number;        // -100 to 100
  headSize: number;        // -100 to 100
  jawline: number;         // -100 to 100
  chin: number;            // -100 to 100
  forehead: number;        // -100 to 100
  cheekbones: number;      // -100 to 100
  faceWidth: number;       // -100 to 100
}

export class FaceManipulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private originalImageData: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
  }

  setOriginalImage(image: HTMLImageElement) {
    // Scale down image if too large for better performance
    const maxWidth = 1920;
    const maxHeight = 1080;

    let width = image.width;
    let height = image.height;

    // Calculate scale factor
    if (width > maxWidth || height > maxHeight) {
      const scaleX = maxWidth / width;
      const scaleY = maxHeight / height;
      const scale = Math.min(scaleX, scaleY);

      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }

    // Set canvas size
    this.canvas.width = width;
    this.canvas.height = height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // Draw image with scaling
    this.ctx.drawImage(image, 0, 0, width, height);

    // Save original image data
    this.originalImageData = this.ctx.getImageData(0, 0, width, height);

    console.log(`Canvas set to ${width}x${height} (original: ${image.width}x${image.height})`);
  }

  applyAdjustments(landmarks: FaceLandmarks, adjustments: FaceAdjustments) {
    if (!this.originalImageData || landmarks.keypoints.length === 0) {
      return;
    }

    // Reset to original image
    this.ctx.putImageData(this.originalImageData, 0, 0);

    // Get face center and bounds
    const faceCenter = this.getFaceCenter(landmarks);
    const faceBounds = landmarks.box;

    // Create displacement map based on adjustments
    const displacementMap = this.createDisplacementMap(
      landmarks,
      adjustments,
      faceCenter,
      faceBounds
    );

    // Apply mesh warping
    this.applyMeshWarping(displacementMap);
  }

  private getFaceCenter(landmarks: FaceLandmarks): { x: number; y: number } {
    const keypoints = landmarks.keypoints;
    const sum = keypoints.reduce(
      (acc, kp) => ({ x: acc.x + kp.x, y: acc.y + kp.y }),
      { x: 0, y: 0 }
    );
    return {
      x: sum.x / keypoints.length,
      y: sum.y / keypoints.length,
    };
  }

  private createDisplacementMap(
    landmarks: FaceLandmarks,
    adjustments: FaceAdjustments,
    faceCenter: { x: number; y: number },
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number }
  ): Float32Array {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const displacementMap = new Float32Array(width * height * 2); // x and y displacement for each pixel

    // Key landmark indices (MediaPipe Face Mesh)
    // These are approximate - MediaPipe has 468 landmarks
    const leftCheek = this.getKeypointsInRange(landmarks, 234, 234);
    const rightCheek = this.getKeypointsInRange(landmarks, 454, 454);
    const noseTip = this.getKeypointsInRange(landmarks, 1, 1);
    const chin = this.getKeypointsInRange(landmarks, 152, 152);
    const leftJaw = this.getKeypointsInRange(landmarks, 172, 175);
    const rightJaw = this.getKeypointsInRange(landmarks, 397, 400);
    const forehead = this.getKeypointsInRange(landmarks, 10, 10);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 2;

        // Calculate relative position to face center
        const dx = x - faceCenter.x;
        const dy = y - faceCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Check if pixel is within face bounds (with padding)
        const padding = 50;
        if (
          x < faceBounds.xMin - padding ||
          x > faceBounds.xMax + padding ||
          y < faceBounds.yMin - padding ||
          y > faceBounds.yMax + padding
        ) {
          displacementMap[idx] = 0;
          displacementMap[idx + 1] = 0;
          continue;
        }

        // Calculate displacement based on adjustments
        let displacementX = 0;
        let displacementY = 0;

        // Slim Face - push pixels outward/inward horizontally
        if (adjustments.slimFace !== 0) {
          const slimFactor = -adjustments.slimFace * 0.0008;
          const horizontalFactor = Math.abs(Math.cos(angle));
          const verticalWeight = Math.abs(dy) / (faceBounds.height / 2);
          displacementX += dx * slimFactor * horizontalFactor * verticalWeight;
        }

        // Head Size - scale overall
        if (adjustments.headSize !== 0) {
          const scaleFactor = adjustments.headSize * 0.0006;
          displacementX += dx * scaleFactor;
          displacementY += dy * scaleFactor;
        }

        // Face Width - adjust horizontal width
        if (adjustments.faceWidth !== 0) {
          const widthFactor = -adjustments.faceWidth * 0.0008;
          const horizontalFactor = Math.abs(Math.cos(angle));
          displacementX += dx * widthFactor * horizontalFactor;
        }

        // Jawline - sharpen or soften jaw area
        if (adjustments.jawline !== 0 && y > faceCenter.y) {
          const jawFactor = adjustments.jawline * 0.0005;
          const jawWeight = (y - faceCenter.y) / (faceBounds.height / 2);
          const horizontalFactor = Math.abs(Math.cos(angle));
          displacementX += -dx * jawFactor * jawWeight * horizontalFactor;
          displacementY += dy * jawFactor * jawWeight * 0.3;
        }

        // Chin - adjust chin length
        if (adjustments.chin !== 0 && y > faceCenter.y + faceBounds.height * 0.2) {
          const chinFactor = adjustments.chin * 0.0008;
          const chinWeight = Math.max(0, (y - faceCenter.y - faceBounds.height * 0.2) / (faceBounds.height * 0.3));
          displacementY += dy * chinFactor * chinWeight;
        }

        // Forehead - adjust forehead height/width
        if (adjustments.forehead !== 0 && y < faceCenter.y) {
          const foreheadFactor = adjustments.forehead * 0.0006;
          const foreheadWeight = Math.abs((y - faceCenter.y) / (faceBounds.height / 2));
          displacementY += dy * foreheadFactor * foreheadWeight;
          displacementX += dx * foreheadFactor * foreheadWeight * 0.3;
        }

        // Cheekbones - adjust cheek prominence
        if (adjustments.cheekbones !== 0) {
          const cheekFactor = -adjustments.cheekbones * 0.0006;
          const cheekYRange = y > faceCenter.y - faceBounds.height * 0.2 && y < faceCenter.y + faceBounds.height * 0.1;
          if (cheekYRange) {
            const cheekWeight = Math.abs(Math.cos(angle));
            displacementX += dx * cheekFactor * cheekWeight;
          }
        }

        // Apply smoothing based on distance from face center
        const maxDistance = Math.max(faceBounds.width, faceBounds.height) / 2 + padding;
        const smoothFactor = Math.max(0, 1 - (distance / maxDistance));

        displacementMap[idx] = displacementX * smoothFactor;
        displacementMap[idx + 1] = displacementY * smoothFactor;
      }
    }

    return displacementMap;
  }

  private getKeypointsInRange(landmarks: FaceLandmarks, start: number, end: number) {
    return landmarks.keypoints.slice(start, end + 1);
  }

  private applyMeshWarping(displacementMap: Float32Array) {
    if (!this.originalImageData) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const originalData = this.originalImageData.data;
    const newImageData = this.ctx.createImageData(width, height);
    const newData = newImageData.data;

    // Apply backward mapping (for each destination pixel, find source pixel)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 2;
        const displacementX = displacementMap[idx];
        const displacementY = displacementMap[idx + 1];

        // Source position (backward mapping)
        const srcX = x - displacementX;
        const srcY = y - displacementY;

        // Bilinear interpolation
        const color = this.bilinearInterpolate(originalData, width, height, srcX, srcY);

        const pixelIdx = (y * width + x) * 4;
        newData[pixelIdx] = color[0];     // R
        newData[pixelIdx + 1] = color[1]; // G
        newData[pixelIdx + 2] = color[2]; // B
        newData[pixelIdx + 3] = color[3]; // A
      }
    }

    this.ctx.putImageData(newImageData, 0, 0);
  }

  private bilinearInterpolate(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x: number,
    y: number
  ): [number, number, number, number] {
    // Clamp coordinates
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));

    const x0 = Math.floor(x);
    const x1 = Math.min(x0 + 1, width - 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(y0 + 1, height - 1);

    const dx = x - x0;
    const dy = y - y0;

    const getPixel = (px: number, py: number): [number, number, number, number] => {
      const idx = (py * width + px) * 4;
      return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    };

    const p00 = getPixel(x0, y0);
    const p10 = getPixel(x1, y0);
    const p01 = getPixel(x0, y1);
    const p11 = getPixel(x1, y1);

    const result: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const val =
        p00[i] * (1 - dx) * (1 - dy) +
        p10[i] * dx * (1 - dy) +
        p01[i] * (1 - dx) * dy +
        p11[i] * dx * dy;
      result[i] = Math.round(val);
    }

    return result;
  }

  reset() {
    if (this.originalImageData) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
