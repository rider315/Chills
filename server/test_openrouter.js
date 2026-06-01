const OpenAI = require('openai');
const config = require('./config');

async function test() {
  const apiKey = config.openRouterApiKey || process.env.OPENROUTER_API_KEY;
  const ai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
  });

  try {
    const response = await ai.chat.completions.create({
      model: 'openrouter/free',
      messages: [{ role: 'user', content: 'Say hello!' }],
      max_tokens: 1500,
    });
    console.log("RESPONSE:", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
test();
