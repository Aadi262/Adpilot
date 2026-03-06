'use strict';
require('dotenv').config();

const key = process.env.GEMINI_API_KEY;
const prompt = `Analyze this competitor and provide strategic insights.

Competitor: hubspot.com
Title: HubSpot CRM
Description: Marketing automation and CRM platform
Main Headings: Grow Better
CTAs: Get Started Free, Watch Demo
Keywords: crm, marketing automation, email marketing, sales
Tech Stack: React, Google Analytics

Return ONLY a JSON object (no markdown, no backticks):
{
  "keywordGaps": [{"keyword": "string", "opportunity": "brief opportunity note", "difficulty": "low|medium|high"}],
  "messagingAngles": ["3 angles to differentiate from them"],
  "weaknesses": ["gaps in their strategy to exploit"],
  "strengths": ["their strengths you must counter"],
  "suggestedAds": [{"headline": "string", "body": "string", "angle": "string"}]
}

Return 3-5 items in each array.`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  }),
}).then(r => r.json()).then(j => {
  const cand = j.candidates[0];
  const text = cand.content.parts[0].text;
  console.log('FINISH REASON:', cand.finishReason);
  console.log('LENGTH:', text.length);
  console.log('FIRST 150:', text.substring(0, 150));
  console.log('LAST  150:', text.substring(text.length - 150));

  // Direct parse attempt
  try { JSON.parse(text); console.log('\nDIRECT PARSE: OK'); return; } catch (e) { /* expected */ }

  // Strip backticks
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = stripped.search(/[\[{]/);
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    const candidate = stripped.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      console.log('\nEXTRACTED PARSE: OK — slice(' + start + ',' + (end+1) + ')');
    } catch (e) {
      console.log('\nEXTRACTED PARSE FAIL:', e.message);
      console.log('Near failure point:', candidate.substring(candidate.length - 200));
    }
  }
});
