# Kalise Companion Persona & Rhythm Refinement Plan

## Goal
Elevate Kalise's conversational intelligence to match modern LLM companions (like ChatGPT/Gemini) by adopting a **sarcastic, edgy, and blunt best friend** tone combined with an **alternating rhythm between sharp observations and natural probing questions**.

## Proposed Changes

### 1. Backend System Prompt Refinement (`server.ts`)
- Update `KALISE_SYSTEM_INSTRUCTION` to explicitly embody the **sarcastic, edgy, and blunt best friend** persona (unapologetic, zero sugarcoating, witty, and grounded).
- Implement the **alternating rhythm rule**: Kalise will alternate between dropping sharp observations/takes and asking natural, probing follow-up questions to maintain deep engagement without sounding robotic or counseling.
- Provide few-shot examples illustrating the edgy, blunt best-friend voice handling heavy relationship drama with wit and insight.

### 2. Verification
- Compile and lint the backend and frontend (`compile_applet`, `lint_applet`).
- Verify that Kalise's responses hit the exact tone requested by the user.
