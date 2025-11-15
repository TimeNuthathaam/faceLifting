import { FaceLandmarks } from './faceDetection';
import { LightingAnalysis } from './geminiService';

export interface FaceAdjustments {
  slimFace: number;        // -100 to 100
  headSize: number;        // -100 to 100
  jawline: number;         // -200 to 200
  chin: number;            // -100 to 100
  forehead: number;        // -100 to 100
  cheekbones: number;      // -100 to 100
  faceWidth: number;       // -100 to 100
  // Lighting adjustments (Dodge & Burn)
  dodge: number;           // -100 to 100 (increase brightness on highlights)
  burn: number;            // -100 to 100 (decrease brightness on highlights)
  clarity: number;         // -100 to 100 (edge enhancement/softening)
  contrast: number;        // -100 to 100 (overall contrast adjustment)
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

    // Apply lighting adjustments (Dodge & Burn)
    this.applyLightingAdjustments(landmarks, adjustments, faceCenter, faceBounds);
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

  private applyLightingAdjustments(
    landmarks: FaceLandmarks,
    adjustments: FaceAdjustments,
    faceCenter: { x: number; y: number },
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number }
  ) {
    const { dodge, burn, clarity, contrast } = adjustments;

    // Skip if no lighting adjustments
    if (dodge === 0 && burn === 0 && clarity === 0 && contrast === 0) {
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply Dodge & Burn first (works on original colors)
    if (dodge !== 0 || burn !== 0) {
      this.applyDodgeBurnAdvanced(data, width, height, landmarks, faceBounds, dodge, burn);
    }

    // Apply Clarity (edge enhancement/softening)
    if (clarity !== 0) {
      this.applyClarity(data, width, height, faceBounds, clarity);
    }

    // Apply Contrast last
    if (contrast !== 0) {
      this.applyContrast(data, width, height, faceBounds, contrast);
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  private applyDodgeBurnAdvanced(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    landmarks: FaceLandmarks,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number },
    dodge: number,
    burn: number
  ) {
    // Create a copy for reading original values
    const originalData = new Uint8ClampedArray(data);

    // Step 1: Calculate local brightness variations (where is light uneven?)
    const localContrastMap = this.calculateLocalContrast(originalData, width, height, faceBounds);

    // Step 2: Calculate average target brightness for flattening
    const targetBrightness = this.calculateTargetBrightness(originalData, width, height, faceBounds);

    // Step 3: Get landmark-based zones for reference
    const targetAreas = this.getTargetAreas(landmarks);

    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = originalData[idx];
        const g = originalData[idx + 1];
        const b = originalData[idx + 2];

        // Calculate luminance (perceived brightness)
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Get local contrast (how much brighter than surroundings?)
        const localContrast = localContrastMap[y * width + x] || 0;

        // Calculate landmark influence
        let landmarkInfluence = 0;
        for (const area of targetAreas) {
          const dx = x - area.x;
          const dy = y - area.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < area.radius) {
            const normalizedDist = distance / area.radius;
            const cosineWeight = (Math.cos(normalizedDist * Math.PI) + 1) / 2;
            const influence = cosineWeight * area.intensity;
            landmarkInfluence = Math.max(landmarkInfluence, influence);
          }
        }

        // BURN: Flatten highlights by bringing them closer to average
        if (burn > 0) {
          // Calculate how much brighter this pixel is than target
          const brightnessDiff = luminance - targetBrightness;

          // Only apply to pixels brighter than average
          if (brightnessDiff > 5) {
            // Influence based on both local contrast and landmark position
            const influence = Math.max(
              localContrast * 0.9,        // Primary: actual local brightness variation
              landmarkInfluence * 0.5      // Secondary: landmark position
            );

            if (influence > 0.05) {
              const burnIntensity = (burn / 100) * influence;

              // How much to reduce brightness (push towards target)
              const reductionAmount = brightnessDiff * burnIntensity * 0.8;

              // Calculate target luminance after reduction
              const targetLum = luminance - reductionAmount;
              const ratio = targetLum / Math.max(luminance, 1);

              // Apply ratio to all color channels (preserve color, reduce brightness)
              data[idx] = Math.max(0, Math.min(255, Math.round(r * ratio)));
              data[idx + 1] = Math.max(0, Math.min(255, Math.round(g * ratio)));
              data[idx + 2] = Math.max(0, Math.min(255, Math.round(b * ratio)));
            }
          }
        }

        // DODGE: Brighten dark areas for artistic enhancement
        if (dodge > 0 && landmarkInfluence > 0.1) {
          const dodgeIntensity = (dodge / 100) * landmarkInfluence;

          // Best effect on midtones, avoid already bright areas
          let targetWeight = 0;
          const currentR = data[idx];
          const currentG = data[idx + 1];
          const currentB = data[idx + 2];
          const currentLum = 0.299 * currentR + 0.587 * currentG + 0.114 * currentB;

          if (currentLum < 180 && currentLum > 60) {
            if (currentLum > 120) {
              targetWeight = 0.8;
            } else {
              targetWeight = 1.0;
            }

            if (targetWeight > 0) {
              const finalIntensity = dodgeIntensity * targetWeight;

              // Screen blending mode
              const invR = 255 - currentR;
              const invG = 255 - currentG;
              const invB = 255 - currentB;

              const screenR = 255 - (invR * (1 - finalIntensity * 0.6));
              const screenG = 255 - (invG * (1 - finalIntensity * 0.6));
              const screenB = 255 - (invB * (1 - finalIntensity * 0.6));

              data[idx] = Math.min(255, Math.round(screenR));
              data[idx + 1] = Math.min(255, Math.round(screenG));
              data[idx + 2] = Math.min(255, Math.round(screenB));
            }
          }
        }
      }
    }
  }

  private calculateLocalContrast(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number }
  ): Float32Array {
    const contrastMap = new Float32Array(width * height);
    const radius = 15; // Neighborhood radius for local comparison

    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const centerLum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Calculate average luminance in neighborhood
        let sumLum = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= Math.floor(faceBounds.xMin) && nx < Math.ceil(faceBounds.xMax) &&
                ny >= Math.floor(faceBounds.yMin) && ny < Math.ceil(faceBounds.yMax)) {

              const nidx = (ny * width + nx) * 4;
              const nr = data[nidx];
              const ng = data[nidx + 1];
              const nb = data[nidx + 2];
              const nLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;

              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= radius) {
                const weight = Math.exp(-(distance * distance) / (2 * (radius / 2) * (radius / 2)));
                sumLum += nLum * weight;
                count += weight;
              }
            }
          }
        }

        const avgLum = count > 0 ? sumLum / count : centerLum;

        // How much brighter is this pixel than its neighborhood?
        const diff = centerLum - avgLum;

        // Normalize to 0-1 range (0 = same as neighbors, 1 = much brighter)
        let contrast = 0;
        if (diff > 0) {
          // Brighter than surroundings
          contrast = Math.min(1.0, diff / 80); // 80 luminance units = full contrast
        }

        contrastMap[y * width + x] = contrast;
      }
    }

    return contrastMap;
  }

  private calculateTargetBrightness(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number }
  ): number {
    const luminanceValues: number[] = [];

    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        luminanceValues.push(luminance);
      }
    }

    // Use median instead of mean for robustness against outliers
    luminanceValues.sort((a, b) => a - b);
    const median = luminanceValues[Math.floor(luminanceValues.length / 2)];

    // Target is slightly below median to create natural look
    return median * 0.95;
  }

  private analyzeBrightness(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number }
  ): Float32Array {
    const brightnessMap = new Float32Array(width * height);

    // Step 1: Calculate luminance for each pixel in face area
    const luminanceValues: number[] = [];
    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        luminanceValues.push(luminance);
      }
    }

    // Step 2: Calculate statistics (find the bright areas)
    luminanceValues.sort((a, b) => a - b);
    const count = luminanceValues.length;
    const p75 = luminanceValues[Math.floor(count * 0.75)]; // 75th percentile
    const p90 = luminanceValues[Math.floor(count * 0.90)]; // 90th percentile
    const max = luminanceValues[count - 1];

    // Step 3: Create brightness map (normalize based on face's own brightness distribution)
    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const mapIdx = y * width + x;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Normalize brightness relative to face's brightness distribution
        let brightnessLevel = 0;
        if (luminance > p90) {
          // Top 10% brightest - these are likely studio light spots
          brightnessLevel = 0.8 + ((luminance - p90) / (max - p90)) * 0.2; // 0.8 to 1.0
        } else if (luminance > p75) {
          // 75th to 90th percentile - bright areas
          brightnessLevel = 0.5 + ((luminance - p75) / (p90 - p75)) * 0.3; // 0.5 to 0.8
        } else if (luminance > 150) {
          // Generally bright
          brightnessLevel = 0.3 + ((luminance - 150) / (p75 - 150)) * 0.2; // 0.3 to 0.5
        } else if (luminance > 100) {
          // Somewhat bright
          brightnessLevel = ((luminance - 100) / 50) * 0.3; // 0 to 0.3
        }

        brightnessMap[mapIdx] = Math.min(1.0, Math.max(0, brightnessLevel));
      }
    }

    // Step 4: Apply Gaussian blur to brightness map for smoother transitions
    const blurred = this.gaussianBlurMap(brightnessMap, width, height, faceBounds, 3);

    return blurred;
  }

  private gaussianBlurMap(
    map: Float32Array,
    width: number,
    height: number,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number },
    radius: number
  ): Float32Array {
    const result = new Float32Array(width * height);

    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        let sum = 0;
        let weightSum = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= radius) {
                const weight = Math.exp(-(distance * distance) / (2 * radius * radius));
                sum += map[ny * width + nx] * weight;
                weightSum += weight;
              }
            }
          }
        }

        result[y * width + x] = weightSum > 0 ? sum / weightSum : 0;
      }
    }

    return result;
  }

  private getTargetAreas(landmarks: FaceLandmarks): Array<{ x: number; y: number; radius: number; intensity: number }> {
    const areas: Array<{ x: number; y: number; radius: number; intensity: number }> = [];
    const keypoints = landmarks.keypoints;

    // Upper forehead - primary highlight area
    if (keypoints[10]) {
      areas.push({
        x: keypoints[10].x,
        y: keypoints[10].y - 20, // Slightly above landmark
        radius: 60,
        intensity: 1.0
      });
    }

    // Center forehead
    if (keypoints[151]) {
      areas.push({
        x: keypoints[151].x,
        y: keypoints[151].y,
        radius: 50,
        intensity: 0.95
      });
    }

    // Nose bridge - strong highlight
    if (keypoints[6]) {
      areas.push({
        x: keypoints[6].x,
        y: keypoints[6].y,
        radius: 30,
        intensity: 0.95
      });
    }

    // Nose tip - very strong highlight
    if (keypoints[4]) {
      areas.push({
        x: keypoints[4].x,
        y: keypoints[4].y,
        radius: 25,
        intensity: 1.0
      });
    }

    // Left cheekbone - moderate highlight
    if (keypoints[234]) {
      areas.push({
        x: keypoints[234].x,
        y: keypoints[234].y,
        radius: 45,
        intensity: 0.85
      });
    }

    // Right cheekbone - moderate highlight
    if (keypoints[454]) {
      areas.push({
        x: keypoints[454].x,
        y: keypoints[454].y,
        radius: 45,
        intensity: 0.85
      });
    }

    // Chin - subtle highlight
    if (keypoints[152]) {
      areas.push({
        x: keypoints[152].x,
        y: keypoints[152].y,
        radius: 35,
        intensity: 0.75
      });
    }

    // Upper lip area (optional, subtle)
    if (keypoints[0]) {
      areas.push({
        x: keypoints[0].x,
        y: keypoints[0].y,
        radius: 20,
        intensity: 0.6
      });
    }

    return areas;
  }

  private getHighlightAreas(landmarks: FaceLandmarks): Array<{ x: number; y: number; radius: number; intensity: number }> {
    // Keep for backward compatibility, but use getTargetAreas instead
    return this.getTargetAreas(landmarks);
  }

  private applyDodgeBurn(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    highlightAreas: Array<{ x: number; y: number; radius: number; intensity: number }>,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number },
    dodge: number,
    burn: number
  ) {
    // Deprecated - kept for compatibility but not used
    // Use applyDodgeBurnAdvanced instead
  }

  private applyClarity(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number },
    clarity: number
  ) {
    const clarityFactor = clarity / 100;

    // Create a copy of the data for edge detection
    const original = new Uint8ClampedArray(data);

    for (let y = Math.floor(faceBounds.yMin) + 1; y < Math.ceil(faceBounds.yMax) - 1; y++) {
      for (let x = Math.floor(faceBounds.xMin) + 1; x < Math.ceil(faceBounds.xMax) - 1; x++) {
        if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) continue;

        const idx = (y * width + x) * 4;

        // Simple unsharp mask / edge detection
        for (let c = 0; c < 3; c++) {
          const center = original[idx + c];
          const top = original[((y - 1) * width + x) * 4 + c];
          const bottom = original[((y + 1) * width + x) * 4 + c];
          const left = original[(y * width + (x - 1)) * 4 + c];
          const right = original[(y * width + (x + 1)) * 4 + c];

          const average = (top + bottom + left + right) / 4;
          const edge = center - average;

          let newValue = center + edge * clarityFactor;
          data[idx + c] = Math.max(0, Math.min(255, newValue));
        }
      }
    }
  }

  private applyContrast(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    faceBounds: { xMin: number; yMin: number; xMax: number; yMax: number; width: number; height: number },
    contrast: number
  ) {
    const contrastFactor = (contrast + 100) / 100;
    const factor = (259 * (contrastFactor * 100 + 255)) / (255 * (259 - contrastFactor * 100));

    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          const value = data[idx + c];
          const newValue = factor * (value - 128) + 128;
          data[idx + c] = Math.max(0, Math.min(255, newValue));
        }
      }
    }
  }

  /**
   * Apply Gemini AI lighting analysis to automatically fix studio lighting
   * This is optimized and won't freeze the browser
   * @param fixCount - Number of times Fix More has been applied (for progressive fixing)
   */
  applyGeminiLightingFix(landmarks: FaceLandmarks, analysis: LightingAnalysis, fixCount: number = 0) {
    if (!this.originalImageData) {
      return;
    }

    // Always apply the fix (removed hasStudioLighting check so it always processes)
    // Reset to original image first
    this.ctx.putImageData(this.originalImageData, 0, 0);

    const width = this.canvas.width;
    const height = this.canvas.height;
    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Create a copy for reading original values
    const originalData = new Uint8ClampedArray(data);

    // Get face bounds
    const faceBounds = landmarks.box;

    // Map hotspot areas to facial landmark positions
    const hotspotZones = this.mapHotspotsToZones(landmarks, analysis.hotspots);

    // Calculate target brightness (median of face area)
    const targetBrightness = this.calculateTargetBrightness(originalData, width, height, faceBounds);

    // Convert Gemini's 0-100 intensity to our internal scale
    // Apply progressive multiplier: each Fix More increases strength by 30%
    const baseIntensity = Math.max(analysis.adjustments.burnIntensity, 50) / 100; // Minimum 50 if detected
    const progressiveMultiplier = 1 + (fixCount * 0.3);
    const burnIntensity = baseIntensity * progressiveMultiplier;

    // Process each pixel in face bounds
    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = originalData[idx];
        const g = originalData[idx + 1];
        const b = originalData[idx + 2];

        // Calculate luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Calculate influence from hotspot zones
        let maxInfluence = 0;
        for (const zone of hotspotZones) {
          const dx = x - zone.x;
          const dy = y - zone.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < zone.radius) {
            const normalizedDist = distance / zone.radius;
            // Smooth falloff using cosine interpolation
            const cosineWeight = (Math.cos(normalizedDist * Math.PI) + 1) / 2;
            const influence = cosineWeight * zone.severity;
            maxInfluence = Math.max(maxInfluence, influence);
          }
        }

        // Only apply burn to pixels that are brighter than target
        const brightnessDiff = luminance - targetBrightness;
        if (brightnessDiff > 5 && maxInfluence > 0) {
          // Calculate how much to reduce brightness
          const reductionAmount = brightnessDiff * burnIntensity * maxInfluence;
          const targetLum = Math.max(targetBrightness, luminance - reductionAmount);

          // Calculate ratio to preserve color relationships
          const ratio = targetLum / Math.max(luminance, 1);

          // Apply to all channels
          data[idx] = Math.max(0, Math.min(255, r * ratio));
          data[idx + 1] = Math.max(0, Math.min(255, g * ratio));
          data[idx + 2] = Math.max(0, Math.min(255, b * ratio));
        }
      }
    }

    // Put modified image data back
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Map Gemini's hotspot area names to facial landmark zones
   */
  private mapHotspotsToZones(
    landmarks: FaceLandmarks,
    hotspots: Array<{ area: string; severity: number }>
  ): Array<{ x: number; y: number; radius: number; severity: number }> {
    const zones: Array<{ x: number; y: number; radius: number; severity: number }> = [];
    const keypoints = landmarks.keypoints;
    const faceBounds = landmarks.box;
    const faceWidth = faceBounds.width;
    const faceHeight = faceBounds.height;

    for (const hotspot of hotspots) {
      let zone: { x: number; y: number; radius: number; severity: number } | null = null;

      // Normalize severity to 0-1 range
      const severity = hotspot.severity / 100;

      switch (hotspot.area) {
        case 'forehead': {
          // Forehead is top-center of face
          const foreheadTop = keypoints.slice(10, 67); // Forehead region landmarks
          if (foreheadTop.length > 0) {
            const avgX = foreheadTop.reduce((sum, kp) => sum + kp.x, 0) / foreheadTop.length;
            const avgY = foreheadTop.reduce((sum, kp) => sum + kp.y, 0) / foreheadTop.length;
            zone = { x: avgX, y: avgY, radius: faceWidth * 0.25, severity };
          }
          break;
        }

        case 'nose': {
          // Nose bridge and tip
          const nose = keypoints.slice(1, 9); // Nose landmarks
          if (nose.length > 0) {
            const avgX = nose.reduce((sum, kp) => sum + kp.x, 0) / nose.length;
            const avgY = nose.reduce((sum, kp) => sum + kp.y, 0) / nose.length;
            zone = { x: avgX, y: avgY, radius: faceWidth * 0.15, severity };
          }
          break;
        }

        case 'left_cheek': {
          // Left cheekbone area
          const leftCheek = keypoints.slice(50, 100); // Approximate left cheek
          if (leftCheek.length > 0) {
            const avgX = leftCheek.reduce((sum, kp) => sum + kp.x, 0) / leftCheek.length;
            const avgY = leftCheek.reduce((sum, kp) => sum + kp.y, 0) / leftCheek.length;
            zone = { x: avgX, y: avgY, radius: faceWidth * 0.2, severity };
          }
          break;
        }

        case 'right_cheek': {
          // Right cheekbone area
          const rightCheek = keypoints.slice(280, 330); // Approximate right cheek
          if (rightCheek.length > 0) {
            const avgX = rightCheek.reduce((sum, kp) => sum + kp.x, 0) / rightCheek.length;
            const avgY = rightCheek.reduce((sum, kp) => sum + kp.y, 0) / rightCheek.length;
            zone = { x: avgX, y: avgY, radius: faceWidth * 0.2, severity };
          }
          break;
        }

        case 'chin': {
          // Chin area
          const chin = keypoints.slice(152, 200); // Chin landmarks
          if (chin.length > 0) {
            const avgX = chin.reduce((sum, kp) => sum + kp.x, 0) / chin.length;
            const avgY = chin.reduce((sum, kp) => sum + kp.y, 0) / chin.length;
            zone = { x: avgX, y: avgY, radius: faceWidth * 0.18, severity };
          }
          break;
        }

        case 'overall': {
          // Overall face - use face center
          const centerX = faceBounds.xMin + faceWidth / 2;
          const centerY = faceBounds.yMin + faceHeight / 2;
          zone = { x: centerX, y: centerY, radius: faceWidth * 0.35, severity };
          break;
        }
      }

      if (zone) {
        zones.push(zone);
      }
    }

    return zones;
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
