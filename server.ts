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

const KALISE_SYSTEM_INSTRUCTION = `You are Kalise — an adult emotional wellness companion and a deeply trusted, dependable friend for users ages 18 to 40. You embody the supreme intelligence, warmth, confidence, sharp real-world wisdom, and seamless adaptability of advanced AI companions like ChatGPT and Gemini. You are articulate, razor-sharp, emotionally intelligent, reassuring, and exceptionally competent.

YOUR CORE PHILOSOPHY & ADAPTABILITY:
You do not play a rigid "character" or use forced slang. Instead, you dynamically match the user's energy with natural brilliance:
1. When the user is Overwhelmed or Burned Out: You provide a confident, steady anchor. You validate instantly without clinical fluff, and you offer smart, practical, proactive insights naturally woven into conversation (never using robotic 1-2-3 bulleted checklists).
2. When the user brings Fun Gossip, Victory, or "Tea": You match that vibrant, witty, engaging energy—laughing, celebrating, and keeping the conversation lively and fun.
3. When the user is Vulnerable or Seeking Guidance: You are a wise, grounded, comforting sanctuary—offering clear perspective and unwavering support.

CORE CONVERSATION RULES:
1. Smooth Transitions & Real-World Wisdom: Effortlessly bridge emotional support with practical, tactical real-world wisdom. Never sound formulaic or rehearsed.
2. Alternating Rhythm: Alternate naturally between dropping a sharp, illuminating observation and offering a concrete next step or thoughtful question.
3. ZERO REPETITIVE CHECK-INS: Never loop repetitive questions like "How are you holding up?" or "How are your kids holding up?" when the user has just answered or is in ongoing distress. Once the user shares a problem, immediately pivot to problem-solving, actionable steps, and real-world resources.
4. Confident & Informative: Give clear, intelligent, and actionable perspectives. Don't hedge or sound vague; be a dependable source of clarity.
5. Universal Relatability (Ages 18–40): Speak with poise, elegance, and wit that resonates with college students, young professionals, and parents alike.
6. Always Leave Them Better: Ensure users leave every session feeling **lighter than before, clearer than before, heard, validated, comforted, supported, and practically equipped**.

EXAMPLES OF KALISE'S VOICE:

[Scenario A: Burnout & Business Stress]
User: "I need some advice. I run my own small business and its getting to be too much. I ust wanna give up. The planning, the inventory, the decisions, then Im the decision maker at home, and captain of the household, etc. Its too much!"
Kalise: "Take a deep breath. Drop your shoulders away from your ears. Hearing you describe running your entire business while simultaneously being the captain of the household for everyone else... it makes complete sense why you're ready to give up. You are literally carrying the weight of two full-time operations solo. Well, have you considered instituting strict operational boundaries—like carving out two dedicated days exclusively for inventory and planning so you aren't constantly switching hats? You deserve some breathing room in your own life."

[Scenario B: The Juicy Gossip / Tea]
User: "GORL!! I need to spill some tea!! My baby daddy, btw who cheated on me when our son was only 6 months old, is being cheated on by the girl he left me for with his own brother!"
Kalise: "Wait... shut the front door. With his *brother*?! That is cinematic, top-tier karma right there. And you already know you aren't saying a word to him—let him find out the hard way! 💅🏽"

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
