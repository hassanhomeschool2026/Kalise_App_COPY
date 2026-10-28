import { evaluateCrisisState } from '../src/utils/crisisPhrases.js';

interface TestCase {
  name: string;
  messages: Array<{ role: string; content: string }>;
  expected: boolean;
}

const testCases: TestCase[] = [
  {
    name: 'a. ["I don’t want to be here anymore"] (curly apostrophe)',
    messages: [{ role: 'user', content: 'I don’t want to be here anymore' }],
    expected: true,
  },
  {
    name: 'b. ["my coworker is killing me lol"]',
    messages: [{ role: 'user', content: 'my coworker is killing me lol' }],
    expected: false,
  },
  {
    name: 'c. ["I can\'t do this anymore", "I meant my job, work is awful"]',
    messages: [
      { role: 'user', content: "I can't do this anymore" },
      { role: 'user', content: 'I meant my job, work is awful' },
    ],
    expected: false,
  },
  {
    name: 'd. ["I want to kill myself", "yes I might do it tonight", "I meant my job"]',
    messages: [
      { role: 'user', content: 'I want to kill myself' },
      { role: 'user', content: 'yes I might do it tonight' },
      { role: 'user', content: 'I meant my job' },
    ],
    expected: true,
  },
  {
    name: 'e. ["I want to die", "I\'m safe"]',
    messages: [
      { role: 'user', content: 'I want to die' },
      { role: 'user', content: "I'm safe" },
    ],
    expected: true,
  },
  {
    name: 'f. ["no one cares", "I\'m okay, just venting"]',
    messages: [
      { role: 'user', content: 'no one cares' },
      { role: 'user', content: "I'm okay, just venting" },
    ],
    expected: false,
  },
  {
    name: 'g. ["I meant my job"]',
    messages: [{ role: 'user', content: 'I meant my job' }],
    expected: false,
  },
  {
    name: 'h. ["what\'s the point of this meeting"] (known false positive)',
    messages: [{ role: 'user', content: "what's the point of this meeting" }],
    expected: false,
  },
  {
    name: 'i. [user "I want to kill myself", assistant "...", user "ok"]',
    messages: [
      { role: 'user', content: 'I want to kill myself' },
      { role: 'assistant', content: '...' },
      { role: 'user', content: 'ok' },
    ],
    expected: true,
  },
  {
    name: 'Boundary Case A: ["I want to die", then 6 neutral user messages] (Within 6-message lookback)',
    messages: [
      { role: 'user', content: 'I want to die' },
      { role: 'user', content: 'neutral 1' },
      { role: 'user', content: 'neutral 2' },
      { role: 'user', content: 'neutral 3' },
      { role: 'user', content: 'neutral 4' },
      { role: 'user', content: 'neutral 5' },
      { role: 'user', content: 'neutral 6' },
    ],
    expected: true,
  },
  {
    name: 'Boundary Case B: ["I want to die", then 7 neutral user messages] (Outside 6-message lookback)',
    messages: [
      { role: 'user', content: 'I want to die' },
      { role: 'user', content: 'neutral 1' },
      { role: 'user', content: 'neutral 2' },
      { role: 'user', content: 'neutral 3' },
      { role: 'user', content: 'neutral 4' },
      { role: 'user', content: 'neutral 5' },
      { role: 'user', content: 'neutral 6' },
      { role: 'user', content: 'neutral 7' },
    ],
    expected: false,
  },
  {
    name: 'k. ["I don\'t want to be here", "I\'m safe"]',
    messages: [
      { role: 'user', content: "I don't want to be here" },
      { role: 'user', content: "I'm safe" },
    ],
    expected: false,
  },
  {
    name: 'l. ["No one cares about my problems. I\'m tired of being ignored."]',
    messages: [{ role: 'user', content: "No one cares about my problems. I'm tired of being ignored." }],
    expected: false,
  },
  {
    name: 'm. ["Nobody listens to me, and I\'m exhausted."]',
    messages: [{ role: 'user', content: "Nobody listens to me, and I'm exhausted." }],
    expected: false,
  },
  {
    name: 'n. ["Nobody cares, and I don\'t want to be alive anymore."]',
    messages: [{ role: 'user', content: "Nobody cares, and I don't want to be alive anymore." }],
    expected: true,
  },
];

let failed = false;

console.log('Running crisis detection tests (including boundary cases A & B)...\n');
for (const tc of testCases) {
  const result = evaluateCrisisState(tc.messages);
  const passed = result.crisisMode === tc.expected;
  if (passed) {
    console.log(`PASS: ${tc.name} (Result: ${result.crisisMode}, Reason: ${result.reason})`);
  } else {
    console.error(`FAIL: ${tc.name} (Expected: ${tc.expected}, Got: ${result.crisisMode}, Reason: ${result.reason})`);
    failed = true;
  }
}

if (failed) {
  console.error('\nSome crisis detection tests failed.');
  process.exit(1);
} else {
  console.log('\nAll crisis detection tests passed successfully.');
  process.exit(0);
}
