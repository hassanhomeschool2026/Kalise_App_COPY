import React, { useState, useEffect, useRef } from 'react';
import { Wind, Volume2, VolumeX, Sparkles, Eye, Hand, Check, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { KaliseOrb } from './KaliseOrb';

type Modality = 'box' | 'rest' | 'grounding';
type BreathPhase = 'Inhale' | 'Hold (In)' | 'Exhale' | 'Hold (Out)';

export const CalmStudio: React.FC = () => {
  const [modality, setModality] = useState<Modality>('box');
  const [audioGuidance, setAudioGuidance] = useState(false);

  // Breathing state
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>('Inhale');
  const [secondsInPhase, setSecondsInPhase] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);

  // Grounding state
  const [groundingStep, setGroundingStep] = useState(0);
  const [groundingInput, setGroundingInput] = useState('');
  const [groundingNotes, setGroundingNotes] = useState<string[]>(Array(5).fill(''));

  // Web Audio API synthesizer tone generator for eyes-closed audio guidance
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = (type: 'inhale' | 'hold' | 'exhale') => {
    if (!audioGuidance) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      let freq = 432; // Default calming frequency (A4 = 432Hz or similar)
      if (type === 'inhale') freq = 528; // Solfeggio healing / rising
      else if (type === 'hold') freq = 396; // Grounding tone
      else if (type === 'exhale') freq = 285; // Deep release

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.3);
    } catch (e) {
      console.warn('Audio chime playback failed:', e);
    }
  };

  // Breathing schedule definitions
  // Box: Inhale 4, Hold 4, Exhale 4, Hold 4
  // Rest (4-7-8): Inhale 4, Hold 7, Exhale 8
  const getDurations = () => {
    if (modality === 'box') {
      return { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 };
    } else {
      return { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 };
    }
  };

  useEffect(() => {
    let timer: any;
    if (isRunning && (modality === 'box' || modality === 'rest')) {
      const durations = getDurations();
      const currentMax =
        phase === 'Inhale'
          ? durations.inhale
          : phase === 'Hold (In)'
          ? durations.holdIn
          : phase === 'Exhale'
          ? durations.exhale
          : durations.holdOut;

      timer = setInterval(() => {
        setSecondsInPhase((prev) => {
          if (prev + 1 >= currentMax) {
            // Transition to next phase
            let nextPhase: BreathPhase = 'Inhale';
            if (modality === 'box') {
              if (phase === 'Inhale') nextPhase = 'Hold (In)';
              else if (phase === 'Hold (In)') nextPhase = 'Exhale';
              else if (phase === 'Exhale') nextPhase = 'Hold (Out)';
              else {
                nextPhase = 'Inhale';
                setCycleCount((c) => c + 1);
              }
            } else {
              // 4-7-8
              if (phase === 'Inhale') nextPhase = 'Hold (In)';
              else if (phase === 'Hold (In)') nextPhase = 'Exhale';
              else {
                nextPhase = 'Inhale';
                setCycleCount((c) => c + 1);
              }
            }

            // Trigger audio cue
            if (nextPhase === 'Inhale') playChime('inhale');
            else if (nextPhase === 'Hold (In)') playChime('hold');
            else if (nextPhase === 'Exhale') playChime('exhale');

            setPhase(nextPhase);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, phase, modality, audioGuidance]);

  const handleToggleRunning = () => {
    if (!isRunning) {
      setPhase('Inhale');
      setSecondsInPhase(0);
      playChime('inhale');
    }
    setIsRunning(!isRunning);
  };

  const groundingSteps = [
    { count: 5, sense: 'SEE', desc: 'Look around and name 5 things you can see in your space. Notice colors, shapes, or light.' },
    { count: 4, sense: 'TOUCH', desc: 'Notice 4 things you can physically feel right now (e.g. clothing texture, chair support, cool air).' },
    { count: 3, sense: 'HEAR', desc: 'Listen carefully for 3 sounds around you, near or far.' },
    { count: 2, sense: 'SMELL', desc: 'Identify 2 scents in your environment, or recall a comforting fragrance.' },
    { count: 1, sense: 'TASTE', desc: 'Notice 1 taste in your mouth, or take a slow sip of water.' },
  ];

  return (
    <div className="space-y-6 pb-24 pt-2 animate-in fade-in duration-300 max-w-xl mx-auto">
      {/* Studio Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 font-serif">Calm & Grounding Studio</h1>
          <p className="text-xs text-slate-400 mt-0.5">Somatic regulation and nervous system reset.</p>
        </div>

        {/* Audio Guidance Toggle */}
        <button
          onClick={() => setAudioGuidance(!audioGuidance)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium transition cursor-pointer border ${
            audioGuidance
              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
          title="Toggle eyes-closed audio tones"
        >
          {audioGuidance ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4" />}
          <span>Audio Cues: {audioGuidance ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Modality Selector Cards */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => {
            setModality('box');
            setIsRunning(false);
            setPhase('Inhale');
            setCycleCount(1);
          }}
          className={`p-3 rounded-2xl text-left transition cursor-pointer border flex flex-col justify-between ${
            modality === 'box'
              ? 'bg-teal-500/15 border-teal-500/50 text-slate-100 shadow-md'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Wind className={`w-4 h-4 ${modality === 'box' ? 'text-teal-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-mono text-slate-500">4-4-4-4</span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold">Box Breathing</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Nervous system reset</p>
          </div>
        </button>

        <button
          onClick={() => {
            setModality('rest');
            setIsRunning(false);
            setPhase('Inhale');
            setCycleCount(1);
          }}
          className={`p-3 rounded-2xl text-left transition cursor-pointer border flex flex-col justify-between ${
            modality === 'rest'
              ? 'bg-indigo-500/15 border-indigo-500/50 text-slate-100 shadow-md'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Sparkles className={`w-4 h-4 ${modality === 'rest' ? 'text-indigo-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-mono text-slate-500">4-7-8</span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold">Deep Rest</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sleep &amp; anxiety wind-down</p>
          </div>
        </button>

        <button
          onClick={() => {
            setModality('grounding');
            setIsRunning(false);
          }}
          className={`p-3 rounded-2xl text-left transition cursor-pointer border flex flex-col justify-between ${
            modality === 'grounding'
              ? 'bg-sky-500/15 border-sky-500/50 text-slate-100 shadow-md'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Eye className={`w-4 h-4 ${modality === 'grounding' ? 'text-sky-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-mono text-slate-500">5-4-3-2-1</span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold">5-4-3-2-1 Focus</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sensory grounding</p>
          </div>
        </button>
      </div>

      {/* Main Studio View */}
      {modality === 'grounding' ? (
        /* 5-4-3-2-1 Grounding Stepper */
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold">
              <Eye className="w-4 h-4 text-teal-400" />
              <span>Step {groundingStep + 1} of 5</span>
            </div>
            <div className="flex gap-1">
              {groundingSteps.map((_, i) => (
                <span
                  key={i}
                  className={`w-6 h-1.5 rounded-full transition-all ${
                    i === groundingStep ? 'bg-teal-400 w-8' : i < groundingStep ? 'bg-teal-500/40' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3 text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 font-bold text-lg font-serif">
              {groundingSteps[groundingStep].count}
            </div>
            <h2 className="text-base font-bold text-slate-100 font-serif">
              Things you can {groundingSteps[groundingStep].sense}
            </h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
              {groundingSteps[groundingStep].desc}
            </p>

            <input
              type="text"
              value={groundingNotes[groundingStep]}
              onChange={(e) => {
                const updated = [...groundingNotes];
                updated[groundingStep] = e.target.value;
                setGroundingNotes(updated);
              }}
              placeholder={`Type what you notice right now...`}
              className="w-full max-w-md mx-auto mt-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500/60"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              disabled={groundingStep === 0}
              onClick={() => setGroundingStep((prev) => Math.max(0, prev - 1))}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {groundingStep < groundingSteps.length - 1 ? (
              <button
                onClick={() => setGroundingStep((prev) => Math.min(groundingSteps.length - 1, prev + 1))}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-md"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setGroundingStep(0);
                  setGroundingNotes(Array(5).fill(''));
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 text-xs font-bold transition cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Start Over</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Breathing Engine with KaliseOrb */
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 via-slate-900 to-indigo-500/10 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
            <span className="text-[11px] uppercase tracking-widest text-teal-400 font-semibold">
              {modality === 'box' ? 'Box Breathing (4-4-4-4)' : 'Deep Rest (4-7-8)'}
            </span>

            {/* Kalise Orb Hero Size */}
            <div className="py-6">
              <KaliseOrb
                state={isRunning ? 'breathing' : 'idle'}
                size="hero"
              />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold font-serif text-slate-100 tracking-tight">
                {isRunning ? phase : 'Ready to begin'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {isRunning ? `Cycle ${cycleCount}` : 'Press start when you are ready'}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex justify-center gap-3 pt-2">
            <button
              onClick={handleToggleRunning}
              className={`px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer shadow-lg ${
                isRunning
                  ? 'bg-rose-500 hover:bg-rose-400 text-slate-950'
                  : 'bg-gradient-to-r from-teal-500 to-indigo-500 hover:opacity-95 text-slate-950'
              }`}
            >
              {isRunning ? 'Pause Breathing' : 'Start Session'}
            </button>
            {isRunning && (
              <button
                onClick={() => {
                  setIsRunning(false);
                  setPhase('Inhale');
                  setCycleCount(1);
                }}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
