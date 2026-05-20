/**
 * aiAdvisor.js
 * ------------
 * Calls the Gemini API with a semantic canvas summary and returns
 * structured architecture improvement suggestions.
 *
 * WHY on the backend: API keys must never reach the browser.
 * The client sends a lightweight "semantic summary" (labels, types,
 * connections) — NOT the full tldraw JSON — to keep payloads small.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization: resolved INSIDE the function so process.env is
// guaranteed to be populated by dotenv regardless of ESM hoisting order.
let _genAI = null;
function getGenAI() {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set. Ensure .env exists in the backend root and dotenv.config() runs before any imports.'
      );
    }
    console.log(`[AIAdvisor] Initializing Gemini with key: ${apiKey.slice(0, 8)}...`);
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

const RESPONSE_SCHEMA = `{
  "apis": ["string"],
  "database": ["string"],
  "missing": ["string"],
  "improvements": ["string"],
  "verdict": "string"
}`;

const MODE_CONFIGS = {
  architect: {
    role: "senior software architect reviewing a system architecture diagram",
    emptyResponse: {
      apis: ['Add some shapes and labels to get API recommendations.'],
      database: ['Label your data stores for database recommendations.'],
      missing: ['Canvas appears empty — draw your architecture first.'],
      improvements: ['Try adding boxes for each service and arrows for data flow.'],
      verdict: 'Canvas is empty or has no labeled components.',
    },
    rules: `- "apis": 3-5 specific API/protocol recommendations (e.g. "Use REST for CRUD operations", "Use WebSockets for real-time sync")
- "database": 2-4 specific database design recommendations based on what's visible
- "missing": 2-5 components or patterns that are notably absent from this architecture
- "improvements": 3-5 concrete scalability or reliability improvements
- "verdict": A single sentence (max 25 words) summarizing the architecture's overall quality and main concern`
  },
  uiux: {
    role: "senior product designer and UX/UI expert reviewing a user interface wireframe or mockup",
    emptyResponse: {
      apis: ['Draw wireframe structures or component cards to get UX feedback.'],
      database: ['Add buttons, forms, or pages to get design guidelines feedback.'],
      missing: ['Create visual elements to receive accessibility (a11y) recommendations.'],
      improvements: ['Draft your interface layout to get styling and layout suggestions.'],
      verdict: 'Canvas is empty — start drawing user interface wireframes first.',
    },
    rules: `- "apis": 3-5 actionable UX/usability insights (e.g., "The login flow is too long", "Input fields should have clear helper text")
- "database": 2-4 guidelines relating to layout, alignment, or missing standard components (like Tailwind or Material UI styles)
- "missing": 2-5 accessibility (a11y) gaps (e.g., "Missing aria-labels on buttons", "Poor contrast in visual grouping")
- "improvements": 3-5 UI layout and component alignment improvement suggestions (e.g., "Add loading state for authentication form")
- "verdict": A single sentence (max 25 words) summarizing the UI/UX review`
  },
  brainstorm: {
    role: "startup consultant and business strategist reviewing a brainstorming mind-map, notes, or business model",
    emptyResponse: {
      apis: ['Add notes, text cards, or ideas to get structure analysis.'],
      database: ['List concepts or business models to get a SWOT analysis.'],
      missing: ['Map out your ideas to find business or topic gaps.'],
      improvements: ['Start brainstorming to get actionable next steps for your ideas.'],
      verdict: 'Canvas is empty — type some notes or build a mind map first.',
    },
    rules: `- "apis": 3-5 feedback items on the ideas organization, clustering, and logical linkages (e.g., "Group marketing ideas separate from product logic")
- "database": exactly 4 SWOT items representing Strength, Weakness, Opportunity, and Threat (prefixed with "Strength: ", "Weakness: ", "Opportunity: ", "Threat: ")
- "missing": 2-5 overlooked ideas, market gaps, target audience considerations, or business risks (e.g., "No customer retention strategy noted")
- "improvements": 3-5 concrete next steps or milestones to pursue (e.g., "Conduct customer interviews next")
- "verdict": A single sentence (max 25 words) summarizing the brainstormed idea's potential and main challenge`
  },
  flowchart: {
    role: "systems analyst and process engineer reviewing a decision flowchart, process flow, or drawing logic",
    emptyResponse: {
      apis: ['Draw flowchart nodes or process steps to get a logical summary.'],
      database: ['Connect steps with arrows to receive flow optimization tips.'],
      missing: ['Define a decision flow to find missing paths or loops.'],
      improvements: ['Add flowchart boxes to get logic and flow refinement advice.'],
      verdict: 'Canvas is empty — draw a flowchart or diagram process steps first.',
    },
    rules: `- "apis": 2-3 sentences summarizing what process or flow is depicted (e.g., "This chart depicts a user checkout flow")
- "database": 2-4 steps to simplify or optimize the flowchart path (e.g., "Combine step A and B to reduce user friction")
- "missing": 2-5 missing paths, edge cases, error conditions, or exceptions (e.g., "No path for when payment fails")
- "improvements": 3-5 adjustments to enhance logic flow and decision paths
- "verdict": A single sentence (max 25 words) summarizing the flow's clarity and completeness`
  }
};

/**
 * Generates architecture suggestions from a canvas semantic summary.
 * @param {object} summary - { shapes: [{id, type, label}], connections: [{from, to, fromLabel, toLabel}], textLabels: string[] }
 * @param {string} mode - 'architect' | 'uiux' | 'brainstorm' | 'flowchart'
 * @returns {Promise<object>} - Structured suggestions
 */
export async function getArchitectureSuggestions(summary, mode = 'architect') {
  const { shapes = [], connections = [], textLabels = [] } = summary;

  const currentMode = MODE_CONFIGS[mode] || MODE_CONFIGS.architect;

  if (shapes.length === 0 && textLabels.length === 0) {
    return currentMode.emptyResponse;
  }

  const shapesList = shapes
    .map((s) => `"${s.label || s.type}" (${s.type})`)
    .join(', ');

  const connectionsList =
    connections.length > 0
      ? connections
        .map((c) => `"${c.fromLabel}" → "${c.toLabel}"`)
        .join(', ')
      : 'none';

  const textList = textLabels.filter(Boolean).join(', ') || 'none';

  const prompt = `You are a ${currentMode.role}.

Diagram summary:
- Components: ${shapesList || 'none'}
- Data flows (arrows): ${connectionsList}
- Text labels: ${textList}

Analyze this architecture and respond ONLY with a valid JSON object matching this schema exactly:
${RESPONSE_SCHEMA}

Rules:
${currentMode.rules}
- Be specific to what's in the diagram. Do NOT give generic advice.
- Each string in arrays must be a complete, actionable sentence.
- Return ONLY the JSON. No markdown, no explanation outside the JSON.`;

  try {
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.4
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Robust JSON extraction — handles cases where model adds markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize structure
    return {
      apis: Array.isArray(parsed.apis) ? parsed.apis : [],
      database: Array.isArray(parsed.database) ? parsed.database : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      verdict: typeof parsed.verdict === 'string' ? parsed.verdict : 'Analysis complete.',
    };
  } catch (err) {
    console.error('[AIAdvisor] Gemini error:', err.message);
    throw new Error('AI analysis failed. Please check your GEMINI_API_KEY.');
  }
}
