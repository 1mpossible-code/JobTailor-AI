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

type RuntimeMessage = GenerateMessage | GenerateAnswerMessage;

function stripEmDashes(text: string): string {
  return text.replace(/[—–]/g, "-");
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
  if (message?.type !== "GENERATE_COVER_LETTER" && message?.type !== "GENERATE_QUESTION_ANSWER") {
    return;
  }

  (async () => {
    try {
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
