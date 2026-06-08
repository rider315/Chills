const OpenAI = require('openai');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });

const apiKey = process.env.GEMINI_API_KEY;

const ai = new OpenAI({
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  apiKey: apiKey,
});

async function test(modelName) {
  try {
    const response = await ai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Say hi' }],
    });
    console.log(`Success with ${modelName}:`, response.choices[0].message.content);
  } catch (err) {
    console.error(`Error with ${modelName}:`, err.message);
  }
}

async function run() {
  await test('gemini-2.5-flash-8b');
  await test('gemini-2.5-pro');
}

run();
