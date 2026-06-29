/**
 * Email Validation Service
 * ------------------------------------------------------------------
 * Goes beyond simple `includes('@')` checks to filter out emails that
 * are syntactically broken, point at non-existent / undeliverable
 * domains, or come from disposable/throwaway providers — before they
 * ever reach the database, the AI generator, or an outbound campaign.
 *
 * Validation layers (cheap → expensive, short-circuit on first failure):
 *   1. Syntax       — RFC-5321-ish structural check of local + domain.
 *   2. Typo guard   — catch obvious typos of big providers (gmail.con).
 *   3. Disposable   — reject known throwaway domains.
 *   4. Deliverability (DNS) — confirm the domain can actually receive
 *                     mail via MX records, falling back to A/AAAA
 *                     records per RFC-5321 §5.1.
 *
 * Scalability:
 *   - DNS results are cached per-domain (a single import of 5,000
 *     contacts at one company resolves that domain exactly once).
 *   - Batch validation runs with bounded concurrency so a large file
 *     doesn't open thousands of simultaneous DNS sockets.
 *   - Each DNS lookup is wrapped in a timeout so a slow resolver can't
 *     stall the whole import.
 *
 * We deliberately do NOT perform SMTP "RCPT TO" probing: it is slow,
 * frequently blocked by providers, unreliable (catch-all servers), and
 * can get the sending IP blacklisted. MX + domain checks give the best
 * accuracy/performance/safety balance for an import-time gate.
 */

const dns = require('dns').promises;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// MX/DNS checking can be disabled (e.g. offline dev / CI) via env flag.
const MX_CHECK_ENABLED = process.env.EMAIL_VALIDATION_MX !== 'false';
const DNS_TIMEOUT_MS = parseInt(process.env.EMAIL_VALIDATION_DNS_TIMEOUT_MS, 10) || 4000;
const DNS_CACHE_TTL_MS = parseInt(process.env.EMAIL_VALIDATION_DNS_TTL_MS, 10) || 6 * 60 * 60 * 1000; // 6h
const DEFAULT_CONCURRENCY = parseInt(process.env.EMAIL_VALIDATION_CONCURRENCY, 10) || 12;

// Machine-readable rejection reason codes (stable for UI / analytics).
const REASONS = {
  EMPTY: 'empty',
  INVALID_FORMAT: 'invalid_format',
  INVALID_DOMAIN: 'invalid_domain',
  DISPOSABLE: 'disposable',
  TYPO: 'likely_typo',
  DUPLICATE: 'duplicate',
};

// Human-readable messages for each reason code.
const REASON_MESSAGES = {
  [REASONS.EMPTY]: 'No email address provided.',
  [REASONS.INVALID_FORMAT]: 'Email address is not properly formatted.',
  [REASONS.INVALID_DOMAIN]: 'Domain does not exist or cannot receive email.',
  [REASONS.DISPOSABLE]: 'Disposable / throwaway email address.',
  [REASONS.TYPO]: 'Email domain looks like a typo.',
  [REASONS.DUPLICATE]: 'Already exists in your recruiter list.',
};

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
// Common disposable / throwaway domains. Not exhaustive (those lists are huge
// and churn constantly) but covers the providers seen most often in practice.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org',
  'throwawaymail.com', 'yopmail.com', 'getnada.com', 'trashmail.com',
  'maildrop.cc', 'mailnesia.com', 'dispostable.com', 'fakeinbox.com',
  'mintemail.com', 'mohmal.com', 'tempinbox.com', 'spamgourmet.com',
  'mailcatch.com', 'tempmailo.com', 'emailondeck.com', 'mail-temp.com',
  'discard.email', 'spam4.me', 'grr.la', 'guerrillamailblock.com',
  'inboxkitten.com', 'nada.email', 'tmpmail.org', 'moakt.com',
  'fakemail.net', 'burnermail.io', 'mailsac.com', 'tempr.email',
]);

// Big free providers + their frequent typos → the correct domain.
const FREE_PROVIDERS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'protonmail.com'];
const DOMAIN_TYPOS = {
  'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.comm': 'gmail.com',
  'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'hotmail.con': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'outlook.con': 'outlook.com', 'outlok.com': 'outlook.com',
  'iclould.com': 'icloud.com', 'icloud.con': 'icloud.com',
};

// Pragmatic RFC-5321-aligned syntax check. Intentionally not the full RFC-5322
// grammar (which permits exotic forms no real recruiter inbox uses) — this
// catches everything deliverable while rejecting the malformed junk that shows
// up in scraped spreadsheets/PDFs.
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// ---------------------------------------------------------------------------
// DNS cache (per-domain deliverability)
// ---------------------------------------------------------------------------
// domain -> { deliverable: boolean, expiresAt: number }
const dnsCache = new Map();

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('dns_timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Determine whether a domain can receive email.
 * Returns: 'deliverable' | 'undeliverable' | 'unknown'
 *   - 'unknown' on transient DNS errors (timeouts, SERVFAIL) so we fail OPEN
 *     and never reject a legitimate domain because of our own resolver hiccup.
 */
async function checkDomainDeliverability(domain) {
  const cached = dnsCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.deliverable ? 'deliverable' : 'undeliverable';
  }

  let result = 'unknown';
  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx && mx.length > 0 && mx.some((r) => r.exchange)) {
      result = 'deliverable';
    } else {
      // No MX → RFC-5321 implicit MX: fall back to A/AAAA record.
      result = (await hasAddressRecord(domain)) ? 'deliverable' : 'undeliverable';
    }
  } catch (err) {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'ENODATA')) {
      // Domain resolves but has no MX — try A/AAAA fallback before rejecting.
      result = (await hasAddressRecord(domain)) ? 'deliverable' : 'undeliverable';
    } else {
      // Timeout / SERVFAIL / network blip — treat as unknown (don't reject).
      result = 'unknown';
    }
  }

  // Only cache definitive answers, never 'unknown'.
  if (result !== 'unknown') {
    dnsCache.set(domain, {
      deliverable: result === 'deliverable',
      expiresAt: Date.now() + DNS_CACHE_TTL_MS,
    });
  }
  return result;
}

async function hasAddressRecord(domain) {
  try {
    const a = await withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS);
    if (a && a.length > 0) return true;
  } catch (_) { /* try AAAA */ }
  try {
    const aaaa = await withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS);
    return !!(aaaa && aaaa.length > 0);
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------
function reject(reason, extra = {}) {
  return { valid: false, reason, message: REASON_MESSAGES[reason], ...extra };
}

/**
 * Validate a single email address.
 * @param {string} rawEmail
 * @param {object} [opts]
 * @param {boolean} [opts.checkMx=true] — perform DNS deliverability check.
 * @returns {Promise<{valid:boolean, normalized:string, reason?:string, message?:string, suggestion?:string}>}
 */
async function validateEmail(rawEmail, opts = {}) {
  const checkMx = opts.checkMx !== false && MX_CHECK_ENABLED;
  const normalized = String(rawEmail || '').trim().toLowerCase();

  if (!normalized) return { ...reject(REASONS.EMPTY), normalized };

  // 1. Syntax
  if (normalized.length > 254 || !EMAIL_REGEX.test(normalized)) {
    return { ...reject(REASONS.INVALID_FORMAT), normalized };
  }

  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);

  // 2. Obvious typo of a major provider
  if (DOMAIN_TYPOS[domain]) {
    const suggestion = normalized.slice(0, normalized.lastIndexOf('@') + 1) + DOMAIN_TYPOS[domain];
    return { ...reject(REASONS.TYPO), normalized, suggestion };
  }

  // 3. Disposable / throwaway
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ...reject(REASONS.DISPOSABLE), normalized };
  }

  // 4. Deliverability (DNS). Skip for known-good big providers — they always
  //    have MX, so we save a lookup. (Typos of them were already caught above.)
  if (checkMx && !FREE_PROVIDERS.includes(domain)) {
    const deliverability = await checkDomainDeliverability(domain);
    if (deliverability === 'undeliverable') {
      return { ...reject(REASONS.INVALID_DOMAIN), normalized };
    }
    // 'unknown' → fail open (accept).
  }

  return { valid: true, normalized };
}

/**
 * Map over items with bounded concurrency.
 */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Validate many emails efficiently (deduped domains via cache, bounded
 * concurrency). Preserves input order in the returned array.
 *
 * @param {string[]} emails
 * @param {object} [opts]
 * @param {boolean} [opts.checkMx=true]
 * @param {number}  [opts.concurrency]
 * @returns {Promise<Array<{input:string, valid:boolean, normalized:string, reason?:string, message?:string, suggestion?:string}>>}
 */
async function validateEmails(emails, opts = {}) {
  const concurrency = opts.concurrency || DEFAULT_CONCURRENCY;
  return mapWithConcurrency(emails, concurrency, async (email) => {
    const result = await validateEmail(email, opts);
    return { input: email, ...result };
  });
}

module.exports = {
  validateEmail,
  validateEmails,
  REASONS,
  REASON_MESSAGES,
  // exported for tests / advanced callers
  _internal: { checkDomainDeliverability, EMAIL_REGEX },
};
