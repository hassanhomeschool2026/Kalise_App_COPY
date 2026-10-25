import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, Heart, Shield, RefreshCw, MessageSquareHeart, Lock, Mic, MicOff, ExternalLink, PhoneCall } from 'lucide-react';
import { ChatMessage, MoodEntry, UserSettings } from '../types';

interface Props {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onClearChat: () => void;
  onOpenCrisis: (reason?: string) => void;
  onOpenPremium: () => void;
  settings: UserSettings;
  latestMood?: MoodEntry;
  isLoading: boolean;
  chatError?: string | null;
  onRetry?: () => void;
}

const STARTER_PROMPTS = [
  "I can't seem to turn off my racing thoughts tonight.",
  "I feel guilty for wanting to set a firm boundary.",
  "Help me unpack why I'm feeling so exhausted.",
  "I had an unsettling interaction and feel misunderstood.",
  "I feel like I'm falling behind everyone else my age.",
];

export const KaliseChat: React.FC<Props> = ({
  messages,
  onSendMessage,
  onClearChat,
  onOpenCrisis,
  onOpenPremium,
  settings,
  latestMood,
  isLoading,
  chatError,
  onRetry,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isFreeLimitReached = !settings.isPremium && settings.freeMessagesUsed >= 3;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (isFreeLimitReached) {
      onOpenPremium();
      return;
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

    // Smart clause breaking on venting transitions
    cleaned = cleaned.replace(/\b(anyway|honestly|seriously|basically|look|well)\s+/gi, '. $1 ');

    // Smart auto-punctuation for continuous venting (inserting commas before natural clause conjunctions if missing)
    cleaned = cleaned.replace(/(\b\w{3,}\b)\s+(and|but|so|because|yet|then|although|though|while)\s+/gi, '$1, $2 ');

    // Automatic period insertion for long continuous strings without punctuation (every ~12 words)
    const sentences = cleaned.split(/(?<=[.?!])\s+/);
    cleaned = sentences.map(sentence => {
      const words = sentence.split(/\s+/);
      if (words.length > 12 && !/[.?!]$/.test(sentence)) {
        words.splice(10, 0, '.');
        return words.join(' ');
      }
      return sentence;
    }).join(' ');

    // Smart question mark formatting if starts with interrogative word
    if (/^(who|what|where|when|why|how|is|are|can|do|does|did|will|would|should|could)\b/i.test(cleaned.trim()) && !/[.?!]$/.test(cleaned.trim())) {
      cleaned = cleaned.trim() + '?';
    } else if (!/[.?!]$/.test(cleaned.trim()) && cleaned.trim().length > 0) {
      cleaned = cleaned.trim() + '.';
    }

    // Clean up double punctuation spacing and multiple periods
    cleaned = cleaned.replace(/\s+([.,?!])/g, '$1');
    cleaned = cleaned.replace(/,\s*,/g, ',');
    cleaned = cleaned.replace(/\.\s*\./g, '.');

    // Capitalize first letter of each sentence
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

    recognition.onerror = () => {
      // Don't kill state immediately on minor silence errors
    };

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
          {/* Subtle animated breathing orb for Kalise */}
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

      {/* Free trial messages reminder */}
      {!settings.isPremium && (
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
        {/* Subtle boundary & disclaimer badge */}
        <div className="text-center my-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
            <Shield className="w-3 h-3 text-teal-400" />
            Kalise is an AI wellness companion, not a licensed therapist or physician.
          </span>
        </div>

        {messages.length === 0 && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 my-4">
            <h3 className="text-sm md:text-base font-serif font-semibold text-slate-100">
              Hey, welcome back. 💚 How are you feeling right now? What's been going on?
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Whether you need to vent, sort through something, or hear an honest perspective, we can start wherever you are.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const lowerContent = msg.content.toLowerCase();
          const hasResources = !isUser && (
            lowerContent.includes('211') ||
            lowerContent.includes('feeding america') ||
            lowerContent.includes('findhelp') ||
            lowerContent.includes('food bank') ||
            lowerContent.includes('ebt')
          );

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
            >
              <div
                className={`max-w-[94%] rounded-3xl p-4 text-xs md:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-teal-500 text-slate-950 font-medium rounded-tr-xs shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

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
              {msg.isCrisis && (
                <div className="mt-2 max-w-[86%] p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Immediate Crisis Support Available</span>
                  </div>
                  <p className="mt-1 text-[11px] text-rose-200/90">
                    Please call or text <strong>988</strong> anytime for confidential, free support.
                  </p>
                  <button
                    onClick={() => onOpenCrisis("I detected feelings of immediate crisis in our conversation. Please reach out to someone who can help keep you safe.")}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                  >
                    View 988 Lifeline &amp; Safety Guide
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

      {/* Starter Prompts (if chat is short or beginning) */}
      {messages.length <= 2 && (
        <div className="my-2 space-y-1.5">
          <p className="text-[11px] text-slate-400 font-medium">Or explore a prompt to begin:</p>
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

      {/* Error banner with retry if request failed */}
      {chatError && (
        <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between mb-2">
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
      )}

      {/* Input or Premium Lockout */}
      {isFreeLimitReached ? (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/40 text-center space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-indigo-300 text-xs font-semibold">
            <Lock className="w-4 h-4" />
            <span>You've experienced your free trial check-ins</span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Upgrade to Kalise Plus for unlimited empathetic conversations, memory of emotional patterns, and scheduled check-ins.
          </p>
          <button
            onClick={onOpenPremium}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            Unlock Kalise Plus (7-Day Trial)
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative mt-2">
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
      )}
    </div>
  );
};
