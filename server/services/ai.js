const config = require('../config');
const OpenAI = require('openai');

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    const apiKey = config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured. Set it in Settings or in the .env file.');
    }
    openaiClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
    });
  }
  return openaiClient;
}

const MODEL = 'openrouter/free'; // Uses OpenRouter's auto-fallback across free models to avoid rate limits

async function generateContent(prompt, retries = 2) {
  const ai = getClient();
  
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await ai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
      });
      
      const content = response.choices?.[0]?.message?.content;
      if (content) {
        return content;
      }
      console.warn(`Attempt ${i + 1}: Received null/empty content from OpenRouter. Raw response:`, JSON.stringify(response, null, 2));
    } catch (err) {
      console.error(`Attempt ${i + 1} failed:`, err.message);
      if (i === retries) throw err;
    }
  }
  return ""; // Ensure a string is always returned
}

/**
 * Parse resume text into a structured profile object.
 */
async function parseResume(text) {
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

  const raw = await generateContent(prompt);
  const safeRaw = raw || "";
  const cleaned = safeRaw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  if (!safeRaw) return { name: "", email: "", phone: "", skills: [], experience: [], education: [], summary: "", strengths: [] };
  return JSON.parse(cleaned);
}

/**
 * Research a company using AI.
 */
async function researchCompany(companyName) {
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

  const raw = await generateContent(prompt);
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
 */
async function generateEmail(profile, companyResearch, recruiterInfo, profileSettings = {}) {
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
   - Mention the attached resume NATURALLY as part of your ask (e.g., "I've attached my resume for more details. Would you be open to a quick chat?").
   - Do NOT add a generic "Resume attached" line at the very end.

4. SIGNATURE:
   Name
   [Print the exact raw contact details and URLs provided below on new lines. DO NOT embed the links over text. Do not use markdown like [Link](url). Format EXACTLY like:
   Mobile: +1234567890
   LinkedIn: https://linkedin.com/...
   Portfolio: https://...]

THINGS TO AVOID:
- NEVER use placeholders or brackets like [Hiring Manager's Name], [Company Name], or [Your Name]. If a specific name is missing, use a generic greeting like "Hi," or "Hi there," instead of a placeholder.
- Use ONLY the actual data provided in the RECRUITER INFO and APPLICANT PROFILE.
- Don't list skills as bullet points.
- Don't make up experience or company names.

SUBJECT LINE: Make it attractive and curiosity-driven, under 8 words. Example: "Experienced engineer available immediately", "Saw your latest project - quick question"

Return your response EXACTLY in the following format (do not add any other text):

SUBJECT: <your subject line>
BODY:
<your email body>
`;

  const raw = await generateContent(prompt);
  if (!raw) {
    throw new Error("AI service returned empty response. Please try generating again.");
  }

  try {
    const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = raw.match(/BODY:\s*([\s\S]+)/i);

    let subject = subjectMatch ? subjectMatch[1].trim() : "Job Application";
    let body = bodyMatch ? bodyMatch[1].trim() : raw.trim();

    // Clean up any potential markdown or quotes
    subject = subject.replace(/^"|"$/g, '');
    
    return { subject, body };
  } catch (err) {
    console.error("Failed to parse email text.", err.message);
    throw new Error("AI generated an invalid response format. Please try generating again.");
  }
}

/**
 * Suggest the optimal time to send an email to a recruiter.
 */
async function suggestSendTime(companyName, recruiterInfo) {
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

  const raw = await generateContent(prompt);
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
async function analyzeReply(originalEmail, replyText, profile) {
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

  const raw = await generateContent(prompt);
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
