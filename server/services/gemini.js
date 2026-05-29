const config = require('../config');

let genaiModule = null;

/**
 * Lazily load the @google/genai ESM module and return a GoogleGenAI client.
 */
async function getClient() {
  if (!genaiModule) {
    genaiModule = await import('@google/genai');
  }
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Set it in Settings or in the .env file.');
  }
  return new genaiModule.GoogleGenAI({ apiKey });
}

const MODEL = 'gemini-2.5-flash';

/**
 * Parse resume text into a structured profile object.
 */
async function parseResume(text) {
  const ai = await getClient();
  const prompt = `You are a resume parser. Extract the following fields from the resume text below and return ONLY valid JSON (no markdown fences, no extra text).

Required JSON structure:
{
  "name": "",
  "email": "",
  "phone": "",
  "skills": [],
  "experience": [
    { "title": "", "company": "", "duration": "", "description": "" }
  ],
  "education": [
    { "degree": "", "institution": "", "year": "" }
  ],
  "summary": "",
  "strengths": []
}

If a field is not found, use an empty string or empty array as appropriate.

Resume text:
"""
${text}
"""`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const raw = response.text.trim();
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

/**
 * Research a company using Gemini with Google Search grounding.
 */
async function researchCompany(companyName) {
  const ai = await getClient();
  const prompt = `Research the company "${companyName}" thoroughly. Provide the following information as valid JSON only (no markdown fences):

{
  "companyName": "",
  "industry": "",
  "description": "",
  "recentNews": [""],
  "culture": "",
  "techStack": [""],
  "openPositions": [""],
  "hiringTrends": "",
  "keyPeople": [""],
  "companySize": "",
  "headquarters": "",
  "notableProjects": [""]
}

Focus on current, up-to-date information relevant to a job applicant. If certain information is not available, use empty strings or arrays.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const raw = response.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return { companyName, rawResearch: raw };
  }
}

/**
 * Generate a personalized cold email for a recruiter.
 * @param {object} profile - Parsed resume profile
 * @param {object} companyResearch - Company research data
 * @param {object} recruiterInfo - Recruiter details
 * @param {object} profileSettings - { linkedinUrl, portfolioUrl, otherLinks, immediateJoiner }
 */
async function generateEmail(profile, companyResearch, recruiterInfo, profileSettings = {}) {
  const ai = await getClient();

  // Build a links section for the prompt
  let linksBlock = '';
  const links = [];
  if (profileSettings.linkedinUrl) links.push(`LinkedIn: ${profileSettings.linkedinUrl}`);
  if (profileSettings.portfolioUrl) links.push(`Portfolio: ${profileSettings.portfolioUrl}`);
  if (profileSettings.otherLinks && profileSettings.otherLinks.length > 0) {
    profileSettings.otherLinks.forEach((l) => {
      if (l.url) links.push(`${l.label || 'Link'}: ${l.url}`);
    });
  }
  if (links.length > 0) {
    linksBlock = `\n\nAPPLICANT LINKS (include these naturally at the end of the email):\n${links.join('\n')}`;
  }

  const immediateJoinerText = profileSettings.immediateJoiner 
    ? "The applicant is an IMMEDIATE JOINER (available to start right away). MENTION THIS clearly but naturally in the email as a strong selling point."
    : "";

  const prompt = `You are writing an ATTRACTIVE COLD EMAIL from a job seeker to a recruiter. The goal is to impress the recruiter by summarizing the applicant's real experience effectively and connecting it to the company.

APPLICANT PROFILE:
${JSON.stringify(profile, null, 2)}

COMPANY RESEARCH:
${JSON.stringify(companyResearch, null, 2)}

RECRUITER INFO:
- Name: ${recruiterInfo.recruiterName || 'Hiring Manager'}
- Email: ${recruiterInfo.email}
- Company: ${recruiterInfo.company}
${linksBlock}
${immediateJoinerText}

WRITING RULES — FOLLOW EVERY ONE:

TONE & LANGUAGE:
- Write like a real human, not a robot. Use simple, everyday words. Friendly and professional.
- Avoid being "too direct" or aggressive. Be polite and conversational.
- NO corporate buzzwords: "synergy", "leverage", "passionate", "rockstar", "thrilled".

STRUCTURE (keep TOTAL body under 120 words):
1. OPENING (1-2 lines): Start with a polite, natural hook related to the company's recent work or tech stack.

2. YOUR VALUE (3-4 lines): This is the most important part! Briefly summarize 1-2 of the applicant's BEST actual experiences or projects from the provided resume. Make it sound impressive but concise.
   - ALWAYS mention the applicant's AI/ML experience if they have any, framing it as: "I have experience with AI and believe it can be very useful for [something relevant to the company]."
   - Frame the resume experience naturally: "Previously, I built..." or "In my last role, I worked on..."

3. AVAILABILITY & ASK (1-2 lines): 
   - If the applicant is an immediate joiner, mention it here (e.g., "I'm currently available to join immediately and would love to...").
   - End with a soft ask: "Would you be open to a quick chat to see if there's a mutual fit?"

4. SIGNATURE:
   Name
   LinkedIn | Portfolio | Other links
   "Resume attached"

THINGS TO AVOID:
- Don't list skills as bullet points.
- Don't make up experience; use ONLY the provided resume profile.
- Don't make the email longer than 120-130 words.

SUBJECT LINE: Make it attractive and curiosity-driven, under 8 words. Example: "Experienced engineer available immediately", "Saw your latest project - quick question"

Return ONLY valid JSON (no markdown fences):
{
  "subject": "",
  "body": ""
}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const raw = response.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

/**
 * Suggest the optimal time to send an email to a recruiter.
 */
async function suggestSendTime(companyName, recruiterInfo) {
  const ai = await getClient();
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

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const raw = response.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return { suggestedTime: 'Tuesday 9:00 AM', reason: 'Tuesdays typically have highest email open rates.' };
  }
}

/**
 * Analyze a recruiter's reply and suggest a response.
 */
async function analyzeReply(originalEmail, replyText, profile) {
  const ai = await getClient();
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

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const raw = response.text.trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

module.exports = {
  parseResume,
  researchCompany,
  generateEmail,
  suggestSendTime,
  analyzeReply,
};
