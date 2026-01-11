export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, sessionId } = req.body;

    const openaiRes = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const thread = await openaiRes.json();
    const threadId = thread.id;

    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: "user",
        content: message
      })
    });

    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        assistant_id: process.env.ASSISTANT_ID
      })
    });

    const run = await runRes.json();
    let status = run.status;
    let runId = run.id;

    while (status !== "completed") {
      await new Promise(r => setTimeout(r, 1500));

      const poll = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });

      const runData = await poll.json();
      status = runData.status;

      if (status === "failed" || status === "cancelled") {
        return res.status(500).json({ error: "Run failed" });
      }
    }

    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "assistants=v2"
      }
    });

    const messages = await messagesRes.json();
    const last = messages.data.find(msg => msg.role === "assistant");

    const reply = last.content[0].text.value;

    return res.status(200).json({ text: reply });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
