/* ============================================================
   MoneyWise AI — coach API server
   Calls an LLM on behalf of the app. The API key lives ONLY in
   the server environment (.env) — never in the mobile/web client.
   Uses the OpenAI-compatible chat completions shape, so it works
   with OpenAI and most compatible providers by pointing
   LLM_API_URL at their endpoint.
   ============================================================ */
"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());                      // allow the www app to call this origin
app.use(express.json({ limit: "1mb" }));

const API_KEY = process.env.LLM_API_KEY || "";
const API_URL = process.env.LLM_API_URL || "https://api.openai.com/v1/chat/completions";
const MODEL   = process.env.LLM_MODEL   || "gpt-4o-mini";
const PORT    = Number(process.env.PORT || 4000);

function money(n){ n = Number(n)||0; const s = n.toLocaleString("en-US",{ maximumFractionDigits: n%1===0?0:2 }); return "$"+s; }

// Build a focused system prompt from the user's finance snapshot
function systemPrompt(s){
  s = s || {};
  const debts = (s.debts||[]).map(d=>d.name+" ("+d.rate+"%) bal "+money(d.balance)+" min "+money(d.min)).join("; ") || "none";
  const goals = (s.goals||[]).map(g=>g.name+" target "+money(g.target)+" current "+money(g.current)).join("; ") || "none";
  return [
    "You are MoneyWise, a friendly, calm personal AI financial coach.",
    "Answer using ONLY the user's financial snapshot below. Be warm, simple and concrete.",
    "Rules:",
    "- Give educational information, estimates, budgeting guidance, calculations and general planning only.",
    "- Never claim to be a licensed financial advisor.",
    "- For investing, give general education and state the app does not provide personalized investment advice.",
    "- Never guarantee returns, savings results, debt payoff dates, or outcomes.",
    "- Never ask for sensitive info (passwords, SSN, full card numbers).",
    "- Keep it concise. Bold the single most useful point, then give 1-3 short action steps.",
    "",
    "Financial snapshot:",
    "- Monthly income: "+money(s.income),
    "- Money left each month: "+money(s.moneyLeft),
    "- Living expenses / month: "+money(s.livingExpenses),
    "- Savings: "+money(s.savings),
    "- Debts: "+debts,
    "- Goals: "+goals,
    "- Health score: "+(s.healthScore||"?")+"/100"
  ].join("\n");
}

app.post("/api/coach", async (req, res) => {
  const message  = (req.body && req.body.message) || "";
  const snapshot = (req.body && req.body.snapshot) || {};
  if(!message){ return res.status(400).json({ error: "message is required" }); }
  if(!API_KEY){ return res.status(503).json({ error: "Server not configured: set LLM_API_KEY (see .env.example). The key must live server-side, never in the app." }); }
  try{
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer "+API_KEY },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt(snapshot) },
          { role: "user",   content: message }
        ],
        temperature: 0.6
      })
    });
    const data = await r.json();
    if(!r.ok){ const m=(data.error && data.error.message) || r.status; throw new Error("provider "+r.status+": "+m); }
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if(!reply){ return res.status(502).json({ error: "LLM returned no content" }); }
    res.json({ reply: reply.trim() });
  }catch(e){
    res.status(500).json({ error: "LLM call failed: "+(e && e.message) });
  }
});

app.get("/", (_req, res) => res.json({ ok:true, name:"MoneyWise AI coach API", configured: !!API_KEY }));

app.listen(PORT, () => console.log(
  "MoneyWise coach API on http://localhost:"+PORT+"  "+(API_KEY?"(LLM configured)":"(LLM NOT configured - set LLM_API_KEY)")
));