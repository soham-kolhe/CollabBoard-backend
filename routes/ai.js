/**
 * ai.js — AI Advisor Routes
 * --------------------------
 * POST /api/ai/:boardId/suggest
 *
 * Accepts a semantic canvas summary from the frontend and returns
 * structured architecture suggestions via Gemini API.
 *
 * Auth is required to prevent abuse — only board members can use this.
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getArchitectureSuggestions } from '../services/aiAdvisor.js';

const router = express.Router();

// Rate limiting: simple in-memory throttle (1 req per board per 10 seconds)
const lastRequestTime = new Map();
const THROTTLE_MS = 10_000;

router.post('/:boardId/suggest', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { summary, mode } = req.body;

  // Input validation
  if (!summary || typeof summary !== 'object') {
    return res.status(400).json({ error: 'Request body must include a "summary" object.' });
  }

  // Throttle: prevent spam requests per board
  const now = Date.now();
  const last = lastRequestTime.get(boardId) || 0;
  if (now - last < THROTTLE_MS) {
    const waitSec = Math.ceil((THROTTLE_MS - (now - last)) / 1000);
    return res.status(429).json({
      error: `Please wait ${waitSec}s before requesting another analysis.`,
    });
  }
  lastRequestTime.set(boardId, now);

  try {
    const suggestions = await getArchitectureSuggestions(summary, mode);
    res.json({ suggestions });
  } catch (err) {
    console.error('[AI Route] Error:', err.message);
    res.status(500).json({
      error: err.message || 'AI analysis failed.',
    });
  }
});

export default router;
