import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Volume2, Shield, Check, Globe } from 'lucide-react';
import { KaliseOrb } from './KaliseOrb';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  onComplete: () => void;
}

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Other'];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const CANADA_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Québec', 'Saskatchewan'
];

const INTENTS = [
  'Relationship Clarity',
  'Stress & Anxiety Reset',
  'Somatic Grounding',
  'Honest Reality Checks',
  'Daily Decompression'
];

export const OnboardingFlow: React.FC<Props> = ({ user, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [preferredName, setPreferredName] = useState(user?.user_metadata?.preferred_name || user?.email?.split('@')[0] || '');
  const [selectedCountry, setSelectedCountry] = useState('United States');
  const [selectedState, setSelectedState] = useState('');
  const [selectedIntent, setSelectedIntent] = useState('Relationship Clarity');
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayingWelcome, setIsPlayingWelcome] = useState(false);

  useEffect(() => {
    if (step === 4) {
      playWelcomeAudio();
    }
  }, [step]);

  const playWelcomeAudio = async () => {
    try {
      setIsPlayingWelcome(true);
      const welcomeText = "Hey there, I'm Kalise. Whatever you're carrying today—big or small—I'm right here with you. Let's take a breath.";
      const res = await fetch('/api/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: welcomeText }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsPlayingWelcome(false);
        audio.onerror = () => setIsPlayingWelcome(false);
        await audio.play();
      } else {
        setIsPlayingWelcome(false);
      }
    } catch (e) {
      console.warn('Welcome audio playback error:', e);
      setIsPlayingWelcome(false);
    }
  };

  const handleSaveAndComplete = async (skipped = false) => {
    setIsSaving(true);
    try {
      if (user) {
        const finalName = preferredName.trim() || user.email?.split('@')[0] || 'Friend';
        await supabase
          .from('kalise_profiles')
          .upsert({
            id: user.id,
            app_id: 'kalise',
            preferred_name: finalName,
            country: selectedCountry || 'United States',
            state_region: selectedState || null,
            primary_intent: selectedIntent,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      }
    } catch (err) {
      console.error('Error saving onboarding profile:', err);
    } finally {
      setIsSaving(false);
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090d16] text-slate-100 flex flex-col justify-between p-6 sm:p-10 max-w-xl mx-auto font-sans overflow-y-auto">
      {/* Top Header / Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-8 bg-teal-400' : s < step ? 'w-4 bg-teal-500/50' : 'w-4 bg-slate-800'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Step {step} of 4
          </span>
        </div>
      </div>

      {/* Center Content */}
      <div className="my-auto py-8 space-y-8">
        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="space-y-6 text-center sm:text-left animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-center sm:justify-start">
              <KaliseOrb state="idle" size="hero" />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-teal-400 font-semibold">
                Welcome to Kalise
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold font-serif text-slate-100">
                Meet Kalise
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Your sanctuary for honest reflection, loving candor, and real-talk guidance.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                What should Kalise call you?
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Enter your name or nickname..."
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-teal-500 transition text-sm shadow-inner"
              />
            </div>
          </div>
        )}

        {/* STEP 2: JURISDICTION & REGIONAL SUPPORT */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-300 mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">
                Where are you based?
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Helps Kalise tailor accurate local resources, tenant rights, and crisis support lines.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setSelectedState('');
                  }}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-teal-500 transition text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {(selectedCountry === 'United States' || selectedCountry === 'Canada') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    {selectedCountry === 'United States' ? 'State / Region' : 'Province'}
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-teal-500 transition text-sm"
                  >
                    <option value="">Select {selectedCountry === 'United States' ? 'State' : 'Province'}...</option>
                    {(selectedCountry === 'United States' ? US_STATES : CANADA_PROVINCES).map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => handleSaveAndComplete(true)}
                className="text-xs text-slate-400 hover:text-teal-300 underline transition cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PRIMARY FOCUS */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">
                What brings you here today?
              </h2>
              <p className="text-xs text-slate-400">
                Select your primary focus for our sessions together.
              </p>
            </div>

            <div className="space-y-2.5">
              {INTENTS.map((intent) => {
                const isSelected = selectedIntent === intent;
                return (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => setSelectedIntent(intent)}
                    className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/15 border-teal-500/50 text-slate-100 shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-medium text-sm">{intent}</span>
                    {isSelected && <Check className="w-4 h-4 text-teal-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: FIRST VOICE HELLO */}
        {step === 4 && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-center py-4">
              <KaliseOrb state="responding" size="hero" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">
                Your sanctuary is ready.
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                {isPlayingWelcome ? "Listening to Kalise's welcome..." : "Kalise is present and ready whenever you are."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
              <Volume2 className="w-4 h-4 text-teal-400 animate-pulse" />
              <span>Valerie's voice engine active</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Shield className="w-4 h-4 text-teal-400 shrink-0" />
          <span>Encrypted & Private</span>
        </div>

        <button
          onClick={() => {
            if (step < 4) {
              setStep((prev) => (prev + 1) as any);
            } else {
              handleSaveAndComplete(false);
            }
          }}
          disabled={isSaving}
          className="px-6 py-3.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-teal-500/20 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Entering...' : step === 4 ? 'Enter Sanctuary' : 'Continue'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
