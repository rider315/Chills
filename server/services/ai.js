const config = require('../config');
const OpenAI = require('openai');

// ---------------------------------------------------------------------------
// AI Provider Clients
// ---------------------------------------------------------------------------

let openRouterClient = null;
const geminiClients = {}; // Cache by API key
const sambanovaClients = {}; // Cache by API key

/**
 * Get the OpenRouter client (free tier, uses env key).
 */
function getOpenRouterClient() {
  if (!openRouterClient) {
    const apiKey = config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured. Set it in Settings or in the .env file.');
    }
    openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
    });
  }
  return openRouterClient;
}

/**
 * Get a Gemini client for the given API key.
 * Uses Google's OpenAI-compatible endpoint.
 */
function getGeminiClient(apiKey) {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add it in Settings.');
  }
  if (!geminiClients[apiKey]) {
    geminiClients[apiKey] = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: apiKey,
    });
  }
  return geminiClients[apiKey];
}

/**
 * Get a SambaNova client for the given API key.
 * Uses SambaNova's OpenAI-compatible endpoint.
 */
function getSambanovaClient(apiKey) {
  if (!apiKey) {
    throw new Error('SambaNova API key is not configured. Please add it in Settings.');
  }
  if (!sambanovaClients[apiKey]) {
    sambanovaClients[apiKey] = new OpenAI({
      baseURL: 'https://api.sambanova.ai/v1',
      apiKey: apiKey,
    });
  }
  return sambanovaClients[apiKey];
}

const OPENROUTER_MODEL = 'openrouter/free';
const GEMINI_MODEL = 'gemini-2.5-flash';
const SAMBANOVA_MODEL = 'Meta-Llama-3.3-70B-Instruct';
const PUTER_MODEL = 'claude-sonnet-4-6';

let puterInstance = null;

/**
 * Get a Puter client for the given API key.
 */
async function getPuterClient(apiKey) {
  if (!apiKey) {
    throw new Error('Puter Auth Token is not configured. Please add it in Settings.');
  }
  if (!puterInstance) {
    const { puter } = await import('@heyputer/puter.js');
    puterInstance = puter;
  }
  puterInstance.setAuthToken(apiKey);
  return puterInstance;
}

/**
 * Check if AI response is usable (not empty, not a refusal, not too short).
 */
function isValidResponse(content) {
  if (!content || content.trim().length < 50) return false;
  const lower = content.toLowerCase();
  if (lower.includes('i cannot') && lower.includes('assist')) return false;
  if (lower.includes('i\'m unable to')) return false;
  return true;
}

/**
 * Calculate backoff delay for retries.
 * If the error is a 429 rate limit, use the Retry-After header or a longer base delay.
 * Otherwise, use a short exponential backoff.
 */
function getRetryDelay(err, attempt) {
  const is429 = err?.status === 429 || err?.statusCode === 429 ||
    (err?.message && err.message.includes('429'));

  if (is429) {
    // Check for Retry-After header (in seconds)
    const retryAfter = err?.headers?.['retry-after'] || err?.error?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) {
        console.log(`[rate-limit] Retry-After header: waiting ${seconds}s`);
        return seconds * 1000;
      }
    }
    // Exponential backoff for 429s: 5s, 10s, 20s, 40s
    const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
    console.log(`[rate-limit] 429 detected, waiting ${delay / 1000}s (attempt ${attempt + 1})`);
    return delay;
  }

  // Non-rate-limit errors: shorter backoff 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, attempt), 8000);
}

/**
 * Generate content using the configured AI provider.
 * Retries automatically if the response is empty or low quality.
 * Handles 429 rate limits with exponential backoff.
 * @param {string} prompt - The prompt to send
 * @param {object} [aiConfig] - Optional AI config: { provider: 'openrouter'|'gemini'|'sambanova', geminiApiKey: '', sambanovaApiKey: '' }
 * @param {number} [retries=4] - Number of retries
 */
async function generateContent(prompt, aiConfig = null, retries = 4) {
  const provider = aiConfig?.provider || 'openrouter';

  // --- Gemini path ---
  if (provider === 'gemini' && aiConfig?.geminiApiKey) {
    const ai = getGeminiClient(aiConfig.geminiApiKey);
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await ai.chat.completions.create({
          model: GEMINI_MODEL,
          messages: [{ role: 'user', content: prompt }],
        });
        const content = response.choices?.[0]?.message?.content;
        if (isValidResponse(content)) return content;
        console.warn(`[gemini] Attempt ${i + 1}: weak/empty response (${(content || '').length} chars)`);
      } catch (err) {
        console.error(`[gemini] Attempt ${i + 1} failed:`, err.message);
        if (i === retries) throw err;
        const delay = getRetryDelay(err, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return "";
  }

  // --- SambaNova path ---
  if (provider === 'sambanova' && aiConfig?.sambanovaApiKey) {
    const ai = getSambanovaClient(aiConfig.sambanovaApiKey);
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await ai.chat.completions.create({
          model: SAMBANOVA_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        });
        const content = response.choices?.[0]?.message?.content;
        if (isValidResponse(content)) return content;
        console.warn(`[sambanova] Attempt ${i + 1}: weak/empty response (${(content || '').length} chars)`);
      } catch (err) {
        console.error(`[sambanova] Attempt ${i + 1} failed:`, err.message);
        if (i === retries) throw err;
        const delay = getRetryDelay(err, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return "";
  }

  // --- Puter path ---
  if (provider === 'puter' && aiConfig?.puterAuthToken) {
    const ai = await getPuterClient(aiConfig.puterAuthToken);
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await ai.ai.chat(prompt, { model: PUTER_MODEL });
        const content = response?.message?.content?.[0]?.text;
        if (isValidResponse(content)) return content;
        console.warn(`[puter] Attempt ${i + 1}: weak/empty response (${(content || '').length} chars)`);
      } catch (err) {
        console.error(`[puter] Attempt ${i + 1} failed:`, err.message);
        if (i === retries) throw err;
        const delay = getRetryDelay(err, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    return "";
  }

  // --- OpenRouter path ---
  const ai = getOpenRouterClient();
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await ai.chat.completions.create({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      });
      const content = response.choices?.[0]?.message?.content;
      if (isValidResponse(content)) {
        console.log(`[openrouter] Success on attempt ${i + 1} (${content.length} chars)`);
        return content;
      }
      console.warn(`[openrouter] Attempt ${i + 1}: weak/empty response (${(content || '').length} chars)`);
    } catch (err) {
      console.error(`[openrouter] Attempt ${i + 1} failed:`, err.message);
      if (i === retries) throw err;
      const delay = getRetryDelay(err, i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return "";
}

/**
 * Parse resume text into a structured profile object.
 * Extracts projects, awards, publications, startup experience, AI experience,
 * and per-role technologies for richer email generation.
 */
async function parseResume(text, aiConfig = null) {
  const prompt = `You are an expert resume parser. Extract ALL of the following fields from the resume text below and return ONLY valid JSON (no markdown fences, no extra text).

Required JSON structure:
{
  "name": "",
  "email": "",
  "phone": "",
  "skills": [],
  "experience": [
    {
      "title": "",
      "company": "",
      "duration": "",
      "description": "",
      "technologies": [],
      "isStartup": false
    }
  ],
  "education": [
    { "degree": "", "institution": "", "year": "", "cgpa": "" }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": [],
      "highlights": [],
      "scale": ""
    }
  ],
  "awards": [],
  "publications": [],
  "summary": "",
  "strengths": [],
  "hasStartupExperience": false,
  "hasAIExperience": false
}

IMPORTANT EXTRACTION RULES:
- "projects": Extract EVERY project listed. Include the project name, a concise description, all technologies used, key highlights/metrics (e.g. "tested on 1M users", "reduced wait times by 40%"), and scale (e.g. "100+ businesses", "10,000+ downloads").
- "experience": For each role, extract the technologies used and set "isStartup" to true if the company appears to be a startup, small company, or early-stage venture.
- "hasStartupExperience": Set to true if any role was at a startup, or if the person founded/co-founded something, or held leadership roles at small companies.
- "hasAIExperience": Set to true if the person has experience with AI, ML, LLM, RAG, NLP, deep learning, computer vision, or similar technologies.
- "awards": Include research papers, publications, certifications, notable achievements, and download milestones.
- "publications": Extract any published research papers with conference/journal names.
- "skills": Extract ALL technical skills mentioned anywhere in the resume.

If a field is not found, use an empty string, empty array, or false as appropriate.

Resume text:
"""
${text}
"""`;

  const raw = await generateContent(prompt, aiConfig);
  const safeRaw = raw || "";
  const cleaned = safeRaw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const emptyProfile = { name: "", email: "", phone: "", skills: [], experience: [], education: [], projects: [], awards: [], publications: [], summary: "", strengths: [], hasStartupExperience: false, hasAIExperience: false };
  if (!safeRaw) return emptyProfile;

  // Try to parse, with recovery for truncated/malformed JSON
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    console.warn('First JSON parse failed, attempting recovery:', firstErr.message);
    try {
      // Attempt to fix common truncation issues
      let fixed = cleaned;
      // Close any unterminated strings
      const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        fixed += '"';
      }
      // Balance brackets and braces
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;
      // Remove any trailing comma before we close
      fixed = fixed.replace(/,\s*$/, '');
      for (let b = 0; b < openBrackets - closeBrackets; b++) fixed += ']';
      for (let b = 0; b < openBraces - closeBraces; b++) fixed += '}';
      return JSON.parse(fixed);
    } catch (secondErr) {
      console.warn('JSON recovery failed, retrying AI call:', secondErr.message);
      // Retry with a simpler prompt asking to complete the JSON
      try {
        const retryRaw = await generateContent(prompt, aiConfig);
        const retryCleaned = (retryRaw || "").trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        if (retryCleaned) return JSON.parse(retryCleaned);
      } catch (retryErr) {
        console.error('Resume parse retry also failed:', retryErr.message);
      }
      return emptyProfile;
    }
  }
}

/**
 * Research a company using AI.
 * Now also captures sector, hiring technologies, and ideal candidate traits.
 */
async function researchCompany(companyName, aiConfig = null) {
  const prompt = `Research the company "${companyName}" thoroughly. Provide the following information as valid JSON only (no markdown fences):

{
  "companyName": "",
  "industry": "",
  "sector": "",
  "description": "",
  "recentNews": [""],
  "culture": "",
  "techStack": [""],
  "hiringTechnologies": [""],
  "openPositions": [""],
  "hiringTrends": "",
  "whatTheyLookFor": "",
  "keyPeople": [""],
  "companySize": "",
  "headquarters": "",
  "notableProjects": [""]
}

IMPORTANT:
- "sector": Classify the company into one of these categories: automotive, software/SaaS, fintech, healthcare, e-commerce, IoT, AI/ML, embedded systems, consulting, manufacturing, edtech, or other. Be specific.
- "hiringTechnologies": List the specific programming languages, frameworks, and tools this company typically hires for (e.g. React, Python, Java, AWS, Kubernetes, AUTOSAR, etc.). This is CRITICAL — look at their job postings, tech blog, and engineering culture.
- "whatTheyLookFor": Describe in 1-2 sentences what kind of candidate this company typically looks for (e.g. "Strong full-stack engineers with experience in distributed systems" or "Embedded C developers with automotive domain knowledge").
- "recentNews": Include any recent product launches, funding rounds, partnerships, or notable achievements.

Focus on current, up-to-date information relevant to a job applicant. If certain information is not available, use empty strings or arrays.`;

  const raw = await generateContent(prompt, aiConfig);
  const safeRaw = raw || "";
  const cleaned = safeRaw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return { companyName, rawResearch: raw };
  }
}

/**
 * Generate a personalized cold email for a recruiter.
 * Produces sector-aware, well-formatted emails with catchy openings,
 * project highlights, startup experience, and relevant skill matching.
 */
async function generateEmail(profile, companyResearch, recruiterInfo, profileSettings = {}, aiConfig = null) {
  // Build a links section for the prompt
  let linksBlock = '';
  const links = [];
  if (profileSettings.mobileNumber) links.push(`Mobile: ${profileSettings.mobileNumber}`);
  if (profileSettings.linkedinUrl) links.push(`LinkedIn: ${profileSettings.linkedinUrl}`);
  if (profileSettings.portfolioUrl) links.push(`Portfolio: ${profileSettings.portfolioUrl}`);
  if (profileSettings.otherLinks && profileSettings.otherLinks.length > 0) {
    profileSettings.otherLinks.forEach((l) => {
      if (l.url) links.push(`${l.label || 'Link'}: ${l.url}`);
    });
  }
  if (links.length > 0) {
    linksBlock = `\n\nAPPLICANT CONTACT LINKS (print these EXACTLY as-is in the signature, one per line):\n${links.join('\n')}`;
  }

  const immediateJoinerText = profileSettings.immediateJoiner 
    ? "The applicant is an IMMEDIATE JOINER (available to start right away). Mention this naturally as a selling point in the availability section."
    : "";

  const safeJoin = (val, sep = ', ') => Array.isArray(val) ? val.join(sep) : (val ? String(val) : '');

  // Build a sector-aware skill matching instruction
  const sector = companyResearch.sector || companyResearch.industry || 'technology';
  const hiringTech = safeJoin(companyResearch.hiringTechnologies || companyResearch.techStack);

  // Extract key profile data for the prompt to emphasize
  const projects = profile.projects || [];
  const flagshipProject = projects.length > 0 ? projects[0] : null;
  const hasStartup = profile.hasStartupExperience || (profile.experience || []).some(e => e.isStartup);
  const hasAI = profile.hasAIExperience || (profile.skills || []).some(s => /\b(ai|ml|llm|rag|deep learning|nlp|machine learning)\b/i.test(s));
  const awards = profile.awards || [];
  const publications = profile.publications || [];

  let customInstructions = '';
  if (profile.email && profile.email.toLowerCase() === 'gaurav.chaudhary.865022@gmail.com') {
    customInstructions = `
=== MANDATORY RULES FOR THIS SPECIFIC APPLICANT (MUST FOLLOW — FAILURE TO FOLLOW = REJECTION) ===

1. MUST open Section 3 by stating current role: "Currently working as an Associate Software Engineer at KPIT Technologies..." or similar. Do NOT skip this.
2. MUST name specific startups by name: InsideFPV, KuppiSmart. Example: "Before KPIT, I built products across startups like InsideFPV and KuppiSmart..."
3. MUST mention specific AI work with detail: custom LLM integration for B2B SaaS (Tokins project), RAG pipelines, AI-powered marketing automation. Do NOT just say "AI experience" — name the techniques and what they did.
4. MUST connect the AI experience to what THIS specific company needs. Example for a consulting company: "...this AI engineering background could drive innovation in [company]'s digital transformation practice."
5. These 4 rules override any conflicting instructions above. If the email doesn't include ALL of these, it is WRONG.`;
  }

  const prompt = `You are a cold email expert. Write a personalized, well-formatted cold email from a job seeker to a recruiter.

The goal: Make the recruiter want to open the resume and schedule a call.

=== DATA ===

APPLICANT PROFILE:
- Name: ${profile.name || 'Unknown'}
- Email: ${profile.email || ''}
- Skills: ${safeJoin(profile.skills)}
- Experience: ${JSON.stringify(profile.experience || [], null, 2)}
- Projects: ${JSON.stringify(projects, null, 2)}
- Education: ${JSON.stringify(profile.education || [], null, 2)}
- Awards: ${JSON.stringify(awards)}
- Publications: ${JSON.stringify(publications)}
- Has Startup Experience: ${hasStartup}
- Has AI/ML Experience: ${hasAI}
${flagshipProject ? `- Flagship Project: "${flagshipProject.name}" — ${flagshipProject.description || ''} (Tech: ${safeJoin(flagshipProject.technologies)}) (Scale: ${flagshipProject.scale || 'N/A'}) (Highlights: ${safeJoin(flagshipProject.highlights, '; ')})` : ''}

COMPANY INFO:
- Company: ${recruiterInfo.company || companyResearch.companyName || 'Unknown'}
- Sector: ${sector}
- Description: ${companyResearch.description || ''}
- Hiring Technologies: ${hiringTech || 'Not available'}
- What They Look For: ${companyResearch.whatTheyLookFor || ''}
- Recent News: ${safeJoin(companyResearch.recentNews, '; ') || 'Not available'}
- Notable Projects: ${safeJoin(companyResearch.notableProjects, '; ') || 'Not available'}

RECRUITER:
- Name: ${recruiterInfo.recruiterName || ''}
- Email: ${recruiterInfo.email}
${linksBlock}
${immediateJoinerText}

=== EMAIL STRUCTURE (follow this EXACTLY) ===

The email MUST have these sections, separated by blank lines. Do NOT write everything in one paragraph.

**Section 1 — CATCHY OPENER (1 line)**
Start with a short, respectful line that grabs attention. Examples:
- "Keeping this short to respect your time."
- "I'll keep this brief — I know your inbox is busy."
- "Won't take more than 30 seconds of your time."
Do NOT start with "Dear" or "I hope this email finds you well." Just the catchy line.

**Section 2 — COMPANY HOOK (2-3 lines)**
Mention something specific about the company — a recent trend, product, news, or tech direction. Show you actually know the company. Address the recruiter by first name if available, otherwise skip the name entirely. Be specific — mention a real product, initiative, or news item. Example: "I've been following ${recruiterInfo.company || 'your company'}'s work in [specific area] and..."

**Section 3 — WHY HIRE ME (split into 3 short paragraphs, separated by blank lines)**

Paragraph 1 — CURRENT ROLE & EXPERIENCE:
- Start with the applicant's current/most recent role and company name.
- Mention what they do there and any notable achievements.
${hasStartup ? '- MUST name the specific startups the applicant has worked at (use the actual company names from the resume — e.g., InsideFPV, KuppiSmart). Do NOT just say "startup environments" generically.' : ''}

Paragraph 2 — FLAGSHIP PROJECT & AI SKILLS:
${flagshipProject ? `- MUST mention the flagship project "${flagshipProject.name}" with a concrete metric or scale (e.g., "${flagshipProject.scale || ''}"). Describe what it does and the tech behind it in 2-3 sentences.` : '- Mention the most impressive project from the resume with a concrete metric.'}
${hasAI ? '- MUST describe specific AI/ML work: name the techniques used (e.g., custom LLM, RAG pipelines, AI marketing automation) and what business outcomes they achieved. Do NOT just say "experience in AI" — be specific about WHAT was built and WHY it matters.' : ''}

Paragraph 3 — SKILL MATCH & VALUE PROPOSITION:
- SKILL MATCHING (CRITICAL): The company sector is "${sector}" and they hire for: ${hiringTech || 'general tech roles'}.
  * ONLY mention skills from the applicant that MATCH what this company needs.
  * For automotive companies → emphasize embedded systems, C/C++, AUTOSAR, ECU, Python scripting, and relevant automotive experience.
  * For software/SaaS companies → emphasize full-stack skills (React, Node.js, MongoDB, AWS), scalability, and web development experience.
  * For AI/ML companies → emphasize AI, ML, LLM, RAG, deep learning, computer vision experience.
  * For consulting/IT services companies → emphasize breadth of tech skills, adaptability, AI capabilities, and delivery experience.
  * For IoT companies → emphasize IoT, sensor data, real-time systems, Python, embedded experience.
  * DO NOT mention skills that have no relation to this company's domain.
- Explain how the applicant's specific background creates value for THIS company. Connect past work to the company's current initiatives or needs.

- Weave the skills naturally into sentences. Do NOT list them as bullet points or comma-separated lists.
- Frame everything as value you bring: "I built X which did Y" not "I know X".

**Section 4 — AVAILABILITY & CTA (2-3 lines)**
${profileSettings.immediateJoiner ? '- Mention being available to join immediately.' : ''}
- Mention the attached resume naturally (e.g., "I've attached my resume for a closer look.").
- End with a soft ask (e.g., "Would you be open to a quick chat?" or "Happy to share more details if this sounds like a fit.").
- Do NOT add a separate "Resume attached" line.

**Section 5 — SIGNATURE**
Applicant's name on its own line.
Then print each contact link on its own line, EXACTLY as provided. Do NOT use markdown link syntax. Do NOT embed links in text. Format exactly like:
Mobile: +1234567890
LinkedIn: https://linkedin.com/in/...
${customInstructions}

=== STRICT RULES ===

1. TOTAL email body: 170-200 words (excluding signature). This is important — do NOT write less than 180 words.
2. WRITE HUMANIZED EMAILS: Use SIMPLE, everyday English. A 15-year-old should be able to read it easily. It should sound like a real person wrote it, not an AI. Use a casual but professional tone.
3. NEVER use em dashes (—) or en dashes (–) anywhere in the email body. AI models over-use these. If you need to separate clauses, use periods, commas, or parentheses instead.
4. NEVER use these words: synergy, leverage, passionate, rockstar, thrilled, delighted, esteemed, utilize, endeavor, pursuant, cutting-edge, innovative.
5. NEVER use placeholders or brackets like [Name], [Company], [Your Name]. Use actual data only.
6. NEVER make up experience, companies, or project names. Use ONLY what is in the profile.
7. Each section must be separated by a blank line. The email should look clean and scannable.
8. Do NOT use bullet points or numbered lists in the email body.
9. Do NOT use markdown formatting (no **, no ##, no []() links).
10. Keep the tone confident but not arrogant. Friendly but professional.

=== OUTPUT FORMAT ===

Return EXACTLY in this format (nothing else before or after):

SUBJECT: <subject line, under 8 words, curiosity-driven>
BODY:
<email body>
`;

  const raw = await generateContent(prompt, aiConfig);
  if (!raw) {
    throw new Error("AI service returned empty response. Please try generating again.");
  }

  try {
    const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = raw.match(/BODY:\s*([\s\S]+)/i);

    let subject = subjectMatch ? subjectMatch[1].trim() : "Job Application";
    let body = bodyMatch ? bodyMatch[1].trim() : raw.trim();

    // Clean up any potential markdown or quotes from the subject
    subject = subject.replace(/^"|"$/g, '');
    
    // Remove any "Subject:" line the AI repeated inside the body
    body = body.replace(/^subject\s*:\s*.+\n*/im, '').trim();
    
    // Clean up any markdown formatting that slipped into the body
    body = body.replace(/\*\*/g, '');  // Remove bold markers
    body = body.replace(/\*/g, '');    // Remove italic markers
    body = body.replace(/^#+\s/gm, ''); // Remove heading markers
    body = body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convert markdown links to plain text
    
    return { subject, body };
  } catch (err) {
    console.error("Failed to parse email text.", err.message);
    throw new Error("AI generated an invalid response format. Please try generating again.");
  }
}

/**
 * Suggest the optimal time to send an email to a recruiter.
 */
async function suggestSendTime(companyName, recruiterInfo, aiConfig = null) {
  const prompt = `Suggest the best time to send a cold outreach email to a recruiter at "${companyName}".

Recruiter info:
- Name: ${recruiterInfo.recruiterName || 'Unknown'}
- Company: ${companyName}

Consider:
- Typical business hours and email open rates
- Best days of the week for recruiter engagement
- Time zones (assume the company is in a standard business timezone)

Return ONLY valid JSON (no markdown fences):
{
  "suggestedTime": "e.g. Tuesday 9:00 AM EST",
  "reason": "Brief explanation of why this time is optimal"
}`;

  const raw = await generateContent(prompt, aiConfig);
  const safeRaw = raw || "";
  const cleaned = safeRaw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return { suggestedTime: 'Tuesday 9:00 AM', reason: 'Tuesdays typically have highest email open rates.' };
  }
}

/**
 * Analyze a recruiter's reply and suggest a response.
 */
async function analyzeReply(originalEmail, replyText, profile, aiConfig = null) {
  const prompt = `You are a career coach analyzing a recruiter's reply to a job applicant's cold email.

ORIGINAL EMAIL SENT BY APPLICANT:
${JSON.stringify(originalEmail, null, 2)}

RECRUITER'S REPLY:
"""
${replyText}
"""

APPLICANT PROFILE:
${JSON.stringify(profile, null, 2)}

Analyze the recruiter's reply and determine their intent. Then craft a suggested response for the applicant.

Return ONLY valid JSON (no markdown fences):
{
  "intent": "one of: interested, interview_request, rejection, info_request, referral, automated, unclear",
  "intentSummary": "Brief description of what the recruiter is saying",
  "suggestedReply": "A complete suggested reply email the applicant can send back"
}`;

  const raw = await generateContent(prompt, aiConfig);
  const safeRaw = raw || "";
  const cleaned = safeRaw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

module.exports = {
  parseResume,
  researchCompany,
  generateEmail,
  suggestSendTime,
  analyzeReply,
};
