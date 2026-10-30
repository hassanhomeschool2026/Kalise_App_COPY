import React, { useState } from 'react';

export type OrbState = 'idle' | 'listening' | 'responding' | 'breathing';
export type OrbSize = 'sm' | 'md' | 'lg' | 'hero';
export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'holdOut' | 'idle';

interface KaliseOrbProps {
  state?: OrbState;
  size?: OrbSize;
  className?: string;
  breathPhase?: BreathPhase;
  duration?: number;
}

const sizeMap: Record<OrbSize, { container: string; dimension: number }> = {
  sm: { container: 'w-8 h-8', dimension: 32 },
  md: { container: 'w-12 h-12', dimension: 48 },
  lg: { container: 'w-20 h-20', dimension: 80 },
  hero: { container: 'w-32 h-32', dimension: 128 },
};

export const KaliseOrb: React.FC<KaliseOrbProps> = ({
  state = 'idle',
  size = 'md',
  className = '',
  breathPhase,
  duration = 4,
}) => {
  const { container } = sizeMap[size] || sizeMap.md;
  const [imgErrorIndex, setImgErrorIndex] = useState(0);

  // Asset selection: breathing state uses Kalise_Breathing.png, others use Official_KaliseOrb.png
  const primaryImgSrc = state === 'breathing' ? '/Kalise_Breathing.png' : '/Official_KaliseOrb.png';
  const fallbackSources = [primaryImgSrc, '/kalise-orb.png'];
  const currentImgSrc = fallbackSources[imgErrorIndex];

  // Precise scale & glow per breath phase:
  // - inhale: scale 0.85 to 1.30, glow 15px to 45px, opacity 0.35 to 0.75
  // - hold: frozen at scale 1.30, glow 45px, opacity 0.75 (zero movement)
  // - exhale: scale 1.30 down to 0.85, glow 45px to 15px, opacity 0.75 to 0.35
  // - holdOut: frozen at scale 0.85, glow 15px, opacity 0.35 (zero movement)
  let currentScale = 1.0;
  let currentGlowRadius = 15;
  let currentGlowOpacity = 0.35;
  let transitionDuration = duration;
  let isFrozen = false;

  if (breathPhase === 'inhale') {
    currentScale = 1.30;
    currentGlowRadius = 45;
    currentGlowOpacity = 0.75;
    transitionDuration = duration;
    isFrozen = false;
  } else if (breathPhase === 'hold') {
    currentScale = 1.30;
    currentGlowRadius = 45;
    currentGlowOpacity = 0.75;
    transitionDuration = 0;
    isFrozen = true;
  } else if (breathPhase === 'exhale') {
    currentScale = 0.85;
    currentGlowRadius = 15;
    currentGlowOpacity = 0.35;
    transitionDuration = duration;
    isFrozen = false;
  } else if (breathPhase === 'holdOut') {
    currentScale = 0.85;
    currentGlowRadius = 15;
    currentGlowOpacity = 0.35;
    transitionDuration = 0;
    isFrozen = true;
  } else {
    currentScale = 1.0;
    currentGlowRadius = 20;
    currentGlowOpacity = 0.45;
    transitionDuration = 0.7;
    isFrozen = false;
  }

  const isHoldingOrInhaling = breathPhase === 'inhale' || breathPhase === 'hold';

  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 p-4 ${container} ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }}
    >
      {/* Ambient Dynamic Radial Backlight */}
      <div 
        className="absolute inset-0 rounded-full blur-3xl pointer-events-none ease-in-out"
        style={{
          transitionDuration: isFrozen ? '0s' : `${transitionDuration}s`,
          background: isHoldingOrInhaling 
            ? 'radial-gradient(circle, rgba(196,168,224,0.45) 0%, rgba(94,234,212,0.25) 50%, transparent 75%)' 
            : 'radial-gradient(circle, rgba(196,168,224,0.18) 0%, rgba(94,234,212,0.1) 45%, transparent 70%)',
          transform: `scale(${currentScale * 1.25})`,
        }}
      />

      {/* The Breathing 3D PNG Orb with zero square bounding box */}
      <div
        className="relative z-10 flex items-center justify-center w-full h-full rounded-full"
        style={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        {imgErrorIndex < fallbackSources.length ? (
          <img
            src={currentImgSrc}
            alt="Kalise Breathing Orb"
            onError={() => setImgErrorIndex((prev) => prev + 1)}
            className="w-full h-full object-contain pointer-events-none ease-in-out"
            style={{
              transitionDuration: isFrozen ? '0s' : `${transitionDuration}s`,
              transform: `scale(${currentScale})`,
              filter: `drop-shadow(0 0 ${currentGlowRadius}px rgba(196, 168, 224, ${currentGlowOpacity})) drop-shadow(0 0 ${currentGlowRadius * 1.8}px rgba(94, 234, 212, 0.35))`,
              willChange: 'transform, filter',
            }}
          />
        ) : (
          <div className="w-full h-full rounded-full bg-teal-500/20" />
        )}
      </div>
    </div>
  );
};
