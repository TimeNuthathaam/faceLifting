'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { faceDetectionService, FaceLandmarks } from '@/lib/faceDetection';
import { FaceManipulator, FaceAdjustments } from '@/lib/faceManipulation';
import { analyzeLighting, LightingAnalysis, getAnalysisDescription } from '@/lib/geminiService';
import ControlPanel from '@/components/ControlPanel';

export default function Home() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [landmarks, setLandmarks] = useState<FaceLandmarks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightingAnalysis, setLightingAnalysis] = useState<LightingAnalysis | null>(null);
  const [isAnalyzingLighting, setIsAnalyzingLighting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manipulatorRef = useRef<FaceManipulator | null>(null);

  const [adjustments, setAdjustments] = useState<FaceAdjustments>({
    slimFace: 0,
    headSize: 0,
    jawline: 0,
    chin: 0,
    forehead: 0,
    cheekbones: 0,
    faceWidth: 0,
    // Lighting adjustments
    dodge: 0,
    burn: 0,
    clarity: 0,
    contrast: 0,
  });

  // Initialize face detection model
  useEffect(() => {
    const initModel = async () => {
      setIsModelLoading(true);
      setError(null);
      try {
        await faceDetectionService.initialize();
        setModelLoaded(true);
        console.log('Model loaded successfully');
      } catch (err) {
        setError('Failed to load face detection model. Please refresh the page.');
        console.error('Model loading error:', err);
      } finally {
        setIsModelLoading(false);
      }
    };

    initModel();

    return () => {
      faceDetectionService.dispose();
    };
  }, []);

  // Initialize/re-initialize canvas manipulator when image changes
  useEffect(() => {
    if (image && canvasRef.current) {
      // Create new manipulator for the canvas
      manipulatorRef.current = new FaceManipulator(canvasRef.current);

      // Set the original image
      manipulatorRef.current.setOriginalImage(image);

      console.log('Canvas initialized with image');
    }
  }, [image]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = URL.createObjectURL(file);

      img.onload = async () => {
        // Detect faces first from original image
        if (!faceDetectionService.isReady()) {
          setError('Model not ready. Please wait...');
          setIsProcessing(false);
          return;
        }

        const faces = await faceDetectionService.detectFaces(img);

        if (faces.length === 0) {
          setError('No face detected in the image. Please upload a portrait photo.');
          setIsProcessing(false);
          return;
        }

        if (faces.length > 1) {
          console.warn('Multiple faces detected. Using the first face.');
        }

        const detectedLandmarks = faces[0];

        // Set image state (will trigger useEffect to setup canvas)
        setImage(img);

        // Wait for canvas to be ready, then scale landmarks
        setTimeout(() => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const scaleX = canvas.width / img.width;
            const scaleY = canvas.height / img.height;

            console.log(`Scaling landmarks: ${scaleX.toFixed(3)}x, ${scaleY.toFixed(3)}x`);

            // Scale landmarks to match canvas size
            const scaledLandmarks: FaceLandmarks = {
              keypoints: detectedLandmarks.keypoints.map((kp) => ({
                ...kp,
                x: kp.x * scaleX,
                y: kp.y * scaleY,
                z: kp.z ? kp.z * scaleX : undefined,
              })),
              box: {
                xMin: detectedLandmarks.box.xMin * scaleX,
                yMin: detectedLandmarks.box.yMin * scaleY,
                xMax: detectedLandmarks.box.xMax * scaleX,
                yMax: detectedLandmarks.box.yMax * scaleY,
                width: detectedLandmarks.box.width * scaleX,
                height: detectedLandmarks.box.height * scaleY,
              },
            };

            setLandmarks(scaledLandmarks);
          }
          setIsProcessing(false);
        }, 100);
      };

      img.onerror = () => {
        setError('Failed to load image. Please try another file.');
        setIsProcessing(false);
      };
    } catch (err) {
      setError('Error processing image: ' + (err as Error).message);
      setIsProcessing(false);
    }
  };

  const handleAdjustmentChange = useCallback(
    (key: keyof FaceAdjustments, value: number) => {
      const newAdjustments = { ...adjustments, [key]: value };
      setAdjustments(newAdjustments);

      if (manipulatorRef.current && landmarks) {
        manipulatorRef.current.applyAdjustments(landmarks, newAdjustments);
      }
    },
    [adjustments, landmarks]
  );

  const handleReset = useCallback(() => {
    const resetAdjustments: FaceAdjustments = {
      slimFace: 0,
      headSize: 0,
      jawline: 0,
      chin: 0,
      forehead: 0,
      cheekbones: 0,
      faceWidth: 0,
      dodge: 0,
      burn: 0,
      clarity: 0,
      contrast: 0,
    };
    setAdjustments(resetAdjustments);

    if (manipulatorRef.current) {
      manipulatorRef.current.reset();
    }
  }, []);

  const handleSave = () => {
    if (!canvasRef.current) return;

    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        setError('Failed to save image');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `face-edited-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  const handleNewImage = () => {
    setImage(null);
    setLandmarks(null);
    setError(null);
    setLightingAnalysis(null);
    handleReset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAutoFixLighting = async () => {
    if (!canvasRef.current || !image || !landmarks || !manipulatorRef.current) {
      return;
    }

    setIsAnalyzingLighting(true);
    setError(null);

    try {
      // Get current canvas as data URL
      const imageDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);

      // Analyze lighting with Gemini AI
      const analysis = await analyzeLighting(imageDataUrl);
      setLightingAnalysis(analysis);

      console.log('Gemini Analysis:', analysis);

      // Apply Gemini's lighting fix
      manipulatorRef.current.applyGeminiLightingFix(landmarks, analysis);

      // Show success message with analysis description
      const description = getAnalysisDescription(analysis);
      console.log('Applied:', description);
    } catch (err) {
      console.error('Auto fix lighting error:', err);
      setError('Failed to analyze lighting. Please try again.');
    } finally {
      setIsAnalyzingLighting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-3">
            ✨ Face Lifting Editor
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            AI-Powered Portrait Editor with TensorFlow.js
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            แก้ไขและปรับแต่งภาพ Portrait ด้วย AI
          </p>
        </div>

        {/* Model Loading Status */}
        {isModelLoading && (
          <div className="bg-blue-100 dark:bg-blue-900 border border-blue-400 text-blue-700 dark:text-blue-200 px-4 py-3 rounded-lg mb-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 dark:border-blue-200"></div>
              <span>Loading AI model... Please wait.</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Upload Section */}
        {!image && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6">
            <div className="text-center">
              <div className="mb-6">
                <div className="text-6xl mb-4">📸</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Upload Your Portrait
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a portrait photo to start editing
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={!modelLoaded || isProcessing}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`inline-block px-8 py-4 text-lg font-medium text-white rounded-lg cursor-pointer transition-all duration-200 ${
                  !modelLoaded || isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-105'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : (
                  '📁 Choose Image'
                )}
              </label>

              <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                <p>💡 Tips:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Use a clear portrait photo with visible face</li>
                  <li>Best results with front-facing photos</li>
                  <li>Supported formats: JPG, PNG, WebP</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Editor Section */}
        {image && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Canvas Display */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Preview
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleAutoFixLighting}
                      disabled={isAnalyzingLighting || !landmarks}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm font-medium flex items-center gap-2"
                    >
                      {isAnalyzingLighting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>🤖 Auto Fix Lighting</>
                      )}
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium flex items-center gap-2"
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={handleNewImage}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium flex items-center gap-2"
                    >
                      🖼️ New Image
                    </button>
                  </div>
                </div>

                <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden min-h-[400px] flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto mx-auto block"
                    style={{ maxHeight: '70vh', display: 'block' }}
                  />
                </div>

                {landmarks && (
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                    ✅ Face detected with {landmarks.keypoints.length} landmarks
                  </div>
                )}

                {lightingAnalysis && (
                  <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-1">
                      🤖 AI Lighting Analysis
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      {getAnalysisDescription(lightingAnalysis)}
                    </div>
                    {lightingAnalysis.brightnessAnalysis && (
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        {lightingAnalysis.brightnessAnalysis}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Control Panel */}
            <div className="lg:col-span-1">
              <ControlPanel
                adjustments={adjustments}
                onAdjustmentChange={handleAdjustmentChange}
                onReset={handleReset}
                disabled={!landmarks}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Powered by{' '}
            <span className="font-semibold">TensorFlow.js</span> and{' '}
            <span className="font-semibold">MediaPipe Face Mesh</span>
          </p>
          <p className="mt-1">
            Built with Next.js, React, and Tailwind CSS
          </p>
        </div>
      </div>
    </main>
  );
}
