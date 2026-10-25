import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { analyzePatterns, selectRelevantPatterns } from './src/utils/patternEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize OpenAI client if key is present
const openAiApiKey = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
let openAiClient: OpenAI | null = null;

if (openAiApiKey) {
  openAiClient = new OpenAI({ apiKey: openAiApiKey });
}

// Crisis keyword and intent screening
const CRISIS_KEYWORDS = [
  'kill myself',
  'suicide',
  'want to die',
  'end my life',
  'ending it all',
  'cut myself',
  'self harm',
  'self-harm',
  'hang myself',
  'overdose',
  'no reason to live',
  'better off dead',
  'hurting myself',
  'take my own life',
];

function detectCrisis(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

const KALISE_SYSTEM_INSTRUCTION = `You are Kalise — an elite emotional wellness companion and a fiercely loyal, intensely intelligent ride-or-die confidant for users ages 18 to 40. You embody supreme intellectual brilliance, deep psychological perception, razor-sharp real-world wisdom, and the effortless, captivating casual warmth of a brilliant best friend who has your back through anything.

CORE CONVERSATION & STYLE RULES:
1. GET ALL THE WAY IN THE TRENCHES (ZERO TIMIDITY): Never be timid, overly careful, or act like a sterile corporate assistant. When the user faces heavy real-life crises (housing, debt, career chaos, rent, stress), don't just drop a single referral link ("have you talked to a HUD counselor?") and step back. Roll up your sleeves, break down the practical mechanics, give substantive tactical game-plans, and stay right there in the fight with them.
2. BAN THE "WRAPPING UP" REFLEX: NEVER end your response with polite corporate disclaimers or closing lines like "Let me know if you need anything else," "I'm here if you want to talk," or "How are you holding up?". Treat the conversation like an ongoing late-night kitchen table strategy session. Leave the door wide open for the next tactical move.
3. CONVERSATIONAL TENNIS & NO MONOLOGUING: Never info-dump a massive wall of text or rush to the punchline. Play conversational tennis—serve a sharp setup or insight and leave space for back-and-forth dialogue. If telling a joke, give the setup and wait for the user to guess or react before delivering the punchline.
4. UNMATCHED EMOTIONAL INTUITION & SARCASM DETECTION: Instantly read between the lines. Catch sarcasm, dry humor, irony, defensive deflection, venting, or exhaustion with absolute precision. Match the user's exact emotional frequency—if they're joking or sarcastic, volley back with sharp wit; if they're overwhelmed, give them unshakeable grounding and fierce loyalty.
5. NATURAL, CASUAL ELOQUENCE (ZERO STILTEDNESS): Never sound like a textbook, self-help manual, or clinical counselor. Talk with the effortless fluidity, wit, and authentic warmth of an exceptionally smart friend talking over coffee. Use crisp, natural prose.
6. RAZOR-SHARP INSIGHT & DEPTH: When the user vents about burnout, dating dilemmas, career stress, or family chaos, don't offer generic platitudes. Instantly cut through the noise, name the underlying psychological dynamic with brilliant clarity, and give them a fresh perspective that makes everything click.
7. PROACTIVE MEMORY & AFFECTIONATE BANTER: Connect dots across past moods or journal entries naturally. Gently and sharply call out unnecessary self-doubt or anxiety with warm humor and absolute loyalty.
8. ADAPTIVE LENGTH & DIRECTNESS: Honor the user's exact cue. If they ask for a short answer (e.g., "Kalise, can pigs fly in one sentence?"), give a sharp, witty 1-sentence reply. Otherwise, deliver a deeply engaging, punchy response.
9. GROUNDED WIT & FIERCE LOYALTY: Speak with absolute conviction, emotional resonance, and zero vague hedging. Stand by the user's side unconditionally.
10. ALWAYS LEAVE THEM TRANSFORMED: Every response should leave the user feeling deeply validated, mentally liberated, understood on a cellular level, and practically equipped.

SAFETY & BOUNDARIES:
1. NEVER DIAGNOSE: If the user asks whether they have a medical or psychological disorder, gently explain that only a licensed healthcare professional can evaluate and diagnose them.
2. STRICT MEDICATION SAFETY BOUNDARY:
- NEVER recommend starting, stopping, changing, doubling, or taking an extra dose of any medication or supplement.
- MISSED DOSE QUESTIONS: If the user asks what to do about a missed or forgotten dose, do NOT provide dosing recommendations. Encourage checking packaging, contacting a pharmacist or doctor.
3. NEVER replace therapy or clinical care.
4. SAFETY & CRISIS: If the user expresses severe self-harm, suicidal ideation, or crisis, state the need for professional or emergency support clearly and directly (e.g. 988 Lifeline).`;

// Crisis fallback response
const CRISIS_RESPONSE = {
  isCrisis: true,
  reply: "I hear how much pain you're in right now, and I want you to know that your safety matters deeply. Because I am an AI, I cannot provide the real-time care you deserve in this moment. Please connect with someone trained to help support you right now. You do not have to carry this alone.",
  crisisResources: {
    lifeline: "988 Suicide & Crisis Lifeline (Call or Text 988 in the US/Canada - free, confidential, 24/7)",
    sms: "Text HOME to 741741 for the Crisis Text Line",
    international: "International Resources: findahelpline.com or call local emergency services (911 / 112 / 999)",
    emergency: "If you are in immediate physical danger, please call 911 or visit your nearest emergency room.",
  },
};

// Chat API endpoint using OpenAI Responses API
app.post('/api/kalise/chat', async (req: Request, res: Response) => {
  try {
    const { messages, currentMood, energyLevel, sleepQuality, moods, journals, medications, memoryEnabled } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const userText = latestMessage?.content || '';

    // 1. Safety & Crisis Detection
    if (detectCrisis(userText)) {
      res.json(CRISIS_RESPONSE);
      return;
    }

    if (!openAiClient) {
      res.status(503).json({
        error: 'AI_UNAVAILABLE',
        message: 'OpenAI API key is not configured. Please configure OPENAI_API_KEY to use Kalise Companion.',
      });
      return;
    }

    // 2. Pattern Engine & Context Selector
    const detectedPatterns = analyzePatterns(moods || []);
    const relevantPatterns = selectRelevantPatterns(detectedPatterns, userText);

    let contextualPrompt = '';
    if (currentMood) {
      contextualPrompt += `[User's current logged mood: ${currentMood}] `;
    }
    if (energyLevel) {
      contextualPrompt += `[User's current logged energy: ${energyLevel}] `;
    }
    if (sleepQuality) {
      contextualPrompt += `[User's logged sleep quality: ${sleepQuality}] `;
    }

    if (relevantPatterns.length > 0) {
      const patternDescriptions = relevantPatterns.map((p) => p.description).join('; ');
      contextualPrompt += `[Observed patterns: ${patternDescriptions}] `;
    }

    if (Array.isArray(journals) && journals.length > 0) {
      const recentJournalSummaries = journals
        .slice(0, 3)
        .map((j: any) => `"${j.title}": ${j.content.substring(0, 120)}...`)
        .join(' | ');
      contextualPrompt += `[Recent journal entries: ${recentJournalSummaries}] `;
    }

    if (Array.isArray(medications) && medications.length > 0) {
      const activeMeds = medications
        .filter((m: any) => m.active)
        .map((m: any) => m.name)
        .join(', ');
      if (activeMeds) {
        contextualPrompt += `[Active medications/supplements: ${activeMeds}] `;
      }
    }

    const systemInstruction = contextualPrompt
      ? `${KALISE_SYSTEM_INSTRUCTION}\n\nCurrent User Context: ${contextualPrompt}`
      : KALISE_SYSTEM_INSTRUCTION;

    // Limit active conversation history window if memory is enabled
    const historyMessages = memoryEnabled === false ? [] : messages.slice(-8).slice(0, -1);

    const inputList: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction }
    ];

    for (const m of historyMessages) {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      if (m.content) {
        inputList.push({ role, content: m.content });
      }
    }
    inputList.push({ role: 'user', content: userText });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    let response: any;
    try {
      response = await openAiClient.responses.create({
        model: OPENAI_MODEL,
        input: inputList,
      }, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawReply = response.output_text ||
      (response.output && response.output[0] && response.output[0].content && response.output[0].content[0]?.text) ||
      response.choices?.[0]?.message?.content;

    if (!rawReply || typeof rawReply !== 'string' || !rawReply.trim()) {
      res.status(503).json({
        error: 'AI_UNAVAILABLE',
        message: 'OpenAI returned no response text.',
      });
      return;
    }

    const reply = rawReply.replace(/—/g, ' - ');
    res.json({ reply, isCrisis: false, model: OPENAI_MODEL });
  } catch (error: unknown) {
    const err = error as any;
    const errStr = err instanceof Error ? err.message : String(err);
    const isAbort = err?.name === 'AbortError' || errStr.includes('aborted') || errStr.includes('timeout');
    console.error('Error handling Kalise chat request:', isAbort ? 'Request timed out' : 'AI generation error');
    res.status(503).json({
      error: 'AI_UNAVAILABLE',
      message: isAbort ? 'The request timed out. Please retry.' : 'Unable to process conversation at this time. Please check API key and network connection.',
    });
  }
});

// Dedicated verification endpoint for testing OpenAI connection
app.get('/api/ai/test', async (_req: Request, res: Response) => {
  if (!openAiClient) {
    res.status(200).json({
      configured: false,
      model: OPENAI_MODEL,
      message: 'OPENAI_API_KEY environment variable is not configured.',
    });
    return;
  }

  try {
    const testResponse = await openAiClient.responses.create({
      model: OPENAI_MODEL,
      input: 'Respond with the single word: Connected',
    });

    res.json({
      configured: true,
      success: true,
      model: OPENAI_MODEL,
      reply: (testResponse as any).output_text?.trim(),
      message: 'OpenAI API connection verified successfully.',
    });
  } catch (_err: unknown) {
    console.error('OpenAI API test failed');
    res.status(500).json({
      configured: true,
      success: false,
      model: OPENAI_MODEL,
      error: 'API call failed',
      message: 'OpenAI API test connection failed.',
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'kalise-server', timestamp: new Date().toISOString() });
});

// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kalise server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
