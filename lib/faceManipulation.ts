import { FaceLandmarks } from './faceDetection';

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
    // Step 1: Analyze the actual image to find bright areas (highlights)
    const brightnessMap = this.analyzeBrightness(data, width, height, faceBounds);

    // Step 2: Get landmark-based target areas for reference
    const targetAreas = this.getTargetAreas(landmarks);

    for (let y = Math.floor(faceBounds.yMin); y < Math.ceil(faceBounds.yMax); y++) {
      for (let x = Math.floor(faceBounds.xMin); x < Math.ceil(faceBounds.xMax); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Calculate luminance (perceived brightness)
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Get brightness level from analysis (0 to 1, where 1 = brightest)
        const brightnessLevel = brightnessMap[idx / 4] || 0;

        // Calculate landmark-based influence
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

        // Combine brightness-based and landmark-based detection
        // Brightness-based is primary for BURN (to target actual highlights)
        // Landmark-based is primary for DODGE (for artistic control)
        const burnInfluence = Math.max(brightnessLevel * 0.8, landmarkInfluence * 0.4);
        const dodgeInfluence = Math.max(landmarkInfluence * 0.7, brightnessLevel * 0.3);

        // Apply Burn (darken bright areas to remove studio lighting)
        if (burn > 0 && burnInfluence > 0.1) {
          const burnIntensity = (burn / 100) * burnInfluence;

          // Strong effect on very bright pixels (highlights from studio lighting)
          let targetWeight = 0;
          if (luminance > 200) {
            targetWeight = 1.0; // Maximum effect on very bright areas
          } else if (luminance > 170) {
            targetWeight = 0.9; // Strong effect on bright highlights
          } else if (luminance > 140) {
            targetWeight = 0.6; // Moderate effect on upper midtones
          } else if (luminance > 100) {
            targetWeight = 0.3; // Gentle effect on midtones
          }

          if (targetWeight > 0) {
            // Multiply blending mode with adaptive intensity
            const finalIntensity = burnIntensity * targetWeight;
            const multiplier = 1 - (finalIntensity * 0.7); // Increased from 0.6 for stronger effect

            data[idx] = Math.max(0, Math.round(r * multiplier));
            data[idx + 1] = Math.max(0, Math.round(g * multiplier));
            data[idx + 2] = Math.max(0, Math.round(b * multiplier));
          }
        }

        // Apply Dodge (lighten for artistic enhancement)
        if (dodge > 0 && dodgeInfluence > 0.1) {
          const dodgeIntensity = (dodge / 100) * dodgeInfluence;

          // Best on upper midtones, avoid overexposed areas
          let targetWeight = 0;
          if (luminance > 200) {
            targetWeight = 0.3; // Minimal on very bright (already bright)
          } else if (luminance > 140) {
            targetWeight = 0.7; // Moderate on highlights
          } else if (luminance > 100) {
            targetWeight = 1.0; // Maximum on upper midtones
          } else if (luminance > 70) {
            targetWeight = 0.8; // Good on midtones
          }

          if (targetWeight > 0) {
            const finalIntensity = dodgeIntensity * targetWeight;

            // Screen blending mode
            const invR = 255 - r;
            const invG = 255 - g;
            const invB = 255 - b;

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

  reset() {
    if (this.originalImageData) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
