// Vercel serverless function: keeps API keys on the server.
// Tries Gemini first, then Groq as a backup.

const PROVIDERS = [
  { name: "Gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: () => process.env.GEMINI_API_KEY, models: ["gemini-3-flash-preview", "gemini-flash-latest"] },
  { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY, models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"] },
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const messages = req.body?.messages;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages missing" });

  const errors = [];
  for (const p of PROVIDERS) {
    const key = p.key();
    if (!key) { errors.push(`${p.name}: no key set`); continue; }
    for (const model of p.models) {
      try {
        const r = await fetch(p.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages, max_tokens: 1500 }),
        });
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        if (r.ok && text) return res.status(200).json({ reply: text, via: `${p.name} (${model})` });
        errors.push(`${p.name} ${model}: ${JSON.stringify(data).slice(0, 200)}`);
      } catch (e) {
        errors.push(`${p.name} ${model}: ${e.message}`);
      }
    }
  }
  res.status(502).json({ error: "All providers failed", details: errors });
}
