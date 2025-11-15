/**
 * Gemini AI Service for Lighting Analysis
 * Uses Gemini 2.5 Pro to analyze portrait lighting and provide adjustment recommendations
 */

const GEMINI_API_KEY = 'AIzaSyB2kw3-n6mbq7RRbkt_sUg6lO84xqyMSOM';
const MODEL_ID = 'gemini-2.5-pro';
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;

export interface LightingAnalysis {
  hasStudioLighting: boolean;
  brightnessAnalysis: string;
  adjustments: {
    burnIntensity: number; // 0-100
    dodgeIntensity: number; // 0-100
  };
  hotspots: Array<{
    area: 'forehead' | 'nose' | 'left_cheek' | 'right_cheek' | 'chin' | 'overall';
    severity: number; // 0-100
  }>;
}

/**
 * Convert image to base64 format required by Gemini
 */
async function imageToBase64(imageSrc: string): Promise<string> {
  // If already base64, extract the data part
  if (imageSrc.startsWith('data:')) {
    return imageSrc.split(',')[1];
  }

  // Otherwise fetch and convert
  const response = await fetch(imageSrc);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Analyze portrait lighting using Gemini 2.5 Pro Vision
 */
export async function analyzeLighting(imageSrc: string): Promise<LightingAnalysis> {
  try {
    // Convert image to base64
    const base64Image = await imageToBase64(imageSrc);

    // Construct the prompt - designed for consistent JSON output
    const prompt = `Analyze this portrait photo for lighting quality. Identify if it has professional studio lighting that creates uneven brightness (hot spots, highlights on forehead/nose/cheeks).

Your task: Determine how to convert this from studio-lit to natural flat lighting (like a casual non-professional photo taken with phone or basic camera).

Respond ONLY with valid JSON in this EXACT format (no markdown, no extra text):
{
  "hasStudioLighting": true,
  "brightnessAnalysis": "brief 1-sentence description",
  "adjustments": {
    "burnIntensity": 0,
    "dodgeIntensity": 0
  },
  "hotspots": [
    {
      "area": "forehead",
      "severity": 0
    }
  ]
}

Rules:
1. hasStudioLighting: true if you see directional lighting, highlights, or uneven brightness
2. burnIntensity: 0-100, how much to darken bright areas (higher = more studio lighting detected)
3. dodgeIntensity: 0-100, usually 0 unless shadows need lifting
4. hotspots: List specific facial areas that are too bright, severity 0-100
5. If lighting is already flat/natural, set burnIntensity to 0

Focus on identifying areas that are too bright due to studio lighting and need to be darkened (burned) to achieve flat, even, natural lighting like a non-professional photo.`;

    // Prepare request body
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent results
        topP: 0.8,
        topK: 20,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json' // Request JSON response
      }
    };

    // Call Gemini API
    const response = await fetch(`${API_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the generated content
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    // Parse JSON response
    let analysis: LightingAnalysis;
    try {
      // Remove markdown code blocks if present
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', generatedText);
      throw new Error('Invalid JSON response from Gemini');
    }

    // Validate and sanitize the response
    if (typeof analysis.adjustments?.burnIntensity !== 'number') {
      analysis.adjustments.burnIntensity = 0;
    }
    if (typeof analysis.adjustments?.dodgeIntensity !== 'number') {
      analysis.adjustments.dodgeIntensity = 0;
    }
    if (!Array.isArray(analysis.hotspots)) {
      analysis.hotspots = [];
    }

    // Clamp values to 0-100 range
    analysis.adjustments.burnIntensity = Math.max(0, Math.min(100, analysis.adjustments.burnIntensity));
    analysis.adjustments.dodgeIntensity = Math.max(0, Math.min(100, analysis.adjustments.dodgeIntensity));

    analysis.hotspots = analysis.hotspots.map(spot => ({
      ...spot,
      severity: Math.max(0, Math.min(100, spot.severity))
    }));

    return analysis;
  } catch (error) {
    console.error('Gemini lighting analysis failed:', error);
    throw error;
  }
}

/**
 * Get user-friendly description of the analysis
 */
export function getAnalysisDescription(analysis: LightingAnalysis): string {
  if (!analysis.hasStudioLighting) {
    return '✓ แสงดูเป็นธรรมชาติอยู่แล้ว ไม่จำเป็นต้องปรับ';
  }

  const parts: string[] = [];

  if (analysis.adjustments.burnIntensity > 0) {
    parts.push(`ลดแสงสว่าง ${analysis.adjustments.burnIntensity}%`);
  }

  if (analysis.hotspots.length > 0) {
    const areas = analysis.hotspots
      .filter(h => h.severity > 30)
      .map(h => {
        const areaNames: Record<string, string> = {
          forehead: 'หน้าผาก',
          nose: 'จมูก',
          left_cheek: 'แก้มซ้าย',
          right_cheek: 'แก้มขวา',
          chin: 'คาง',
          overall: 'ใบหน้า'
        };
        return areaNames[h.area] || h.area;
      });

    if (areas.length > 0) {
      parts.push(`จุดสว่างเกิน: ${areas.join(', ')}`);
    }
  }

  return parts.join(' • ') || analysis.brightnessAnalysis;
}
