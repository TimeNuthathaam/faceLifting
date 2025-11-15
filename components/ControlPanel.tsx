'use client';

import React from 'react';
import { FaceAdjustments } from '@/lib/faceManipulation';

interface ControlPanelProps {
  adjustments: FaceAdjustments;
  onAdjustmentChange: (key: keyof FaceAdjustments, value: number) => void;
  onReset: () => void;
  disabled?: boolean;
}

interface SliderConfig {
  key: keyof FaceAdjustments;
  label: string;
  labelThai: string;
  icon: string;
  min: number;
  max: number;
}

const sliderConfigs: SliderConfig[] = [
  { key: 'slimFace', label: 'Slim Face', labelThai: 'หน้าเรียว', icon: '👤', min: -100, max: 100 },
  { key: 'headSize', label: 'Head Size', labelThai: 'ขนาดศีรษะ', icon: '🗣️', min: -100, max: 100 },
  { key: 'jawline', label: 'Jawline', labelThai: 'กราม', icon: '💪', min: -200, max: 200 },
  { key: 'chin', label: 'Chin', labelThai: 'คาง', icon: '🎯', min: -100, max: 100 },
  { key: 'forehead', label: 'Forehead', labelThai: 'หน้าผาก', icon: '🧠', min: -100, max: 100 },
  { key: 'cheekbones', label: 'Cheekbones', labelThai: 'โหนกแก้ม', icon: '💎', min: -100, max: 100 },
  { key: 'faceWidth', label: 'Face Width', labelThai: 'ความกว้างใบหน้า', icon: '↔️', min: -100, max: 100 },
  // Lighting Adjustments Section
  { key: 'dodge', label: 'Dodge (Lighten)', labelThai: 'เพิ่มความสว่าง', icon: '☀️', min: -100, max: 100 },
  { key: 'burn', label: 'Burn (Darken)', labelThai: 'ลดความสว่าง', icon: '🌙', min: -100, max: 100 },
  { key: 'clarity', label: 'Clarity', labelThai: 'ความคมชัด', icon: '✨', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', labelThai: 'คอนทราสต์', icon: '🎨', min: -100, max: 100 },
];

export default function ControlPanel({
  adjustments,
  onAdjustmentChange,
  onReset,
  disabled = false,
}: ControlPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Face Adjustments
        </h2>
        <button
          onClick={onReset}
          disabled={disabled}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
        >
          🔄 Reset All
        </button>
      </div>

      <div className="space-y-5">
        {sliderConfigs.map((config, index) => (
          <div key={config.key}>
            {/* Section Headers */}
            {index === 0 && (
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-300 dark:border-gray-600">
                🎭 Face Shape
              </h3>
            )}
            {index === 7 && (
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 pb-2 mt-4 border-b border-gray-300 dark:border-gray-600">
                💡 Lighting & Effects
              </h3>
            )}

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span className="text-xl">{config.icon}</span>
                  <span>
                    {config.labelThai}
                    <span className="text-xs text-gray-500 ml-1">({config.label})</span>
                  </span>
                </label>
                <span className="text-sm font-mono text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
                  {adjustments[config.key] > 0 ? '+' : ''}
                  {adjustments[config.key]}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={config.min}
                  max={config.max}
                  step="1"
                  value={adjustments[config.key]}
                  onChange={(e) => onAdjustmentChange(config.key, Number(e.target.value))}
                  disabled={disabled}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
                  style={{
                    background: disabled
                      ? undefined
                      : `linear-gradient(to right,
                        #ef4444 0%,
                        #f59e0b 25%,
                        #10b981 50%,
                        #f59e0b 75%,
                        #ef4444 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{config.min}</span>
                  <span>0</span>
                  <span>+{config.max}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 Tip: ลากแถบเลื่อนไปทางซ้ายหรือขวาเพื่อปรับแต่งใบหน้า
        </p>
      </div>
    </div>
  );
}
