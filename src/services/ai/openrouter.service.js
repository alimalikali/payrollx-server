/**
 * OpenRouter Service
 * Wraps the OpenRouter API (OpenAI-compatible) for LLM chat completions.
 * Tries a fallback chain of free models in order until one succeeds.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_TIMEOUT_MS = parseInt(process.env.OPENROUTER_TIMEOUT_MS) || 30_000;

// Fallback chain — tried in order until one returns a non-429/non-400 response.
// If OPENROUTER_MODEL is set in .env, only that model is used (no fallback).
const MODEL_FALLBACK_CHAIN = process.env.OPENROUTER_MODEL
  ? [process.env.OPENROUTER_MODEL]
  : [
      'meta-llama/llama-3.2-3b-instruct:free',
      'liquid/lfm-2.5-1.2b-instruct:free',
      'google/gemma-3-4b-it:free',
    ];

/**
 * Calls a single model. Returns { success, content } or { success: false, retryable, error }.
 * retryable=true means we should try the next model (429 / 400 rate-limit / system-role errors).
 */
const tryModel = async (model, messages, apiKey, signal) => {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://payrollx.local',
      'X-Title': 'PayrollX HR Assistant',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 600,
      temperature: 0.4,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    // 429 = rate limit, 400 = bad request (e.g. system role not supported) — both retryable
    const retryable = res.status === 429 || res.status === 400;
    return { success: false, retryable, error: `HTTP ${res.status} (${model}): ${errText}` };
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    return { success: false, retryable: true, error: `Empty response from ${model}` };
  }

  return { success: true, content, model };
};

/**
 * callOpenRouter(messages)
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {{ success: true, content: string } | { success: false, error: string }}
 * Always returns an object — never throws.
 */
const callOpenRouter = async (messages) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENROUTER_API_KEY not set in environment' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const errors = [];

    for (const model of MODEL_FALLBACK_CHAIN) {
      const result = await tryModel(model, messages, apiKey, controller.signal);

      if (result.success) {
        if (model !== MODEL_FALLBACK_CHAIN[0]) {
          console.info(`[Chatbot] Using fallback model: ${model}`);
        }
        return { success: true, content: result.content };
      }

      errors.push(result.error);

      if (!result.retryable) {
        // Non-retryable error (e.g. auth failure) — no point trying more models
        break;
      }
    }

    return { success: false, error: errors.join(' | ') };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      error: isTimeout ? 'OpenRouter request timed out (30s)' : err.message,
    };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { callOpenRouter };
