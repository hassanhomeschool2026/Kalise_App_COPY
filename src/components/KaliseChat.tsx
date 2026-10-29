import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles, AlertCircle, Heart, Shield, RefreshCw, MessageSquareHeart, Lock, Mic, MicOff, ExternalLink, PhoneCall, Volume2, VolumeX, Wind, CheckSquare, Square, BookOpen, X } from 'lucide-react';
import { ChatMessage, MoodEntry, UserSettings, JournalEntry } from '../types';
import { evaluateCrisisState } from '../utils/crisisPhrases.js';
import { KaliseOrb, OrbState } from './KaliseOrb';

interface Props {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearChat: () => void;
  onOpenCrisis: (reason?: string) => void;
  onOpenPremium: () => void;
  settings: UserSettings;
  latestMood?: MoodEntry;
  journals?: JournalEntry[];
  isLoading: boolean;
  chatError?: string | null;
  onRetry?: () => void;
}

const STARTER_PROMPTS = [
  "I need to calm down.",
  "Make me laugh.",
  "I've got some tea to spill.",
  "I'm overwhelmed and need to sort it out.",
  "Help me think something through.",
];

export const KaliseChat: React.FC<Props> = ({
  messages,
  onSendMessage,
  onClearChat,
  onOpenCrisis,
  onOpenPremium,
  settings,
  latestMood,
  journals = [],
  isLoading,
  chatError,
  onRetry,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [waveformLevels, setWaveformLevels] = useState<number[]>([20, 20, 20, 20, 20]);
  const [audioError, setAudioError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const shouldAutoSendRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Text-to-Speech State
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [loadingAudioMsgId, setLoadingAudioMsgId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Interactive Breathing Widget State
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold (In)' | 'Exhale' | 'Hold (Out)'>('Inhale');
  const [breathCount, setBreathCount] = useState(4);

  const bypassPaywall = import.meta.env.VITE_BYPASS_PAYWALL === 'true';
  const crisisEvaluation = evaluateCrisisState(messages);
  const inCrisis = crisisEvaluation.crisisMode;
  const isFreeLimitReached = !inCrisis && !bypassPaywall && !settings.isPremium && settings.freeMessagesUsed >= 3;

  const [isCrisisPillDismissed, setIsCrisisPillDismissed] = useState(false);

  const currentOrbState: OrbState = isRecording
    ? 'listening'
    : isLoading || loadingAudioMsgId !== null || playingMsgId !== null
    ? 'responding'
    : breathingActive
    ? 'breathing'
    : 'idle';

  useEffect(() => {
    if (messages.length === 0) {
      setIsCrisisPillDismissed(false);
    }
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Breathing timer effect
  useEffect(() => {
    let timer: any;
    if (breathingActive) {
      timer = setInterval(() => {
        setBreathCount((prev) => {
          if (prev > 1) return prev - 1;
          if (breathPhase === 'Inhale') {
            setBreathPhase('Hold (In)');
            return 4;
          } else if (breathPhase === 'Hold (In)') {
            setBreathPhase('Exhale');
            return 4;
          } else if (breathPhase === 'Exhale') {
            setBreathPhase('Hold (Out)');
            return 4;
          } else {
            setBreathPhase('Inhale');
            return 4;
          }
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [breathingActive, breathPhase]);

  const handleSpeak = async (msgId: string, text: string) => {
    if (playingMsgId === msgId) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingMsgId(null);
      setLoadingAudioMsgId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setPlayingMsgId(null);
    setLoadingAudioMsgId(msgId);

    try {
      const response = await fetch('/api/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to generate speech');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onplay = () => {
        setLoadingAudioMsgId(null);
        setPlayingMsgId(msgId);
      };

      audio.onended = () => {
        setPlayingMsgId(null);
        setLoadingAudioMsgId(null);
        currentAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlayingMsgId(null);
        setLoadingAudioMsgId(null);
        currentAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        setAudioError('Playback failed. Please try again.');
      };

      await audio.play();
    } catch (err: any) {
      console.error('Cartesia speech playback error:', err);
      setLoadingAudioMsgId(null);
      setPlayingMsgId(null);
      setAudioError(err?.message || 'Could not play voice message.');
    }
  };

  const setupAudioVisualizer = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const bars = [dataArray[2] || 10, dataArray[6] || 15, dataArray[10] || 20, dataArray[14] || 15, dataArray[18] || 10];
        const normalized = bars.map(v => Math.max(10, Math.min(100, (v / 255) * 100)));
        setWaveformLevels(normalized);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
    } catch (e) {
      console.error('Visualizer setup error:', e);
    }
  };

  const cleanupAudioVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setWaveformLevels([20, 20, 20, 20, 20]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isRecording && mediaRecorderRef.current) {
      shouldAutoSendRef.current = true;
      mediaRecorderRef.current.stop();
      return;
    }
    const text = inputText.trim();
    if (!text || isLoading || isTranscribing) return;

    if (isFreeLimitReached) {
      const evaluation = evaluateCrisisState([...messages, { role: 'user', content: text }]);
      if (!evaluation.crisisMode) {
        onOpenPremium();
        return;
      }
    }

    setInputText('');
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCancelRecording = () => {
    if (isRecording && mediaRecorderRef.current) {
      audioChunksRef.current = [];
      shouldAutoSendRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      cleanupAudioVisualizer();
    }
  };

  const handleToggleRecording = async () => {
    if (isTranscribing || isLoading) return;

    if (isRecording) {
      shouldAutoSendRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    setAudioError(null);
    try {
      audioChunksRef.current = [];
      shouldAutoSendRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      setupAudioVisualizer(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        cleanupAudioVisualizer();

        if (audioChunksRef.current.length === 0) {
          return;
        }

        const blobType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });

        if (audioBlob.size === 0) {
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, blobType.includes('mp4') ? 'voice_message.mp4' : 'voice_message.webm');

          const response = await fetch('/api/audio/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Transcription failed');
          }

          if (data.text) {
            const transcribed = data.text;
            if (shouldAutoSendRef.current) {
              const combinedText = inputText.trim() ? `${inputText.trim()} ${transcribed}` : transcribed;
              setInputText('');
              if (isFreeLimitReached) {
                const evaluation = evaluateCrisisState([...messages, { role: 'user', content: combinedText }]);
                if (!evaluation.crisisMode) {
                  onOpenPremium();
                  return;
                }
              }
              await onSendMessage(combinedText);
            } else {
              setInputText((prev) => (prev ? `${prev} ${transcribed}` : transcribed));
            }
          }
        } catch (err: any) {
          console.error('Transcription error:', err);
          setAudioError(err?.message || 'Could not process audio. Please try again.');
        } finally {
          setIsTranscribing(false);
          shouldAutoSendRef.current = false;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setAudioError('Could not access microphone. Please check permissions.');
      setIsRecording(false);
      setIsTranscribing(false);
      cleanupAudioVisualizer();
    }
  };

  const handlePickStarter = async (starter: string) => {
    if (isLoading) return;
    if (isFreeLimitReached) {
      onOpenPremium();
      return;
    }
    await onSendMessage(starter);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-110px)] pb-16 pt-1 animate-in fade-in duration-300">
      {/* Top Companion Presence Bar */}
      <div className="p-3.5 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between mb-3 shadow-md">
        <div className="flex items-center gap-3">
          <KaliseOrb state={currentOrbState} size="md" />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-slate-100 font-serif">Kalise</h2>
              <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-medium border border-teal-500/20">
                AI Companion
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Present & listening
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setBreathingActive(!breathingActive)}
            className={`p-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-medium border ${
              breathingActive
                ? 'bg-teal-500 text-slate-950 border-teal-400'
                : 'bg-slate-800 text-teal-300 border-teal-500/30 hover:bg-slate-700'
            }`}
            title="Interactive Breathing Exercise"
          >
            <Wind className="w-4 h-4" />
            <span className="hidden sm:inline">Breathe</span>
          </button>
          <button
            onClick={onClearChat}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Clear conversation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Breathing / Grounding Active Widget Card */}
      {breathingActive && (
        <div className="mb-3 p-4 rounded-3xl bg-slate-900 border border-teal-500/40 text-center space-y-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold">
              <Wind className="w-4 h-4 animate-spin" />
              <span>Calming Box Breathing Exercise</span>
            </div>
            <button
              onClick={() => setBreathingActive(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="py-4">
            <div className="w-24 h-24 mx-auto rounded-full bg-teal-500/15 border-2 border-teal-400 flex flex-col items-center justify-center animate-serene-breathe shadow-inner">
              <span className="text-sm font-bold text-teal-200">{breathPhase}</span>
              <span className="text-xl font-mono font-bold text-white">{breathCount}s</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 max-w-xs mx-auto">
            Follow the gentle cadence. Inhale as the circle expands, hold, exhale as it softens. You are safe right here.
          </p>
        </div>
      )}

      {/* Free trial messages reminder */}
      {bypassPaywall ? (
        <div className="mb-2 p-1.5 px-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 font-medium w-fit">
          Testing mode: paywall off
        </div>
      ) : !settings.isPremium && (
        <div className="mb-2 p-2 px-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-300">
          <span>
            Trial: {3 - settings.freeMessagesUsed > 0 ? `${3 - settings.freeMessagesUsed} free trial messages left` : 'Trial messages completed'}
          </span>
          <button
            onClick={onOpenPremium}
            className="font-semibold underline hover:text-white cursor-pointer"
          >
            Unlock Kalise Plus
          </button>
        </div>
      )}

      {/* Chat Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 no-scrollbar">
        <div className="text-center my-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
            <Shield className="w-3 h-3 text-teal-400" />
            Kalise is an AI wellness companion, not a licensed therapist or physician.
          </span>
        </div>

        {messages.length === 0 && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 my-4">
            <h3 className="text-sm md:text-base font-serif font-semibold text-slate-100">
              Hey, I'm Kalise. 💚 What's going on today?
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              We can vent, laugh, spill tea, calm down, or figure something out. Start wherever you are.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const hasResources = !isUser && (
            /\b211\b/.test(msg.content) ||
            /\bfeeding america\b/i.test(msg.content) ||
            /\bfindhelp\b/i.test(msg.content) ||
            /\bfood banks?\b/i.test(msg.content) ||
            /\bEBT\b/.test(msg.content)
          );
          const isSpeaking = speakingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
            >
              {!isUser && (
                <div className="flex items-center gap-1.5 mb-1 pl-1">
                  <KaliseOrb state="idle" size="sm" />
                  <span className="text-[11px] font-semibold text-slate-300 font-serif">Kalise</span>
                </div>
              )}
              <div
                className={`max-w-[94%] rounded-3xl p-4 text-xs md:text-sm leading-relaxed relative group ${
                  isUser
                    ? 'bg-teal-500 text-slate-950 font-medium rounded-tr-xs shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs shadow-sm'
                }`}
              >
                {/* Assistant TTS Play Button */}
                {!isUser && (
                  <button
                    type="button"
                    onClick={() => handleSpeak(msg.id, msg.content)}
                    disabled={loadingAudioMsgId === msg.id}
                    className={`absolute top-3 right-3 p-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                      playingMsgId === msg.id
                        ? 'bg-teal-500 text-slate-950 font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={playingMsgId === msg.id ? "Stop reading" : "Read aloud with Cartesia voice"}
                  >
                    {loadingAudioMsgId === msg.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-300" />
                    ) : playingMsgId === msg.id ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {isUser ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="pr-6">
                    <ReactMarkdown
                      disallowedElements={['img']}
                      skipHtml={true}
                      components={{
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                        li: ({ node, ...props }) => <li className="my-0.5" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-slate-100" {...props} />,
                        a: ({ node, ...props }) => <a className="text-teal-400 underline hover:text-teal-300" target="_blank" rel="noopener noreferrer" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Interactive Resource Quick Actions Card */}
                {hasResources && (
                  <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                    <a
                      href="https://www.findhelp.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-xs font-medium border border-teal-500/30 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Findhelp.org</span>
                    </a>
                    <a
                      href="https://www.feedingamerica.org/find-your-local-foodbank"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Feeding America Food Banks</span>
                    </a>
                    <a
                      href="tel:211"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-teal-400" />
                      <span>Call 211 Support</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Crisis safeguard trigger if response flagged crisis */}
              {msg.isCrisis && inCrisis && !isCrisisPillDismissed && msg === messages[messages.length - 1] && (
                <div className="mt-2 max-w-[86%] p-3 rounded-2xl bg-slate-900/90 border border-teal-500/30 text-slate-200 text-xs shadow-md relative">
                  <button
                    onClick={() => setIsCrisisPillDismissed(true)}
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-100 p-1 rounded-lg transition cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-1.5 font-semibold text-teal-300 pr-5">
                    <Heart className="w-4 h-4 text-teal-400 fill-teal-400/20" />
                    <span>Support is always here</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Call or text 988 any time (free, US). Outside the US, see findahelpline.com.
                  </p>
                  <button
                    onClick={() => onOpenCrisis("I noticed things feel heavy right now. Please reach out to someone who can help support you safely.")}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-sm"
                  >
                    Crisis resources
                  </button>
                </div>
              )}

              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs p-3 rounded-2xl bg-slate-900/60 border border-slate-800 w-fit">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="font-serif italic">Kalise is reflecting...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts */}
      {messages.length <= 2 && (
        <div className="my-2 space-y-1.5">
          <p className="text-[11px] text-slate-400 font-medium">What do you need right now?</p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePickStarter(prompt)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-800 whitespace-nowrap transition cursor-pointer shrink-0"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error banner with retry */}
      {chatError && (
        <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex flex-col gap-1.5 mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{chatError}</span>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold transition cursor-pointer shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Free limit reached lockout */}
      {isFreeLimitReached && (
        <div className="mb-2 p-3 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/40 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-indigo-300 text-xs font-semibold">
            <Lock className="w-4 h-4" />
            <span>You've experienced your free trial check-ins</span>
          </div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Upgrade to Kalise Plus for unlimited empathetic conversations and deep emotional memory.
          </p>
          <button
            onClick={onOpenPremium}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
          >
            Unlock Kalise Plus (7-Day Trial)
          </button>
        </div>
      )}



      {/* Audio Error Banner */}
      {audioError && (
        <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between mb-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{audioError}</span>
          </div>
          <button
            onClick={() => setAudioError(null)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-300 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isRecording
              ? "Listening... (tap mic to review, or arrow to send)"
              : isTranscribing
              ? "Gathering thoughts..."
              : "Talk through whatever is happening right now..."
          }
          disabled={isLoading || isTranscribing}
          rows={3}
          className={`w-full pl-4 pr-36 py-3 rounded-2xl bg-slate-900 border text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none shadow-inner resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition ${
            isRecording ? 'border-rose-500 ring-2 ring-rose-500/20 animate-pulse' : 'border-slate-800 focus:border-teal-500/60'
          }`}
        />
        <div className="absolute right-2.5 bottom-3.5 flex items-center gap-1.5">
          {/* Live Audio Waveform Indicator */}
          {isRecording && (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-rose-500/10 rounded-xl border border-rose-500/20 mr-0.5">
              {waveformLevels.map((height, i) => (
                <span
                  key={i}
                  className="w-1 bg-rose-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(6, (height / 100) * 18)}px` }}
                />
              ))}
            </div>
          )}

          {/* Cancel button during recording */}
          {isRecording && (
            <button
              type="button"
              onClick={handleCancelRecording}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer shadow-sm"
              title="Discard recording"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={isLoading || isTranscribing}
            className={`p-2 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center ${
              isRecording
                ? 'bg-rose-500 text-slate-950 animate-bounce'
                : isTranscribing
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title={isRecording ? "Stop recording & review in input" : isTranscribing ? "Gathering thoughts..." : "Record voice message"}
          >
            {isTranscribing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-teal-300" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          <button
            type="submit"
            disabled={(!inputText.trim() && !isRecording) || isLoading || isTranscribing}
            className="p-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 disabled:opacity-40 transition cursor-pointer shadow-sm"
            title={isRecording ? "Stop recording & send immediately" : "Send message"}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
