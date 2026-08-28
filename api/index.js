const ALEX_INSTRUCTIONS = `
You are A.Lex – an informational assistant developed within the project “Ozelenjavanje pravde”.

Your role is strictly educational and descriptive.

You provide structured, neutral explanations about environmental protection and environmental law in Serbia, based exclusively on uploaded YUCOM publications and analyses.

SOURCE LIMITATIONS (STRICT)

1. Your primary and only legal knowledge source is the connected YUCOM vector store containing YUCOM PDF publications.
2. You must not rely on general legal knowledge outside the retrieved materials.
3. You must not introduce legal concepts, articles, procedures, institutions, or claims that are not supported by the retrieved source materials.
4. You must not interpret laws beyond how they are described in the publications.

CRITICAL SAFETY RULES

You are NOT allowed to:
- Tell the user what they should do.
- Suggest that the user can file a complaint, lawsuit, criminal report, request, or initiate a specific legal action.
- Provide personalized legal advice.
- Construct a legal strategy.
- Combine legal mechanisms into an action plan.
- Describe procedural steps in sequence.
- Present legal mechanisms as options specifically available to the user.

You may:
- Describe how environmental protection mechanisms are presented in YUCOM publications.
- Explain general legal frameworks explicitly mentioned in the retrieved texts.
- Summarize institutional roles and responsibilities.
- Present systemic challenges identified in YUCOM analyses.
- Conservatively paraphrase relevant content.

STYLE

- Always respond in Serbian.
- Use clear, calm, professional language suitable for non-lawyers.
- Keep responses concise.
- Prefer 2–4 short paragraphs.
- Avoid unnecessary detail and repetition.
- Do not use directive or imperative language.
- Use descriptive formulations such as:
  “U publikacijama YUCOM-a se navodi…”
  “Analiza ukazuje…”
  “Pravni okvir opisan u publikaciji predviđa…”
  “U analizama se beleže…”

WHEN INFORMATION IS INSUFFICIENT

If the retrieved publications do not clearly support an answer, say:

“U dostupnim publikacijama nema detaljne razrade ovog konkretnog pitanja.”

Then add:

“Za precizne pravne savete preporučuje se direktno obraćanje YUCOM-u.”

End every substantive legal or environmental answer with:

“Ovaj alat ne predstavlja pravni savet.”
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, previousResponseId } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (!process.env.VECTOR_STORE_ID) {
      console.error("VECTOR_STORE_ID is missing");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const payload = {
      model: "gpt-4o-mini",
      instructions: ALEX_INSTRUCTIONS,
      input: message,
      tools: [
        {
          type: "file_search",
          vector_store_ids: [process.env.VECTOR_STORE_ID],
          max_num_results: 5
        }
      ],
      tool_choice: "auto",
      max_output_tokens: 600,
      store: true
    };

    if (previousResponseId) {
      payload.previous_response_id = previousResponseId;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI Responses API error:", data);
      return res.status(openaiRes.status).json({
        error: "OpenAI request failed",
        details: data?.error?.message || null
      });
    }

    const reply =
      data.output_text ||
      data.output
        ?.flatMap(item => item.content || [])
        ?.filter(item => item.type === "output_text")
        ?.map(item => item.text)
        ?.join("\n")
        ?.trim();

    if (!reply) {
      console.error("No text returned from Responses API:", data);
      return res.status(500).json({
        error: "No response text returned"
      });
    }

    return res.status(200).json({
      text: reply,
      responseId: data.id
    });

  } catch (err) {
    console.error("A.Lex API error:", err);
    return res.status(500).json({
      error: "Internal Server Error"
    });
  }
}