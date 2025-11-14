# ✨ Face Lifting Editor

AI-Powered Portrait Editor built with Next.js, TensorFlow.js, and MediaPipe Face Mesh.

แอปพลิเคชันแก้ไขภาพ Portrait ด้วย AI ที่สามารถปรับแต่งใบหน้าในภาพได้อย่างละเอียด

## 🌟 Features (คุณสมบัติ)

- **หน้าเรียว (Slim Face)**: ปรับความกว้างของใบหน้าโดยรวมให้ดูเพรียวลง
- **ขนาดศีรษะ (Head Size)**: ย่อหรือขยายขนาดของศีรษะทั้งหมด
- **กราม (Jawline)**: ปรับแนวกรามให้คมชัดขึ้น หรือลดความเหลี่ยมของกราม
- **คาง (Chin)**: ปรับความยาวหรือความแหลมของคาง
- **หน้าผาก (Forehead)**: ปรับความกว้างหรือความสูงของหน้าผาก
- **โหนกแก้ม (Cheekbones)**: ลดขนาดโหนกแก้มให้ใบหน้าดูนุ่มนวลขึ้น
- **ความกว้างใบหน้า (Face Width)**: ปรับความกว้างของใบหน้าช่วงกลาง

## 🚀 Tech Stack

- **Frontend Framework**: Next.js 15 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **AI/ML**:
  - TensorFlow.js
  - MediaPipe Face Landmarks Detection
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js 18+
- npm or yarn

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd faceLifting
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Build

```bash
npm run build
npm start
```

## 🎯 How to Use

1. **Upload Image**: Click "Choose Image" button to upload a portrait photo
2. **Wait for Processing**: The AI model will detect face landmarks automatically
3. **Adjust Features**: Use the sliders in the Control Panel to adjust different facial features
4. **Save Result**: Click "Save" button to download the edited image
5. **Load New Image**: Click "New Image" to start with a different photo

## 🎨 Features Explanation

### Slim Face (หน้าเรียว)
Adjusts the overall width of the face to make it appear slimmer or wider.

### Head Size (ขนาดศีรษะ)
Scales the entire head size - useful when your head appears larger than others in group photos.

### Jawline (กราม)
Sharpens or softens the jawline for a more defined or gentle appearance.

### Chin (คาง)
Adjusts the length and pointiness of the chin.

### Forehead (หน้าผาก)
Modifies the width and height of the forehead area.

### Cheekbones (โหนกแก้ม)
Reduces or emphasizes cheekbone prominence for a softer or more sculpted look.

### Face Width (ความกว้างใบหน้า)
Adjusts the horizontal width of the middle face area.

## 🔧 Technical Details

### Face Detection
- Uses MediaPipe Face Mesh model with 468 facial landmarks
- Detects faces in real-time with high accuracy
- Supports single face detection

### Face Manipulation
- Implements mesh warping algorithm for realistic face deformation
- Uses bilinear interpolation for smooth pixel transitions
- Applies displacement mapping based on facial landmarks
- Real-time preview of adjustments

### Performance
- TensorFlow.js with WebGL backend for GPU acceleration
- Optimized canvas rendering
- Efficient pixel manipulation algorithms

## 📁 Project Structure

```
faceLifting/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main page component
├── components/
│   └── ControlPanel.tsx      # Control panel with sliders
├── lib/
│   ├── faceDetection.ts      # Face detection service
│   └── faceManipulation.ts   # Face manipulation engine
├── public/                   # Static assets
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies
```

## 🎓 Learning Resources

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh.html)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

## ⚠️ Notes

- Best results with clear, front-facing portrait photos
- Processing time may vary depending on image size and device performance
- Requires modern browser with WebGL support
- Model loading may take a few seconds on first use

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- TensorFlow.js team for the amazing ML framework
- MediaPipe team for the Face Mesh model
- Next.js team for the excellent framework
- Tailwind CSS for the utility-first CSS framework

---

Built with ❤️ using Next.js, TensorFlow.js, and MediaPipe
