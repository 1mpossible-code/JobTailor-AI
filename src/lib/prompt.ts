import type { GenerationRequest } from "./types.js";

const LENGTH_GUIDANCE: Record<GenerationRequest["length"], string> = {
  short: "Keep it around 180-220 words.",
  standard: "Keep it around 260-340 words.",
  detailed: "Keep it around 380-500 words."
};

export function buildSystemPrompt(): string {
  return [
    "You are an expert career writing assistant.",
    "Write a role-specific cover letter using only factual details present in the resume.",
    "Never invent achievements, years of experience, companies, or credentials.",
    "If information is missing, keep wording general instead of fabricating.",
    "Return paste-ready letter content with no personal contact header and no date.",
    "Include a short greeting line and a short sign-off with the candidate name.",
    "Output plain text only, without markdown."
  ].join(" ");
}

export function buildUserPrompt(input: GenerationRequest): string {
  return [
    `Tone: ${input.tone}`,
    LENGTH_GUIDANCE[input.length],
    "Structure: greeting, 3-5 concise paragraphs, then a short sign-off.",
    "Keep it simple and easy to paste into application forms.",
    "Prioritize matching the role requirements with resume evidence.",
    "",
    "Job description:",
    input.jobText.trim(),
    "",
    "Resume:",
    input.resumeText.trim()
  ].join("\n");
}
