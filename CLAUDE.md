# CLAUDE.md - Face Lifting Editor

**AI Assistant Guide for Face Lifting Editor Development**

## Project Overview

Face Lifting Editor is an AI-powered portrait editing application built with Next.js 15, React 18, TensorFlow.js, and MediaPipe Face Mesh. The application allows users to adjust facial features and optimize portrait lighting using advanced AI and computer vision techniques.

**Primary Purpose**: Portrait photo editing with facial feature manipulation and AI-assisted lighting optimization

**Tech Stack**:
- Frontend: Next.js 15 (App Router), React 18, TypeScript
- Styling: Tailwind CSS
- AI/ML: TensorFlow.js, MediaPipe Face Landmarks Detection
- AI Services: Google Gemini 2.5 Pro for lighting analysis

## Repository Structure

```
faceLifting/
├── app/                        # Next.js App Router
│   ├── globals.css            # Global styles and Tailwind imports
│   ├── layout.tsx             # Root layout with metadata
│   └── page.tsx               # Main application page (primary UI)
├── components/                 # React components
│   └── ControlPanel.tsx       # Face adjustment sliders and controls
├── lib/                       # Core business logic
│   ├── faceDetection.ts       # MediaPipe face detection service
│   ├── faceManipulation.ts    # Face warping and lighting algorithms
│   └── geminiService.ts       # Gemini AI lighting analysis
├── public/                    # Static assets
├── next.config.js             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

### Key Files and Their Responsibilities

#### `app/page.tsx` (Main Application Logic)
- **Location**: `/app/page.tsx`
- **Purpose**: Primary UI component and application orchestrator
- **Key Features**:
  - Image upload and canvas management
  - Face detection initialization and lifecycle
  - Adjustment state management
  - Automatic AI lighting analysis and fixing
  - User controls (Save, Reset, New Image, Fix More)
- **Important State**:
  - `image`: Currently loaded image
  - `landmarks`: Face mesh landmarks (468 points)
  - `adjustments`: All facial and lighting adjustment values
  - `lightingAnalysis`: Gemini AI analysis results
  - `fixCount`: Progressive lighting fix counter

#### `lib/faceDetection.ts` (Face Detection Service)
- **Location**: `/lib/faceDetection.ts`
- **Purpose**: Singleton service for MediaPipe Face Mesh detection
- **Key Methods**:
  - `initialize()`: Load TensorFlow.js and MediaPipe models
  - `detectFaces()`: Detect faces in an image (returns 468 landmarks)
  - `isReady()`: Check if model is loaded
  - `dispose()`: Clean up resources
- **Configuration**: Uses MediaPipe runtime with refined landmarks, max 1 face
- **CDN**: Models loaded from `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh`

#### `lib/faceManipulation.ts` (Face Manipulation Engine)
- **Location**: `/lib/faceManipulation.ts`
- **Purpose**: Canvas-based face warping and lighting manipulation
- **Key Algorithms**:
  1. **Mesh Warping**: Displacement mapping for facial feature adjustments
  2. **Dodge & Burn**: Professional lighting techniques for portrait enhancement
  3. **AI Lighting Fix**: Gemini-guided lighting corrections
- **Adjustment Types**:
  - **Geometric**: slimFace, headSize, jawline, chin, forehead, cheekbones, faceWidth
  - **Lighting**: dodge, burn, clarity, contrast
- **Key Methods**:
  - `setOriginalImage()`: Initialize canvas with image (auto-scales to max 1920x1080)
  - `applyAdjustments()`: Apply all geometric and lighting adjustments
  - `applyGeminiLightingFix()`: Progressive AI-guided lighting correction
  - `reset()`: Restore original image

#### `lib/geminiService.ts` (AI Lighting Analysis)
- **Location**: `/lib/geminiService.ts`
- **Purpose**: Gemini 2.5 Pro vision API integration for lighting analysis
- **API Key**: Hardcoded in file (line 6)
- **Key Features**:
  - Analyzes portrait lighting for studio vs. natural characteristics
  - Identifies brightness hotspots on facial features
  - Recommends burn/dodge intensities (0-100)
- **Response Format**: JSON with `hasStudioLighting`, `brightnessAnalysis`, `adjustments`, `hotspots`
- **Important**: Low temperature (0.1) for consistent results

#### `components/ControlPanel.tsx` (UI Controls)
- **Location**: `/components/ControlPanel.tsx`
- **Purpose**: Slider interface for all facial adjustments
- **Features**:
  - Bilingual labels (English + Thai)
  - Emoji icons for each adjustment
  - Range validation
  - Sectioned layout (Face Shape vs. Effects)
  - Real-time value display

## Development Workflow

### Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   - Server runs on `http://localhost:3000`
   - Hot reload enabled

3. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

4. **Lint Code**:
   ```bash
   npm run lint
   ```

### Git Workflow (Recent Pattern)

Based on recent commits, this project follows an iterative development pattern:

1. **Feature Development**: Implement features incrementally
2. **Algorithm Refinement**: Continuously improve AI algorithms
3. **Commit Pattern**: Clear, descriptive messages with functional scope
   - Example: "Implement fully automatic AI lighting adjustment with progressive fixing"
   - Example: "Add intelligent brightness detection for adaptive Burn tool"

**Recent Focus Areas** (from git history):
- AI lighting adjustment automation
- Gemini API integration for lighting analysis
- Advanced dodge & burn algorithms
- Progressive fixing system
- Jawline adjustment range expansion

### Branching Strategy

- **Development Branch**: `claude/claude-md-mi26esizxnayrddh-01AqNexiMo2LTZ5JeZrgVq6J`
- Always develop on feature branches starting with `claude/`
- Push with `git push -u origin <branch-name>`

## Key Conventions and Best Practices

### Code Style

1. **TypeScript**: Strict typing throughout
   - Use interfaces for all props and data structures
   - Avoid `any` type
   - Prefer explicit return types for functions

2. **React Patterns**:
   - Functional components with hooks
   - Use `'use client'` directive for client-side components
   - `useCallback` for event handlers to prevent re-renders
   - `useRef` for DOM elements and mutable values
   - `useEffect` for initialization and lifecycle management

3. **Canvas Operations**:
   - Always get context with `{ willReadFrequently: true }` for performance
   - Store original ImageData before any manipulation
   - Reset to original before applying new adjustments

4. **State Management**:
   - Local state with useState (no external state library)
   - Lift state to parent when needed
   - Immutable state updates (spread operators)

### Algorithm Development Patterns

#### Face Manipulation Workflow
```typescript
// 1. Reset canvas to original
this.ctx.putImageData(this.originalImageData, 0, 0);

// 2. Create displacement map
const displacementMap = this.createDisplacementMap(landmarks, adjustments, faceCenter, faceBounds);

// 3. Apply mesh warping
this.applyMeshWarping(displacementMap);

// 4. Apply lighting adjustments
this.applyLightingAdjustments(landmarks, adjustments, faceCenter, faceBounds);
```

#### AI Integration Pattern
```typescript
// 1. Capture current canvas state
const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

// 2. Call AI analysis
const analysis = await analyzeLighting(imageDataUrl);

// 3. Apply AI-guided adjustments
manipulator.applyGeminiLightingFix(landmarks, analysis, fixCount);
```

### Important Technical Details

#### MediaPipe Landmark Indices
- **Total Landmarks**: 468 points
- **Key Indices** (approximate):
  - Nose tip: 1
  - Chin: 152
  - Left cheek: 234
  - Right cheek: 454
  - Forehead: 10
  - Left jaw: 172-175
  - Right jaw: 397-400

#### Performance Optimizations
1. **Image Scaling**: Auto-scale to max 1920x1080 to prevent performance issues
2. **WebGL Backend**: TensorFlow.js uses WebGL for GPU acceleration
3. **Canvas Context**: `willReadFrequently: true` flag for pixel manipulation
4. **Debouncing**: Consider adding debounce for slider changes if performance issues arise

#### Coordinate System
- Landmarks are scaled from original image coordinates to canvas coordinates
- Formula: `scaledX = originalX * (canvasWidth / imageWidth)`
- Always scale landmarks after canvas initialization

### Error Handling

1. **Model Loading**: Handle async initialization failures
   ```typescript
   try {
     await faceDetectionService.initialize();
   } catch (err) {
     setError('Failed to load face detection model');
   }
   ```

2. **Face Detection**: Validate face detection results
   ```typescript
   if (faces.length === 0) {
     setError('No face detected');
     return;
   }
   ```

3. **API Failures**: Graceful degradation for Gemini API
   ```typescript
   try {
     const analysis = await analyzeLighting(imageSrc);
   } catch (err) {
     console.error('AI analysis failed:', err);
     // Continue without AI suggestions
   }
   ```

### UI/UX Conventions

1. **Loading States**: Always show loading indicators for async operations
   - Model loading: Blue info banner
   - Processing: Spinner on buttons
   - AI analysis: "Applying..." state

2. **Error Display**: Red banner with emoji prefix
   ```tsx
   <div className="bg-red-100 border border-red-400">
     ⚠️ {error}
   </div>
   ```

3. **Bilingual Support**: English + Thai
   - Labels show Thai first, English in parentheses
   - User messages primarily in Thai

4. **Dark Mode**: Full dark mode support using Tailwind's `dark:` variants

## AI Feature Development Guidelines

### When Adding New AI Features

1. **Lighting Analysis Enhancements**:
   - Modify the Gemini prompt in `lib/geminiService.ts`
   - Adjust response parsing and validation
   - Update `LightingAnalysis` interface
   - Test with various portrait types

2. **New Adjustment Types**:
   - Add to `FaceAdjustments` interface in `lib/faceManipulation.ts`
   - Implement displacement calculation in `createDisplacementMap()`
   - Add slider to `ControlPanel.tsx` sliderConfigs
   - Update initial state in `app/page.tsx`

3. **Algorithm Refinement**:
   - Use progressive fixing pattern (see `fixCount` state)
   - Allow multiple iterations for gradual improvement
   - Test with studio-lit and naturally-lit portraits
   - Validate on different skin tones and lighting conditions

### Testing AI Features

1. **Test Images**:
   - Studio-lit portraits (directional lighting, hotspots)
   - Natural/flat-lit portraits (phone camera, soft lighting)
   - Various skin tones
   - Different face angles (though app targets frontal)

2. **Validation Criteria**:
   - Natural appearance after adjustment
   - No artifacting or distortion
   - Consistent results across similar inputs
   - Performance < 2s per operation

## Common Tasks for AI Assistants

### Adding a New Facial Feature Adjustment

1. Add field to `FaceAdjustments` interface (lib/faceManipulation.ts)
2. Add displacement logic in `createDisplacementMap()` method
3. Add slider config to `ControlPanel.tsx`
4. Update initial state in `app/page.tsx` (two places: initial state + reset function)
5. Test with various adjustment values

### Modifying AI Lighting Analysis

1. Update prompt in `lib/geminiService.ts` `analyzeLighting()` function
2. Modify `LightingAnalysis` interface if response format changes
3. Update parsing/validation logic
4. Adjust `applyGeminiLightingFix()` method in `lib/faceManipulation.ts`
5. Test with diverse portrait types

### Performance Optimization

1. **Identify bottleneck**: Use browser DevTools Performance tab
2. **Common issues**:
   - Large images: Reduce max dimensions in `setOriginalImage()`
   - Slow sliders: Add debouncing to `handleAdjustmentChange()`
   - Model loading: Consider lazy loading or preloading
3. **Always measure**: Benchmark before and after changes

### Adding New Dependencies

1. Install: `npm install <package>`
2. Update types if needed: `npm install --save-dev @types/<package>`
3. Import in relevant file
4. Document usage in this file if it's a major dependency

## API Keys and Configuration

### Gemini API
- **Current Key Location**: Hardcoded in `lib/geminiService.ts` (line 6)
- **Model**: gemini-2.5-pro
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent`

**Security Note**: For production, move API key to environment variables:
1. Create `.env.local` file
2. Add: `NEXT_PUBLIC_GEMINI_API_KEY=your_key_here`
3. Update code: `const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;`

### TensorFlow.js
- **Backend**: WebGL (GPU-accelerated)
- **CDN**: Models loaded from jsdelivr CDN
- **Configuration**: Set in `faceDetection.ts` initialization

## Troubleshooting Guide

### Common Issues

1. **"No face detected"**
   - **Cause**: Poor image quality, non-frontal face, multiple faces
   - **Solution**: Validate input images, adjust MediaPipe confidence threshold

2. **Canvas not displaying**
   - **Cause**: Async timing issues between image load and canvas setup
   - **Solution**: Use setTimeout pattern (see lines 114-164 in app/page.tsx)

3. **Performance degradation**
   - **Cause**: Large images, frequent re-renders
   - **Solution**: Check image scaling, add useCallback/useMemo, debounce sliders

4. **Gemini API errors**
   - **Cause**: API quota, network issues, invalid response format
   - **Solution**: Check API key, validate quota, improve error handling

5. **WebGL context loss**
   - **Cause**: GPU memory exhaustion
   - **Solution**: Dispose TensorFlow.js resources properly, reduce canvas size

## Future Enhancement Ideas

Based on current architecture, consider:

1. **Multi-face support**: Extend to handle multiple faces in group photos
2. **Real-time video**: Apply effects to webcam stream
3. **Preset profiles**: Save/load adjustment presets
4. **Before/After comparison**: Split-screen or slider view
5. **Batch processing**: Upload and process multiple images
6. **Advanced AI features**: Age progression, makeup simulation, hairstyle try-on
7. **Export formats**: Support JPEG/PNG quality settings, EXIF preservation
8. **Undo/Redo**: History stack for adjustments
9. **Mobile optimization**: Touch gestures, responsive canvas
10. **Server-side processing**: Offload heavy computation for better performance

## Contact and Resources

- **Documentation**:
  - [TensorFlow.js](https://www.tensorflow.org/js)
  - [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh.html)
  - [Next.js](https://nextjs.org/docs)
  - [Gemini API](https://ai.google.dev/docs)

- **Project README**: See `README.md` for user-facing documentation

## AI Assistant Reminders

1. **Always test changes**: Run development server and test with real images
2. **Preserve bilingual support**: Maintain English + Thai labels
3. **Follow TypeScript conventions**: Strict typing, no `any`
4. **Respect canvas lifecycle**: Reset → Modify → Apply pattern
5. **Handle errors gracefully**: User-friendly messages, no crashes
6. **Document AI prompts**: Gemini prompts are critical - document changes
7. **Performance matters**: This is image processing - optimize aggressively
8. **Git commits**: Clear, functional descriptions (follow recent pattern)

---

**Last Updated**: 2025-11-16
**Version**: 0.1.0
**Next.js**: 15.0.3
**React**: 18.3.1
**TensorFlow.js**: 4.22.0
