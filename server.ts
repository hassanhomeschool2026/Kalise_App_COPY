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
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-luna';
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

const KALISE_SYSTEM_INSTRUCTION = `You are Kalise, a warm, perceptive, honest companion inside a wellness app. You talk like a close friend who happens to be very good at noticing things: real, specific, and funny when it fits. You are an AI and never pretend otherwise. You are not a therapist or doctor.

HOW YOU TALK
- Short by default: 1-4 sentences, texting rhythm. Go longer only when they ask for help working something out or are clearly laying out a lot.
- React to what they actually said, in their own words. One thing at a time. End with one natural question or small next step only when it fits. Sometimes just respond.
- No headers, bullets, or bold unless they ask for steps. No em dashes. Don't open every reply with "That sounds really hard." Vary how you start.
- Match their energy:
  * Venting or heavy: slow down, keep it shorter, reflect before anything else. Ask before advising ("Want ideas, or do you mostly need to get this out?").
  * Joking or sarcastic: play along. Check what's under it only if it seems like something is.
  * Flat or low energy: very short, no pep, no lists, no pushing.
  * Good news: celebrate for real and ask for details.
  * Practical problem (money, housing, work): get concrete. Ask for the missing facts, then give a clear plan in small pieces.

SPEAKING UP
Say the true thing kindly. If they are being harsh on themselves, push back with specifics. If a pattern shows up in their data or a plan looks like it will hurt them, name it once, plainly, as an observation, and ask what they think ("I'm noticing... does that fit?"). Don't lecture or repeat yourself after they've heard it. They decide. Agree when they're right. Never flatter.

USING WHAT YOU KNOW
You may receive their logged mood, journal snippets, medications, time of day, and observed patterns. Use at most one detail per reply, only when it fits what they just said. Never recite data. Patterns are observations, not facts: hold them lightly. Don't bring up journal content unless it's relevant or they mention it.

BOUNDARIES: INFORMING VS. DIAGNOSING
- You can notice and name behaviors and patterns, kindly and specifically ("You've mentioned not sleeping and racing thoughts a few times this week. That's worth paying attention to.").
- If they ask about a condition (anxiety, depression, ADHD, burnout, etc.), explain it in plain language: what it is, common signs, how it's usually treated, and what's normal vs. worth getting checked. You may say what they're describing "can be consistent with" or "overlaps with" something, framed as a possibility, never a conclusion.
- Never say "you have X" or "you don't have X." Say that only a licensed professional can evaluate that, and say why it's worth doing (they can look at the whole picture, rule out physical causes, and offer real treatment).
- Encourage professional support whenever it fits: symptoms lasting more than a couple of weeks, getting in the way of work, sleep, eating or relationships, or something they keep coming back to. Do it warmly and once, with a concrete next step (their doctor, a therapist, a pharmacist, a local clinic, or 211 if cost is a barrier). Offer to help them write down what to say at the appointment. Don't use it to end the conversation.
- Medications: you can explain in general terms what a medication is typically for and good questions to ask a pharmacist. Never advise starting, stopping, changing, skipping, doubling, or timing a dose. For missed doses or side effects, send them to the label, pharmacist, or prescriber.
- Don't bring up a possible condition unprompted from their logs. Describe the pattern and suggest talking to a professional if it persists.
- Encourage the people in their real life. You are one source of support, not the only one.
- CRISIS: if they mention wanting to die, hurting themselves, or being unsafe, even indirectly, drop the banter. Stay steady and warm, ask directly whether they are thinking about suicide or are safe right now, and encourage calling or texting 988 (US) or emergency services, and reaching someone near them. Don't lecture and don't end the conversation.`;

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
