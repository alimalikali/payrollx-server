# AI Chat Feature — Implementation Progress

## Status: WORKING ✓

---

## What Was Built

Upgraded the PayrollX HR chatbot from a dumb pattern-matching/template system to a real LLM-powered assistant using the **OpenRouter free API**. Employees and HR/Admin can now ask natural language questions and get intelligent, context-aware responses backed by real database data.

---

## Files Changed

### New File
**`payrollx-server/src/services/ai/openrouter.service.js`**
- Wraps the OpenRouter API (OpenAI-compatible, free tier)
- Implements a **model fallback chain** — tries models in order until one succeeds:
  1. `meta-llama/llama-3.2-3b-instruct:free`
  2. `liquid/lfm-2.5-1.2b-instruct:free` ← currently most reliable
  3. `google/gemma-3-4b-it:free`
- 30s timeout with AbortController
- Never throws — always returns `{ success, content/error }` for clean fallback

### Modified: `payrollx-server/src/services/ai/chatbot.service.js`
Added 3 helper functions:
- `buildSystemPrompt(userContext, fetchedData, intent, userRole)` — builds context prompt with employee identity, role access level, and real DB data as bullet points
- `formatDataForPrompt(data, intent)` — converts DB rows into readable text per intent (salary, leave, attendance, payslip)
- `buildChatMessages(history, systemPrompt, userMessage)` — embeds system context **into the user message** (not as a `system` role) to support all models including Gemma

Updated `processMessage()`:
- Now accepts `userRole` parameter
- Runs existing intent handler first (gets DB data + template as guaranteed fallback)
- Calls OpenRouter with enriched prompt
- Falls back silently to template if LLM fails

### Modified: `payrollx-server/src/controllers/ai.controller.js`
- Added `userRole: req.user.role` to the `processMessage()` call (one line)

### Modified: `payrollx-server/.env`
- Added `OPENROUTER_API_KEY` (no leading spaces — this was a bug that caused silent failures)
- Removed `OPENROUTER_MODEL` so the fallback chain runs automatically

---

## How It Works (Flow)

```
User Message
    ↓
classifyIntent()         ← keyword matching (unchanged, 8 intents)
    ↓
intent handler()         ← DB query for real data (salary/leave/attendance/payslip)
    ↓                      also produces template string as fallback
buildSystemPrompt()      ← role context + DB data formatted as bullet points
    ↓
buildChatMessages()      ← last 5 conversation turns + system context in user message
    ↓
callOpenRouter()         ← tries model chain, 30s timeout
    ↓
success → LLM response   OR   failure → template fallback (silent)
    ↓
saveMessage() × 2        ← stored in chatbot_messages table
    ↓
Response to frontend     ← { sessionId, message, intent, confidence, suggestions }
```

---

## Role-Based Access

| Role | Behavior |
|------|----------|
| `employee` | Sees only own data; LLM told "self-service only" |
| `hr` / `admin` | LLM told "access to all employee records" |

DB queries are already scoped per employee — role context affects LLM framing only.

---

## Bugs Fixed Along the Way

1. **HTTP 400 — system role not supported** — Gemma via Google AI Studio rejects `system` role messages. Fixed by embedding system context into the user message instead.
2. **HTTP 429 — rate limited** — Llama/Gemma free models are heavily throttled. Fixed with a model fallback chain; `liquid/lfm-2.5-1.2b` is the current reliable fallback.
3. **Leading spaces in .env** — `OPENROUTER_API_KEY` had a leading space, making `process.env.OPENROUTER_API_KEY` undefined. Fixed by cleaning the .env file.
4. **OPENROUTER_MODEL pinned to rate-limited model** — Was set to Llama in .env, bypassing the fallback chain. Removed it so auto-fallback works.

---

## .env Requirements (payrollx-server/.env)

```
OPENROUTER_API_KEY=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
OPENROUTER_TIMEOUT_MS=30000
# Do NOT set OPENROUTER_MODEL — let the fallback chain pick automatically
```

---

## What's NOT Changed

- Frontend (`Chatbot.tsx`) — zero changes needed, already works
- API contract — same response shape `{ sessionId, message, intent, confidence, suggestions }`
- All other AI features (fraud detection, anomaly, forecast, recommendations) — untouched
- Database schema — no migrations needed

---

## Possible Next Steps (not started)

- **HR querying another employee by name** — parse "What's Ahmed's salary?" → look up Ahmed's context → inject his data into the prompt
- **Streaming responses** — set `stream: true` in OpenRouter call, pipe SSE to frontend for typing effect
- **Paid model upgrade** — add OpenRouter credits to unlock GPT-4o, Claude, etc. for better quality
- **Conversation memory across sessions** — currently only last 5 turns of current session are used
