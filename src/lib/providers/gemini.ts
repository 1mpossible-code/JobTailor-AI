interface GeminiRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

export async function generateWithGemini(input: GeminiRequest): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { candidates?: GeminiCandidate[] };
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  return content;
}
