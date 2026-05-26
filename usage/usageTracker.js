/**
 * UsageTracker
 *
 * In-memory accumulator for Anthropic API usage on this server process.
 * Records:
 *   • Token counters per request (input / output / cache_creation / cache_read)
 *   • Per-model breakdown
 *   • Latest rate-limit snapshot from response headers
 *
 * Counters reset on server restart. For long-term billing, the Anthropic
 * organisation Admin API (/v1/organizations/usage_report/messages) is the
 * authoritative source — this tracker is intentionally lightweight.
 *
 * NOTE on "credit balance": Anthropic does not expose remaining credit
 * balance via the public API. The closest signal available per request is
 * the `anthropic-ratelimit-*` headers, captured below.
 */

/* ── Pricing (USD per million tokens) ────────────────────────────────────── */
/* Defaults are claude-sonnet-4-6 list pricing as of 2026. Override via env. */
const PRICING = {
  input:       Number(process.env.PRICE_INPUT_PER_MTOK)       || 3.00,
  output:      Number(process.env.PRICE_OUTPUT_PER_MTOK)      || 15.00,
  cache_write: Number(process.env.PRICE_CACHE_WRITE_PER_MTOK) || 3.75,  // 5-min TTL
  cache_read:  Number(process.env.PRICE_CACHE_READ_PER_MTOK)  || 0.30,
};

/* Anthropic rate-limit headers — see https://docs.anthropic.com/api/rate-limits */
const RATE_LIMIT_HEADER_GROUPS = [
  ["requests",      "anthropic-ratelimit-requests"],
  ["tokens",        "anthropic-ratelimit-tokens"],
  ["input_tokens",  "anthropic-ratelimit-input-tokens"],
  ["output_tokens", "anthropic-ratelimit-output-tokens"],
];

function newCounters() {
  return {
    requests:                    0,
    input_tokens:                0,
    output_tokens:               0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens:     0,
  };
}

function computeCost(c) {
  return (
    (c.input_tokens                * PRICING.input       / 1e6) +
    (c.output_tokens               * PRICING.output      / 1e6) +
    (c.cache_creation_input_tokens * PRICING.cache_write / 1e6) +
    (c.cache_read_input_tokens     * PRICING.cache_read  / 1e6)
  );
}

/** Fetch Headers OR plain object — read a single header safely. */
function readHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
}

class UsageTracker {
  constructor() {
    this.startedAt           = new Date();
    this.totals              = newCounters();
    this.byModel             = {};
    this.rateLimits          = null;
    this.lastRateLimitUpdate = null;
  }

  /** Record token usage from a single Anthropic response. */
  record({ model, usage }) {
    if (!usage) return;
    const key = model || "unknown";
    if (!this.byModel[key]) this.byModel[key] = newCounters();

    const fields = [
      "input_tokens",
      "output_tokens",
      "cache_creation_input_tokens",
      "cache_read_input_tokens",
    ];
    for (const f of fields) {
      const v = usage[f] || 0;
      this.totals[f]      += v;
      this.byModel[key][f] += v;
    }
    this.totals.requests       += 1;
    this.byModel[key].requests += 1;
  }

  /** Snapshot the latest Anthropic rate-limit headers. */
  recordRateLimit(headers) {
    if (!headers) return;
    const snapshot = {};

    for (const [name, prefix] of RATE_LIMIT_HEADER_GROUPS) {
      const limit     = readHeader(headers, `${prefix}-limit`);
      const remaining = readHeader(headers, `${prefix}-remaining`);
      const reset     = readHeader(headers, `${prefix}-reset`);
      if (limit == null && remaining == null && reset == null) continue;
      snapshot[name] = {
        limit:     limit     != null ? Number(limit)     : null,
        remaining: remaining != null ? Number(remaining) : null,
        resetAt:   reset || null,
      };
    }

    const retryAfter = readHeader(headers, "retry-after");
    if (retryAfter != null) snapshot.retry_after_seconds = Number(retryAfter);

    if (Object.keys(snapshot).length > 0) {
      this.rateLimits          = snapshot;
      this.lastRateLimitUpdate = new Date();
    }
  }

  /** Build the JSON payload returned by GET /usage. */
  getSummary() {
    const total_tokens =
      this.totals.input_tokens +
      this.totals.output_tokens +
      this.totals.cache_creation_input_tokens +
      this.totals.cache_read_input_tokens;

    const byModel = Object.fromEntries(
      Object.entries(this.byModel).map(([m, c]) => [
        m,
        {
          ...c,
          total_tokens:
            c.input_tokens +
            c.output_tokens +
            c.cache_creation_input_tokens +
            c.cache_read_input_tokens,
          estimated_cost_usd: Number(computeCost(c).toFixed(6)),
        },
      ])
    );

    return {
      totals: {
        ...this.totals,
        total_tokens,
        estimated_cost_usd: Number(computeCost(this.totals).toFixed(6)),
      },
      byModel,
      pricing_per_mtok_usd: { ...PRICING },
      rateLimits: this.rateLimits
        ? { lastUpdatedAt: this.lastRateLimitUpdate.toISOString(), ...this.rateLimits }
        : null,
      session: {
        startedAt:     this.startedAt.toISOString(),
        uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      },
      notes: [
        "Token counts and costs are tracked per-process and reset on server restart.",
        "Costs are estimates calculated from the configured per-MTok pricing.",
        "Anthropic does not expose a remaining-credit-balance endpoint via the public API. The `rateLimits` section reflects the request/token windows returned with the most recent API response — this is the closest equivalent to a 'balance' that the API surfaces.",
        "For authoritative historical usage, query the Anthropic Admin API: /v1/organizations/usage_report/messages.",
      ],
    };
  }
}

const usageTracker = new UsageTracker();
module.exports = { usageTracker, UsageTracker };
