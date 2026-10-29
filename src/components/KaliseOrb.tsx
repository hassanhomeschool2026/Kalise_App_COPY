import React from 'react';

export type OrbState = 'idle' | 'listening' | 'responding' | 'breathing';
export type OrbSize = 'sm' | 'md' | 'lg' | 'hero';

interface KaliseOrbProps {
  state?: OrbState;
  size?: OrbSize;
  className?: string;
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
}) => {
  const { container, dimension } = sizeMap[size] || sizeMap.md;

  let glowColor = 'from-teal-400/30 via-indigo-500/20 to-lavender-500/10';

  if (state === 'listening') {
    glowColor = 'from-rose-400/40 via-teal-400/30 to-indigo-500/30';
  } else if (state === 'responding') {
    glowColor = 'from-teal-300/50 via-indigo-400/40 to-purple-500/30';
  } else if (state === 'breathing') {
    glowColor = 'from-teal-400/40 via-indigo-500/30 to-lavender-400/20';
  }

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${container} ${className}`}>
      {/* Backdrop Radial Glow */}
      <div
        className={`absolute inset-0 rounded-full blur-xl opacity-70 bg-gradient-to-tr ${glowColor} transition-all duration-700 pointer-events-none ${
          state === 'responding' ? 'scale-125 animate-pulse' : 'scale-100'
        }`}
      />

      {/* Main Glass Sphere SVG */}
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 drop-shadow-lg ${
          state === 'listening'
            ? 'animate-orb-listening'
            : state === 'responding'
            ? 'animate-orb-responding'
            : state === 'breathing'
            ? 'animate-orb-breathing'
            : 'animate-orb-idle'
        }`}
      >
        <defs>
          <radialGradient id="sphere-base" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#5EEAD4" stopOpacity="0.7" />
            <stop offset="70%" stopColor="#C4A8E0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#4338CA" stopOpacity="0.8" />
          </radialGradient>

          <linearGradient id="ribbon-teal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4338CA" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="ribbon-lavender" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C4A8E0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#5EEAD4" stopOpacity="0.4" />
          </linearGradient>

          <radialGradient id="specular" cx="25%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <filter id="glass-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="url(#ribbon-teal)"
          strokeWidth="1.5"
          strokeOpacity="0.4"
          fill="none"
        />

        <circle
          cx="50"
          cy="50"
          r="42"
          fill="url(#sphere-base)"
          filter="url(#glass-glow)"
        />

        <g className={state === 'responding' ? 'animate-spin-slow' : 'animate-drift'} style={{ transformOrigin: '50px 50px' }}>
          <path
            d="M20 50C20 30 40 25 60 35C80 45 85 70 65 80C45 90 20 70 20 50Z"
            fill="url(#ribbon-lavender)"
            opacity="0.65"
            className="mix-blend-overlay"
          />
          <path
            d="M30 30C50 20 70 40 75 60C80 80 55 85 40 70C25 55 10 40 30 30Z"
            fill="url(#ribbon-teal)"
            opacity="0.5"
            className="mix-blend-screen"
          />
        </g>

        <circle
          cx="50"
          cy="50"
          r="25"
          fill="#FFFFFF"
          opacity="0.25"
          className="animate-pulse"
        />

        <circle
          cx="38"
          cy="38"
          r="38"
          fill="url(#specular)"
        />
      </svg>

      <style>{`
        @keyframes orbIdle {
          0%, 100% { transform: scale(0.98); }
          50% { transform: scale(1.02); }
        }
        @keyframes orbListening {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          25% { transform: scale(1.06); filter: brightness(1.2); }
          50% { transform: scale(0.97); filter: brightness(0.95); }
          75% { transform: scale(1.04); filter: brightness(1.15); }
        }
        @keyframes orbResponding {
          0% { transform: scale(1) rotate(0deg); filter: brightness(1.15); }
          50% { transform: scale(1.05) rotate(180deg); filter: brightness(1.3); }
          100% { transform: scale(1) rotate(360deg); filter: brightness(1.15); }
        }
        @keyframes orbBreathing {
          0%, 100% { transform: scale(0.94); }
          50% { transform: scale(1.08); }
        }
        @keyframes drift {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-orb-idle {
          animation: orbIdle 4s ease-in-out infinite;
        }
        .animate-orb-listening {
          animation: orbListening 1.5s ease-in-out infinite;
        }
        .animate-orb-responding {
          animation: orbResponding 6s linear infinite;
        }
        .animate-orb-breathing {
          animation: orbBreathing 6s ease-in-out infinite;
        }
        .animate-drift {
          animation: drift 12s linear infinite;
        }
        .animate-spin-slow {
          animation: orbResponding 4s linear infinite;
        }
      `}</style>
    </div>
  );
};
