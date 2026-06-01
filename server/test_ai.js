const ai = require('./services/ai');

async function test() {
  const profile = { name: "Test User", experience: [] };
  const company = { companyName: "Test Company" };
  const recruiter = { recruiterName: "Test Recruiter", email: "test@test.com", company: "Test Company" };
  
  console.log("Generating email...");
  try {
    const res = await ai.generateEmail(profile, company, recruiter, {});
    console.log("RESULT:", res);
  } catch (err) {
    console.error("ERROR:", err);
  }
}
test();
