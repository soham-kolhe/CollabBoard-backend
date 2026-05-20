/**
 * test-gemini.js
 * --------------
 * Standalone script to verify Gemini API connectivity.
 * Run with: node --env-file=.env test-gemini.js
 * (The --env-file flag is the ESM-safe way to load .env BEFORE any imports)
 */

import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

console.log('─────────────────────────────────────────');
console.log('🔍 Gemini API Connection Test');
console.log('─────────────────────────────────────────');

// 1. Check key is present
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is NOT set in process.env');
  console.error('   Make sure .env exists in this directory and has no spaces around =');
  process.exit(1);
}

console.log(`✅ API Key found: ${apiKey.slice(0, 8)}... (length: ${apiKey.length})`);

// 2. Try to call the API
try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  console.log('\n📡 Sending test prompt to gemini-2.5-flash...');
  const result = await model.generateContent('Say "API connection successful" and nothing else.');
  const text = result.response.text().trim();

  console.log(`\n✅ Response received: "${text}"`);
  console.log('\n🎉 SUCCESS — Your Gemini API key is working correctly!');
} catch (err) {
  console.error('\n❌ API call failed:', err.message);
  if (err.message.includes('403')) {
    console.error('\n💡 403 Forbidden causes:');
    console.error('   1. API key is empty/invalid (check above preview)');
    console.error('   2. Gemini API not enabled in Google Cloud Console');
    console.error('   3. Key has IP restrictions — disable them in GCP IAM');
    console.error('   4. Billing not set up for your GCP project');
  }
  process.exit(1);
}
