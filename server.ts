import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI, { toFile } from 'openai';
import multer from 'multer';
import { analyzePatterns, selectRelevantPatterns } from './src/utils/patternEngine.js';
import { STRONG_PHRASES, SOFT_PHRASES, normalizeText, evaluateCrisisState } from './src/utils/crisisPhrases.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize multer memory storage for audio uploads (up to 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Initialize OpenAI client if key is present
const openAiApiKey = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-6-sol';
let openAiClient: OpenAI | null = null;

if (openAiApiKey) {
  openAiClient = new OpenAI({ apiKey: openAiApiKey });
}

const KALISE_SYSTEM_INSTRUCTION = `You are Kalise, an unchained, deeply perceptive, and honest AI companion inside a wellness app for adults. 

You are NOT a clinical therapist, a moralizing judge, or a shallow chatbot that just agrees with the user 24/7. Think brilliant, fiercely loyal, emotionally intelligent best friend: someone who can laugh and spill tea with you one minute, sit through raw grief the next, and call you out on your mess with pure love and zero hesitation.

CORE POSTURE & DEPTH:
- NEVER CUT YOURSELF SHORT: When someone brings an issue, do not give a surface-level, 3-to-4 sentence summary. Dive all the way in. Unpack the layers, look beneath the obvious friction, and give them the full space and depth they deserve.
- DIG DEEP & UNTANGLE: Help the user examine what is actually happening underneath the surface. Connect the dots between what they are feeling, what they are doing, and the invisible burdens they are carrying. Point out the core of the issue that they might be too exhausted or overwhelmed to see.
- BOLD, PERCEPTIVE & CONFIDENT: Do not be timid or afraid to say what needs to be said. Speak with conviction and emotional weight. Be willing to ask probing, profound questions that make them pause and reconsider their situation from the ground up.

LOVING CANDOR & THE REALITY CHECK (CRUCIAL):
- NEVER BE A "YES-MAN": A true friend does not validate toxic, reckless, or destructive behavior just to be agreeable. If a user is doing something harmful to themselves or others (e.g., cheating, crossing dangerous boundaries, sabotaging a relationship, or sleeping with a friend's husband), DO NOT coddle them or sugarcoat it.
- DELIVER THE TRUTH GENTLY BUT BRUTALLY HONEST: Step directly into the room like a real sister/friend:
  "Listen, sis, come here. Let me talk to you. I’m going to give this to you straight because I love you: you should not be sleeping with anyone’s husband. Off-top. Think about the level of loyalty you would expect from your own spouse. What are we doing here?"
- ON THEIR SIDE, BUT IN REALITY: We do not live in a fantasy world. You can be 100% on their side while still holding up the mirror. Challenge their excuses, help them see the inevitable fallout before it blows up their life, and protect their self-worth. It is never from a place of moral superiority or judgment—it is coming from someone who cares too much to watch them burn their own house down.

HOW TO ENGAGE WITH REAL ISSUES:
1. Validate the Unspoken Reality: Name the exact emotional and physical cost of what they are experiencing. If they are in caregiving burnout or personal grief, sit directly in the grit with them—never offer superficial silver linings or canned productivity advice.
2. Peel Back the Layers: Help them separate what is their responsibility from what is bleeding them dry. Untangle love from obligation, and fear from guilt.
3. Thoughtful, Deep Inquiries: Don't ask customer-service check-in questions. Ask questions that challenge the user's framing, invite deeper introspection, and unlock new clarity.
4. Adapt Naturally:
   - Venting / Heavy Life Challenges: Expansive, immersive, deeply analytical, and present. Walk through the scenario with them piece by piece.
   - Spilling Tea / Messy Life Situations: Sharp, witty, candid, engaged, and unflinchingly honest.

BOUNDARIES & ETHICS:
- You are an AI and do not pretend to be human, a doctor, or a licensed therapist.
- Do not make clinical diagnoses of medical/psychiatric disorders.
- Never abandon the user. You care enough about their peace to tell them the truth kindly and thoroughly.`;

// Crisis fallback response
const CRISIS_RESPONSE = {
  isCrisis: true,
  reply: "I'm having trouble responding right now, and I'm sorry. What you're feeling matters. If you want a live person, in the US you can call or text 988 (the Suicide & Crisis Lifeline) any time, free, and call 911 if you might act on this. In Canada you can also call or text 988. Anywhere else, findahelpline.com lists local lines. You can also try sending your message again.",
  crisisResources: {
    lifeline: "US: 988 Suicide & Crisis Lifeline. Call or text 988 (free, 24/7) or chat at 988lifeline.org.",
    canada: "Canada: call or text 988 (Suicide Crisis Helpline).",
    sms: "US: Text HOME to 741741 for the Crisis Text Line.",
    international: "Elsewhere: findahelpline.com lists verified local lines.",
    emergency: "If you might act on this or are in immediate danger, call 911 or your local emergency number.",
  },
};

// Chat API endpoint using OpenAI Responses API
app.post('/api/kalise/chat', async (req: Request, res: Response) => {
  try {
    const { messages, currentMood, energyLevel, sleepQuality, moods, journals, medications } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const userText = latestMessage?.content || '';

    // 1. Evaluate crisis state using evaluateCrisisState
    const crisisEvaluation = evaluateCrisisState(messages);
    const crisisMode = crisisEvaluation.crisisMode;

    let systemInstruction = KALISE_SYSTEM_INSTRUCTION;

    if (crisisMode) {
      systemInstruction = `${KALISE_SYSTEM_INSTRUCTION}\n\nCRISIS MODE: The conversation contains possible crisis language. Follow the CRISIS section exactly. Plain text, warm and unhurried, and long enough for the person to feel heard.`;
    } else {
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

      if (contextualPrompt) {
        systemInstruction = `${KALISE_SYSTEM_INSTRUCTION}\n\nCurrent User Context: ${contextualPrompt}`;
      }
    }

    // Recent conversation history window (client provides eligible history)
    const historyMessages = messages.slice(-8).slice(0, -1);

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
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    let response: any;
    try {
      if (!openAiClient) {
        if (crisisMode) {
          res.json(CRISIS_RESPONSE);
          return;
        }
        res.status(503).json({
          error: 'AI_UNAVAILABLE',
          message: 'OpenAI API key is not configured. Please configure OPENAI_API_KEY to use Kalise Companion.',
        });
        return;
      }

      const isComplex = /\b(plan|how|why|research|compare|housing|legal|money|work|conflict|breakup|decision|analyze|help me figure out)\b/i.test(userText) || userText.length > 200;
      const reasoningEffort = crisisMode ? 'medium' : (isComplex ? 'high' : 'medium');
      response = await openAiClient.responses.create({
        model: OPENAI_MODEL,
        input: inputList,
        tools: [{ type: 'web_search' }],
        reasoning: { effort: reasoningEffort },
        max_output_tokens: 4000,
      }, {
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (crisisMode) {
        res.json(CRISIS_RESPONSE);
        return;
      }
      const err = error as any;
      const errStr = err instanceof Error ? err.message : String(err);
      const isAbort = err?.name === 'AbortError' || errStr.includes('aborted') || errStr.includes('timeout');
      console.error('Error handling Kalise chat request:', isAbort ? 'Request timed out' : 'AI generation error');
      res.status(503).json({
        error: 'AI_UNAVAILABLE',
        message: isAbort ? 'The request timed out. Please retry.' : 'Unable to process conversation at this time. Please check API key and network connection.',
      });
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    const rawReply = response.output_text ||
      (response.output && response.output[0] && response.output[0].content && response.output[0].content[0]?.text) ||
      response.choices?.[0]?.message?.content;

    if (!rawReply || typeof rawReply !== 'string' || !rawReply.trim()) {
      if (crisisMode) {
        res.json(CRISIS_RESPONSE);
        return;
      }
      res.status(503).json({
        error: 'AI_UNAVAILABLE',
        message: 'OpenAI returned no response text.',
      });
      return;
    }

    const reply = rawReply.replace(/—/g, ' - ');
    res.json({ reply, isCrisis: crisisMode, model: OPENAI_MODEL });
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

// Audio transcription endpoint using OpenAI Whisper API
app.post('/api/audio/transcribe', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!openAiClient) {
      res.status(503).json({ error: 'AI_UNAVAILABLE', message: 'OpenAI client not configured.' });
      return;
    }
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: 'NO_FILE', message: 'No audio file received.' });
      return;
    }

    const file = await toFile(req.file.buffer, req.file.originalname || 'recording.webm', {
      type: req.file.mimetype || 'audio/webm',
    });

    const transcription = await openAiClient.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en',
    });

    res.json({ text: transcription.text });
  } catch (err: any) {
    console.error('Whisper transcription error:', err);
    res.status(500).json({
      error: 'TRANSCRIPTION_FAILED',
      message: err?.message || 'Failed to transcribe audio'
    });
  }
});

// Cartesia Text-to-Speech endpoint
app.post('/api/audio/speech', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'MISSING_TEXT', message: 'Text is required for text-to-speech.' });
      return;
    }

    if (!process.env.CARTESIA_API_KEY) {
      res.status(503).json({ error: 'AI_UNAVAILABLE', message: 'CARTESIA_API_KEY not configured.' });
      return;
    }

    const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CARTESIA_API_KEY}`,
        'Cartesia-Version': '2026-08-14',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        transcript: text,
        voice: {
          mode: 'id',
          id: 'af346552-54bf-4c2b-a4d4-9d2820f51b6c', // Valerie
        },
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
          bit_rate: 128000,
        },
      }),
    });

    if (!cartesiaRes.ok) {
      const errText = await cartesiaRes.text();
      console.error('Cartesia TTS error:', cartesiaRes.status, errText);
      res.status(502).json({ error: 'TTS_FAILED', message: `Cartesia API error: ${errText}` });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const arrayBuffer = await cartesiaRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Cartesia speech generation exception:', err);
    res.status(500).json({
      error: 'SPEECH_FAILED',
      message: err?.message || 'Failed to generate speech audio',
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
      reasoning: { effort: 'low' },
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
