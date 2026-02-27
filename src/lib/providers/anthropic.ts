interface AnthropicRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

export async function generateWithAnthropic(input: AnthropicRequest): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 900,
      temperature: 0.4,
      system: input.systemPrompt,
      messages: [
        {
          role: "user",
          content: input.userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { content?: AnthropicTextBlock[] };
  const content = data.content?.find((block) => block.type === "text")?.text?.trim();

  if (!content) {
    throw new Error("Anthropic returned an empty response.");
  }

  return content;
}
