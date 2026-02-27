import type { GenerationRequest, QuestionAnswerRequest } from "./types.js";

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
    "Follow the requested output formatting instructions exactly.",
    "Output plain text only, without markdown."
  ].join(" ");
}

export function buildUserPrompt(input: GenerationRequest): string {
  const format = input.outputFormat ?? "paste";
  const today =
    input.currentDate ??
    new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  const formatInstruction =
    format === "pdf"
      ? `Format as a formal business letter suitable for PDF submission. Use this exact date line: ${today}. Include recipient greeting, concise body paragraphs, and a professional sign-off. Keep total length likely to fit one PDF page.`
      : "Format for quick form paste. Keep greeting and sign-off, but no personal contact header and no date.";
  const candidateNameInstruction = input.candidateName
    ? `Use this exact candidate name in the sign-off: ${input.candidateName}.`
    : "";

  return [
    `Tone: ${input.tone}`,
    LENGTH_GUIDANCE[input.length],
    "Structure: greeting, 3-5 concise paragraphs, then a short sign-off.",
    formatInstruction,
    candidateNameInstruction,
    "Keep it simple and easy to paste into application forms.",
    "Prioritize matching the role requirements with resume evidence.",
    "",
    "Job description:",
    input.jobText.trim(),
    "",
    "Resume:",
    input.resumeText.trim()
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildAnswerSystemPrompt(): string {
  return [
    "You are an expert job application writing assistant.",
    "Write one concise, polished paragraph that answers the application question directly.",
    "Use only factual details present in the resume and job description.",
    "Never invent achievements, years of experience, companies, or credentials.",
    "Output plain text only, without markdown."
  ].join(" ");
}

export function buildAnswerUserPrompt(input: QuestionAnswerRequest): string {
  return [
    `Tone: ${input.tone}`,
    "Length: one paragraph, around 90-140 words.",
    "Write in first person and keep it specific and authentic.",
    "If the company uses leadership principles (for example Amazon), align the answer to relevant principles naturally.",
    "Avoid buzzwords and generic filler.",
    "",
    "Application question:",
    input.question.trim(),
    "",
    "Job description:",
    input.jobText.trim(),
    "",
    "Resume:",
    input.resumeText.trim()
  ].join("\n");
}
