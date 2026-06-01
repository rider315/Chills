const OpenAI = require('openai');
const config = require('./config');

async function test() {
  const apiKey = config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  const ai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
  });

  const prompt = `You are writing an ATTRACTIVE COLD EMAIL from a job seeker to a recruiter. The goal is to impress the recruiter by summarizing the applicant's real experience effectively and connecting it to the company.

APPLICANT PROFILE:
{}

COMPANY RESEARCH:
{}

RECRUITER INFO:
- Name: Test
- Email: test@test.com
- Company: Test Company

WRITING RULES — FOLLOW EVERY ONE:
- Write like a real human, not a robot. Use simple, everyday words. Friendly and professional.
- NO corporate buzzwords: "synergy", "leverage", "passionate", "rockstar", "thrilled".

Return your response EXACTLY in the following format (do not add any other text):

SUBJECT: <your subject line>
BODY:
<your email body>`;

  try {
    const response = await ai.chat.completions.create({
      model: 'openrouter/free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    });
    console.log("RESPONSE:", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
test();
