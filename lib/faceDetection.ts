import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export interface FaceLandmarks {
  keypoints: Array<{
    x: number;
    y: number;
    z?: number;
    name?: string;
  }>;
  box: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
    width: number;
    height: number;
  };
}

class FaceDetectionService {
  private detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized && this.detector) {
      return;
    }

    try {
      // Set TensorFlow.js backend
      await tf.setBackend('webgl');
      await tf.ready();

      // Create detector with MediaPipe FaceMesh
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshMediaPipeModelConfig = {
        runtime: 'mediapipe',
        maxFaces: 1,
        refineLandmarks: true,
        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
      };

      this.detector = await faceLandmarksDetection.createDetector(model, detectorConfig);
      this.isInitialized = true;
      console.log('Face detection model loaded successfully');
    } catch (error) {
      console.error('Error initializing face detection:', error);
      throw error;
    }
  }

  async detectFaces(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<FaceLandmarks[]> {
    if (!this.detector) {
      throw new Error('Detector not initialized. Call initialize() first.');
    }

    try {
      const faces = await this.detector.estimateFaces(imageElement, {
        flipHorizontal: false,
      });

      return faces.map((face) => ({
        keypoints: face.keypoints.map((kp) => ({
          x: kp.x,
          y: kp.y,
          z: kp.z,
          name: kp.name,
        })),
        box: face.box,
      }));
    } catch (error) {
      console.error('Error detecting faces:', error);
      return [];
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.detector !== null;
  }

  async dispose() {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
      this.isInitialized = false;
    }
  }
}

export const faceDetectionService = new FaceDetectionService();
