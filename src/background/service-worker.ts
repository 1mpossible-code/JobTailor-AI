import { generateWithAnthropic } from "../lib/providers/anthropic.js";
import { generateWithOpenAI } from "../lib/providers/openai.js";
import {
  buildAnswerSystemPrompt,
  buildAnswerUserPrompt,
  buildSystemPrompt,
  buildUserPrompt
} from "../lib/prompt.js";
import { getSettings } from "../lib/storage.js";
import type {
  GenerationRequest,
  GenerationResponse,
  HumanizeTextRequest,
  HumanizeTextResponse,
  Provider,
  QuestionAnswerRequest,
  QuestionAnswerResponse
} from "../lib/types.js";

interface GenerateMessage {
  type: "GENERATE_COVER_LETTER";
  payload: Omit<GenerationRequest, "resumeText" | "model"> & { model?: string; resumeText?: string };
}

interface GenerateAnswerMessage {
  type: "GENERATE_QUESTION_ANSWER";
  payload: Omit<QuestionAnswerRequest, "resumeText" | "model"> & { model?: string; resumeText?: string };
}

interface HumanizeMessage {
  type: "GENERATE_HUMANIZED_TEXT";
  payload: HumanizeTextRequest;
}

type RuntimeMessage = GenerateMessage | GenerateAnswerMessage | HumanizeMessage;

function stripEmDashes(text: string): string {
  return text.replace(/[—–]/g, "-");
}

function createHumanizeSessionId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(26);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function humanizeText(inputText: string): Promise<string> {
  const params = new URLSearchParams();
  params.set("aiText", inputText);
  params.set("captchaInput", "");
  params.set("mode", "BASIC");
  params.set("readability", "Standard");
  params.set("freeze_keywords", "");

  const response = await fetch("https://www.humanizeai.io/humanize_adv.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: `clickCount=1; humanizeai_session=${createHumanizeSessionId()}`
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Humanize request failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    message?: string;
    message2?: string;
    error?: string;
  };

  if (String(payload.error ?? "No") !== "No") {
    throw new Error(`Humanize API returned error: ${String(payload.error ?? "Unknown error")}`);
  }

  const firstVersion = String(payload.message ?? "").trim();
  if (!firstVersion) {
    throw new Error("Humanize API returned an empty primary response.");
  }

  return stripEmDashes(firstVersion);
}

function assertInput(req: GenerationRequest): void {
  if (!req.jobText.trim()) {
    throw new Error("Job description is required.");
  }
  if (!req.resumeText.trim()) {
    throw new Error("Resume is empty. Add your resume in extension settings.");
  }
}

async function generateLetter(req: GenerationRequest, apiKey: string, provider: Provider): Promise<string> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(req);

  if (provider === "anthropic") {
    return generateWithAnthropic({
      apiKey,
      model: req.model,
      systemPrompt,
      userPrompt
    });
  }

  return generateWithOpenAI({
    apiKey,
    model: req.model,
    systemPrompt,
    userPrompt
  });
}

async function generateAnswer(req: QuestionAnswerRequest, apiKey: string, provider: Provider): Promise<string> {
  const systemPrompt = buildAnswerSystemPrompt();
  const userPrompt = buildAnswerUserPrompt(req);

  if (provider === "anthropic") {
    return generateWithAnthropic({
      apiKey,
      model: req.model,
      systemPrompt,
      userPrompt
    });
  }

  return generateWithOpenAI({
    apiKey,
    model: req.model,
    systemPrompt,
    userPrompt
  });
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (
    message?.type !== "GENERATE_COVER_LETTER" &&
    message?.type !== "GENERATE_QUESTION_ANSWER" &&
    message?.type !== "GENERATE_HUMANIZED_TEXT"
  ) {
    return;
  }

  (async () => {
    try {
      if (message.type === "GENERATE_HUMANIZED_TEXT") {
        const sourceText = message.payload.text.trim();
        if (!sourceText) {
          throw new Error("Nothing to humanize.");
        }
        const text = await humanizeText(sourceText);
        const response: HumanizeTextResponse = { text };
        sendResponse({ ok: true, data: response });
        return;
      }

      const settings = await getSettings();
      const provider = message.payload.provider ?? settings.provider;
      const apiKey = settings.apiKeys[provider]?.trim();
      const model = (message.payload.model ?? settings.models[provider]).trim();
      const resumeText = (message.payload.resumeText ?? "").trim();

      if (!apiKey) {
        throw new Error(`Missing ${provider} API key. Add it in Settings.`);
      }

      if (message.type === "GENERATE_COVER_LETTER") {
        const request: GenerationRequest = {
          provider,
          model,
          tone: message.payload.tone,
          length: message.payload.length,
          jobText: message.payload.jobText,
          resumeText,
          outputFormat: message.payload.outputFormat ?? "paste",
          currentDate: message.payload.currentDate,
          candidateName: message.payload.candidateName?.trim() || undefined
        };

        assertInput(request);
        const letter = stripEmDashes(await generateLetter(request, apiKey, provider));
        const response: GenerationResponse = { letter };
        sendResponse({ ok: true, data: response });
        return;
      }

      const answerRequest: QuestionAnswerRequest = {
        provider,
        model,
        tone: message.payload.tone,
        jobText: message.payload.jobText,
        resumeText,
        question: message.payload.question
      };

      if (!answerRequest.question.trim()) {
        throw new Error("Question is required.");
      }
      assertInput({
        ...answerRequest,
        length: "standard",
        outputFormat: "paste"
      });

      const answer = stripEmDashes(await generateAnswer(answerRequest, apiKey, provider));
      const response: QuestionAnswerResponse = { answer };
      sendResponse({ ok: true, data: response });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unknown generation error.";
      sendResponse({ ok: false, error: messageText });
    }
  })();

  return true;
});
