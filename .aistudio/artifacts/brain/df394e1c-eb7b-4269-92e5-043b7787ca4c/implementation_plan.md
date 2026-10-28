# Refined Session-Scoped Memory Implementation Plan

## Overview
This plan implements session-scoped conversation memory when "Memory" is toggled OFF, while strictly preserving full conversation history in storage, exports, and when Memory is ON.

## Detailed Answers to User Refinement Points
1. **Idempotent Legacy Message Migration**:
   - When loading chat history (`getChatHistory`), any legacy message lacking a `sessionId` will be assigned a fallback session ID (e.g., `'legacy-session'`).
   - Migration logic will be strictly idempotent: repeated calls to `getChatHistory()` will **never** overwrite existing valid `sessionId`s on messages that already have one. All existing message content and history are fully preserved.

2. **Runtime Session ID Lifecycle**:
   - A runtime session ID (`sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`) is generated once when the app mounts.
   - This active `sessionId` is passed when creating new user messages, assistant responses, local fallback responses (on API failure), and retry flows, ensuring every message created during the active browser session shares the exact same session ID.

3. **Memory OFF & Page Refresh Behavior**:
   - When `memoryEnabled` is `false`, the model payload sent to the backend includes only messages matching the current active session ID.
   - Upon a page refresh or app restart, a new active session ID is generated. Consequently, prior-session messages are excluded from the model payload.
   - **Important**: Stored records in `localStorage` and export features are **never** deleted or hidden. Stored history remains intact. The active chat view starts fresh for the new session, clearly distinguishing between stored history and active conversation context.

4. **Memory ON Behavior**:
   - When `memoryEnabled` is `true`, all stored chat messages across all sessions are included in the model payload, preserving current cross-session history behavior.

5. **Data Retention & Privacy Safeguards**:
   - This toggle strictly controls which chat messages are included in the LLM request payload. It does not delete history, disable local storage, remote sync, or retention.
   - Mood, journal, and medication data flows remain completely untouched.

6. **File Scope & Verification**:
   - **Files to Modify**:
     1. `src/types/index.ts`: Add optional `sessionId?: string` to `ChatMessage`.
     2. `src/services/storage.ts`: Update chat loading/saving to support idempotent `sessionId` assignment.
     3. `src/App.tsx`: Manage active `sessionId`, pass it to new messages/fallbacks/retries, and filter chat history sent to the backend based on `memoryEnabled`.
   - **Verification**: Run `npm run build`, `npx tsc --noEmit`, and `npx tsx scripts/test-crisis-detection.ts`. Test memory ON/OFF across multi-turn conversations, page refresh, crisis clarification, and API failure fallback.
