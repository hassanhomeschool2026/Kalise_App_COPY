import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles, AlertCircle, Heart, Shield, RefreshCw, MessageSquareHeart, Lock, Mic, MicOff, ExternalLink, PhoneCall, Volume2, VolumeX, Wind, CheckSquare, Square, BookOpen, X } from 'lucide-react';
import { ChatMessage, MoodEntry, UserSettings, JournalEntry } from '../types';
import { evaluateCrisisState } from '../utils/crisisPhrases.js';

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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Text-to-Speech State
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  // Interactive Breathing Widget State
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold (In)' | 'Exhale' | 'Hold (Out)'>('Inhale');
  const [breathCount, setBreathCount] = useState(4);

  const bypassPaywall = import.meta.env.VITE_BYPASS_PAYWALL === 'true';
  const crisisEvaluation = evaluateCrisisState(messages);
  const inCrisis = crisisEvaluation.crisisMode;
  const isFreeLimitReached = !inCrisis && !bypassPaywall && !settings.isPremium && settings.freeMessagesUsed >= 3;

  const [isCrisisPillDismissed, setIsCrisisPillDismissed] = useState(false);

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

  const handleSpeak = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/\[.*?\]/g, '').replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (isFreeLimitReached) {
      const evaluation = evaluateCrisisState([...messages, { role: 'user', content: text }]);
      if (!evaluation.crisisMode) {
        onOpenPremium();
        return;
      }
    }

    setInputText('');
    baseTextRef.current = '';
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatSpokenText = (raw: string) => {
    let cleaned = raw
      .replace(/\b(period|full stop)\b/gi, '.')
      .replace(/\bquestion mark\b/gi, '?')
      .replace(/\bcomma\b/gi, ',')
      .replace(/\bexclamation (point|mark)\b/gi, '!')
      .replace(/\bnew line\b/gi, '\n');

    cleaned = cleaned.replace(/\b(anyway|honestly|seriously|basically|look|well)\s+/gi, '. $1 ');
    cleaned = cleaned.replace(/(\b\w{3,}\b)\s+(and|but|so|because|yet|then|although|though|while)\s+/gi, '$1, $2 ');

    const sentences = cleaned.split(/(?<=[.?!])\s+/);
    cleaned = sentences.map(sentence => {
      const words = sentence.split(/\s+/);
      if (words.length > 12 && !/[.?!]$/.test(sentence)) {
        words.splice(10, 0, '.');
        return words.join(' ');
      }
      return sentence;
    }).join(' ');

    if (/^(who|what|where|when|why|how|is|are|can|do|does|did|will|would|should|could)\b/i.test(cleaned.trim()) && !/[.?!]$/.test(cleaned.trim())) {
      cleaned = cleaned.trim() + '?';
    } else if (!/[.?!]$/.test(cleaned.trim()) && cleaned.trim().length > 0) {
      cleaned = cleaned.trim() + '.';
    }

    cleaned = cleaned.replace(/\s+([.,?!])/g, '$1');
    cleaned = cleaned.replace(/,\s*,/g, ',');
    cleaned = cleaned.replace(/\.\s*\./g, '.');
    cleaned = cleaned.replace(/(^\s*|[.?!]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());

    return cleaned;
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. You can type your message directly.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    baseTextRef.current = inputText ? inputText.trim() + ' ' : '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const currentSpoken = finalTranscript || interimTranscript;
      if (currentSpoken) {
        const formatted = formatSpokenText(baseTextRef.current + currentSpoken);
        setInputText(formatted);
        if (finalTranscript) {
          baseTextRef.current = formatSpokenText(baseTextRef.current + finalTranscript + ' ');
        }
      }
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setIsListening(false);
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
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-indigo-500/30 border border-teal-400/40 flex items-center justify-center animate-serene-breathe">
            <MessageSquareHeart className="w-5 h-5 text-teal-300" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-400 border-2 border-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-slate-100 font-serif">Kalise</h2>
              <span className="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-medium border border-teal-500/20">
                AI Companion
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {latestMood ? `Aware of your "${latestMood.label}" mood` : 'Present & listening'}
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
            onClick={() => onOpenCrisis()}
            className="p-1.5 rounded-xl text-rose-300 hover:bg-rose-500/15 border border-rose-500/20 transition cursor-pointer"
            title="Crisis Resources & 988"
          >
            <Heart className="w-4 h-4 fill-rose-400/20" />
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
                    className={`absolute top-3 right-3 p-1.5 rounded-xl transition cursor-pointer ${
                      isSpeaking
                        ? 'bg-teal-500 text-slate-950 animate-pulse'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={isSpeaking ? "Stop listening" : "Listen aloud"}
                  >
                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
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

      {/* Contextual Quick-Attach Pills Bar */}
      <div className="flex items-center gap-1.5 mb-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-slate-500 shrink-0 font-medium">Attach:</span>
        {latestMood && (
          <button
            type="button"
            onClick={() => setInputText((prev) => (prev ? prev + ' ' : '') + `[Regarding my mood today: ${latestMood.label}] `)}
            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 text-[11px] border border-teal-500/20 transition cursor-pointer flex items-center gap-1 shrink-0"
            title="Attach today's mood score"
          >
            <span>⚡ Mood: {latestMood.label}</span>
          </button>
        )}
        {journals.length > 0 && (
          <button
            type="button"
            onClick={() => setInputText((prev) => (prev ? prev + ' ' : '') + `[Reference Journal: "${journals[0].title}"] `)}
            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-300 text-[11px] border border-indigo-500/20 transition cursor-pointer flex items-center gap-1 shrink-0"
            title="Reference recent journal"
          >
            <BookOpen className="w-3 h-3" />
            <span className="truncate max-w-[120px]">Journal: {journals[0].title}</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening... Speak now..." : "Talk through whatever is happening right now..."}
          disabled={isLoading}
          rows={3}
          className={`w-full pl-4 pr-24 py-3 rounded-2xl bg-slate-900 border text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none shadow-inner resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition ${
            isListening ? 'border-rose-500 ring-2 ring-rose-500/20 animate-pulse' : 'border-slate-800 focus:border-teal-500/60'
          }`}
        />
        <div className="absolute right-2.5 bottom-3.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`p-2 rounded-xl transition cursor-pointer shadow-sm ${
              isListening
                ? 'bg-rose-500 text-slate-950 animate-bounce'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title={isListening ? "Stop listening" : "Speech to text dictation"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 disabled:opacity-40 transition cursor-pointer shadow-sm"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
