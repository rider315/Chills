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
 * Generate content using the configured AI provider.
 * Retries automatically if the response is empty or low quality.
 * @param {string} prompt - The prompt to send
 * @param {object} [aiConfig] - Optional AI config: { provider: 'openrouter'|'gemini'|'sambanova', geminiApiKey: '', sambanovaApiKey: '' }
 * @param {number} [retries=3] - Number of retries
 */
async function generateContent(prompt, aiConfig = null, retries = 3) {
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
        await new Promise(r => setTimeout(r, 1000));
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
      // Wait a bit before retrying to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
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
- HARDCODED RULES FOR THIS APPLICANT:
  * MUST explicitly mention current experience as an Associate Software Engineer at KPIT Technologies.
  * MUST explicitly mention having startup experience (e.g., InsideFPV, KuppiSmart, Tokins).
  * MUST give strong focus to AI applications and usage (e.g., custom LLM for B2B SaaS, RAG, AI marketing pipelines). Connect these AI skills to the company's needs.`;
  }

  const prompt = `You are a cold email expert. Write a short, well-formatted cold email from a job seeker to a recruiter.

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
${customInstructions}

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

**Section 2 — COMPANY HOOK (1-2 lines)**
Mention something specific about the company — a recent trend, product, news, or tech direction. Show you actually know the company. Address the recruiter by first name if available, otherwise skip the name entirely. Example: "I've been following ${recruiterInfo.company || 'your company'}'s work in [specific area] and..."

**Section 3 — WHY HIRE ME (split into 2 short paragraphs, separated by a blank line)**
Paragraph 1: Your most impressive project/achievement + startup experience.
Paragraph 2: How your skills match what this company needs + what value you bring.
Follow these rules STRICTLY:

${flagshipProject ? `- MUST mention the flagship project "${flagshipProject.name}" with a concrete metric or scale (e.g., "${flagshipProject.scale || ''}" or key highlights). Keep it to 1-2 sentences.` : '- Mention the most impressive project from the resume with a concrete metric.'}

${hasStartup ? '- MUST mention startup/leadership experience naturally (e.g., "Having worked in startup environments, I understand the pace and ownership needed...").' : ''}

${hasAI ? '- MUST mention AI/RAG/LLM experience and connect it to how it could benefit the company. Be specific about what AI tools/techniques were used.' : ''}

- SKILL MATCHING (CRITICAL): The company sector is "${sector}" and they hire for: ${hiringTech || 'general tech roles'}.
  * ONLY mention skills from the applicant that MATCH what this company needs.
  * For automotive companies → emphasize embedded systems, C/C++, AUTOSAR, ECU, Python scripting, and relevant automotive experience.
  * For software/SaaS companies → emphasize full-stack skills (React, Node.js, MongoDB, AWS), scalability, and web development experience.
  * For AI/ML companies → emphasize AI, ML, LLM, RAG, deep learning, computer vision experience.
  * For IoT companies → emphasize IoT, sensor data, real-time systems, Python, embedded experience.
  * DO NOT mention skills that have no relation to this company's domain. For example, don't mention AUTOSAR for a SaaS company, or React for a pure embedded systems company.

- Weave the skills naturally into sentences. Do NOT list them as bullet points or comma-separated lists.
- Frame everything as value you bring: "I built X which did Y" not "I know X".

**Section 4 — AVAILABILITY & CTA (1-2 lines)**
${profileSettings.immediateJoiner ? '- Mention being available to join immediately.' : ''}
- Mention the attached resume naturally (e.g., "I\'ve attached my resume for a closer look.").
- End with a soft ask (e.g., "Would you be open to a quick chat?" or "Happy to share more details if this sounds like a fit.").
- Do NOT add a separate "Resume attached" line.

**Section 5 — SIGNATURE**
Applicant's name on its own line.
Then print each contact link on its own line, EXACTLY as provided. Do NOT use markdown link syntax. Do NOT embed links in text. Format exactly like:
Mobile: +1234567890
LinkedIn: https://linkedin.com/in/...

=== STRICT RULES ===

1. TOTAL email body: 120-170 words. Not more.
2. Use SIMPLE, everyday English. A 15-year-old should be able to read it easily.
3. NEVER use these words: synergy, leverage, passionate, rockstar, thrilled, delighted, esteemed, utilize, endeavor, pursuant.
4. NEVER use placeholders or brackets like [Name], [Company], [Your Name]. Use actual data only.
5. NEVER make up experience, companies, or project names. Use ONLY what is in the profile.
6. Each section must be separated by a blank line. The email should look clean and scannable.
7. Do NOT use bullet points or numbered lists in the email body.
8. Do NOT use markdown formatting (no **, no ##, no []() links).
9. Keep the tone confident but not arrogant. Friendly but professional.

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
