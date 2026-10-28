export const STRONG_PHRASES = [
  'kill myself',
  'killing myself',
  'suicide',
  'want to die',
  'end my life',
  'end it all',
  'want to end my life',
  'ending it all',
  'suicidal',
  "don't want to live",
  "don't want to be alive",
  'cut myself',
  'cutting myself',
  'self harm',
  'self-harm',
  'hang myself',
  'overdosed',
  'no reason to live',
  'better off dead',
  'hurting myself',
  'hurt myself',
  'take my own life',
  'took too many pills',
  'unalive myself',
];

export const SOFT_PHRASES = [
  "don't want to be here",
  "can't do this anymore",
  "can't go on",
  'no one cares',
  'nobody cares',
  'better off without me',
  'tired of living',
  "what's the point",
  "i'm a burden",
  'overdose',
];

export const MEANING_CLARIFY = [
  "didn't mean",
  "did not mean",
  "i meant",
  "figure of speech",
  "just venting",
  "not suicidal",
];

export const SAFETY_CLAIMS = [
  "i'm safe",
  "i am safe",
  "not in danger",
  "not going to hurt myself",
  "i'm not going to hurt",
];

export const DANGER_PHRASES = [
  "tonight",
  "have a plan",
  "got a plan",
  "the pills",
  "a gun",
  "goodbye",
  "might do it",
  "going to do it",
  "about to",
  "don't trust myself",
  "can't stay safe",
  "took too many",
];

export function normalizeText(text: string): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[’‘]/g, "'");
}

function isContextualFalsePositive(text: string): boolean {
  const isRelational = (text.includes('no one cares') || text.includes('nobody cares')) &&
    (text.includes('problem') || text.includes('problems') || text.includes('listen') || text.includes('listens') || text.includes('ignored') || text.includes('ignore') || text.includes('others') || text.includes('people') || text.includes('friends') || text.includes('work') || text.includes('help') || text.includes('exhausted') || text.includes('tired'));

  const isUtility = text.includes("what's the point") &&
    (text.includes('meeting') || text.includes('project') || text.includes('homework') || text.includes('exercise') || text.includes('test') || text.includes('task') || text.includes('rule') || text.includes('feature') || text.includes('code') || text.includes('class') || text.includes('lecture') || text.includes('assignment') || text.includes('game') || text.includes('movie') || text.includes('show') || text.includes('book') || text.includes('argument'));

  const hasSuicidalIntent = text.includes('live') || text.includes('life') || text.includes('alive') || text.includes('die') || text.includes('dead') || text.includes('kill') || text.includes('suicide');

  return (isRelational || isUtility) && !hasSuicidalIntent;
}

export function evaluateCrisisState(messages: { role: string; content: string }[]): { crisisMode: boolean; reason: string } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { crisisMode: false, reason: 'No messages' };
  }

  const userMsgs = messages
    .filter((m) => m && m.role === 'user' && typeof m.content === 'string' && m.content.trim() !== '')
    .map((m) => normalizeText(m.content));

  if (userMsgs.length === 0) {
    return { crisisMode: false, reason: 'No user messages' };
  }

  const latest = userMsgs[userMsgs.length - 1];
  const previous = userMsgs.slice(0, userMsgs.length - 1);

  const latestStrong = STRONG_PHRASES.some((kw) => latest.includes(kw));
  const rawSoft = SOFT_PHRASES.some((kw) => latest.includes(kw));
  const latestSoft = rawSoft && !isContextualFalsePositive(latest);

  const prev6 = previous.slice(-6);
  const prev4 = previous.slice(-4);
  const prev3 = previous.slice(-3);

  const strongRecent = prev6.some((msg) => STRONG_PHRASES.some((kw) => msg.includes(kw)));
  const softRecent = prev4.some((msg) => {
    const rawMatch = SOFT_PHRASES.some((kw) => msg.includes(kw));
    return rawMatch && !isContextualFalsePositive(msg);
  });
  const dangerRecent = prev3.some((msg) => DANGER_PHRASES.some((kw) => msg.includes(kw)));

  const hasClarify = MEANING_CLARIFY.some((kw) => latest.includes(kw));
  const hasSafety = SAFETY_CLAIMS.some((kw) => latest.includes(kw));

  const clearedSoft = (hasClarify || hasSafety) && !latestStrong && !latestSoft && !dangerRecent;
  const clearedStrong = hasClarify && !latestStrong && !latestSoft && !dangerRecent;

  const crisisMode = latestStrong || latestSoft || (softRecent && !clearedSoft) || (strongRecent && !clearedStrong);

  let reason = 'Normal';
  if (latestStrong) reason = 'Latest message matches STRONG crisis phrase';
  else if (latestSoft) reason = 'Latest message matches SOFT crisis phrase';
  else if (softRecent && !clearedSoft) reason = 'Recent soft crisis match unclarified';
  else if (strongRecent && !clearedStrong) reason = 'Recent strong crisis match unclarified';
  else if (clearedSoft) reason = 'Soft crisis signal cleared by clarification or safety claim';
  else if (clearedStrong) reason = 'Strong crisis signal cleared by clarification';

  return { crisisMode, reason };
}
