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
    "Use a balanced, grounded tone: confident but not boastful.",
    "Do not use hype language, superlatives, or self-congratulatory phrasing.",
    "Write in a natural, human voice with varied sentence rhythm.",
    "Avoid generic AI-sounding templates, buzzwords, and repetitive transitions.",
    "Write in clear undergraduate-level language: direct, specific, and easy to read.",
    "Do not use em dashes.",
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
      ? `Format as a formal business letter suitable for PDF submission. Use this exact date line: ${today}. Include a company header before the greeting. If a real company address is available from the provided context, include company name plus address lines. If no real address is available, still include a company header line using only the real company name. Do not use placeholders such as [Company Address] or any bracketed placeholder text. Include recipient greeting, concise body paragraphs, and a professional sign-off. Keep total length likely to fit one PDF page.`
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
    "Show both contribution and learning mindset, with practical and specific wording.",
    "Infer likely motivations and fit from the resume and job description, and express them clearly without speculation.",
    "Highlight 2-3 differentiators backed by concrete resume evidence, without comparing against other applicants.",
    "Do not include a failure lesson, growth lesson, or reflective anecdote section.",
    "Do not mention draining environments, interpersonal negatives, or private concerns.",
    "Use numbers very sparingly: at most 1 numeric claim, only when clearly supported by the resume/job description, and skip numbers entirely when not essential.",
    "Do not mention GPA unless the job description explicitly requests GPA, transcript, or an academic threshold.",
    "Avoid exaggerated adjectives like outstanding, exceptional, world-class, or best-in-class.",
    "Avoid stock phrasing like 'I am excited to apply' unless rewritten in a specific way tied to this role.",
    "Prefer plain verbs and concrete examples over corporate jargon.",
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
    "Use a balanced, grounded tone: confident, specific, and not boastful.",
    "Return only the final answer paragraph text.",
    "Do not include prefaces, labels, framing sentences, or meta commentary.",
    "Do not write phrases like 'Here is your answer' or similar.",
    "Output plain text only, without markdown."
  ].join(" ");
}

export function buildAnswerUserPrompt(input: QuestionAnswerRequest): string {
  return [
    `Tone: ${input.tone}`,
    "Length: one paragraph, around 90-140 words.",
    "Write in first person and keep it specific and authentic.",
    "If the company uses leadership principles (for example Amazon), align the answer to relevant principles naturally.",
    "Use no more than one numeric claim unless the question specifically asks for metrics.",
    "Do not mention GPA unless the question or job description explicitly asks for it.",
    "Output only one paragraph with no intro line and no trailing explanation.",
    "Do not use em dashes.",
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
