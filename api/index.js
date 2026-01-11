import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "OpenAI-Beta": "assistants=v2",
    "Content-Type": "application/json"
  }
});

let threads = {};

app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    if (!threads[sessionId]) {
      const threadRes = await openai.post("/threads", {});
      threads[sessionId] = threadRes.data.id;
    }

    const threadId = threads[sessionId];

    await openai.post(`/threads/${threadId}/messages`, {
      role: "user",
      content: message
    });

    const run = await openai.post(`/threads/${threadId}/runs`, {
      assistant_id: process.env.ASSISTANT_ID
    });

    let status = run.data.status;
    let runId = run.data.id;
    while (status !== "completed") {
      const poll = await openai.get(`/threads/${threadId}/runs/${runId}`);
      status = poll.data.status;
      if (status === "failed" || status === "cancelled") {
        return res.status(500).json({ error: "Run failed." });
      }
      if (status !== "completed") await new Promise(r => setTimeout(r, 1500));
    }

    const messagesRes = await openai.get(`/threads/${threadId}/messages`);
    const last = messagesRes.data.data.find(msg => msg.role === "assistant");
    const reply = last.content[0].text.value;

    res.json({ text: reply });
  } catch (err) {
    console.error("Error:", err?.response?.data || err.message);
    res.status(500).json({
        error: "Nažalost, došlo je do greške. Molimo pokušajte ponovo kasnije ili se obratite YUCOM-u za pomoć."
    });
  }
});

app.post("/reset", (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && threads[sessionId]) {
    delete threads[sessionId];
  }
  res.json({ message: "Session reset." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ A.Lex backend proxy running at http://localhost:${PORT}`));
