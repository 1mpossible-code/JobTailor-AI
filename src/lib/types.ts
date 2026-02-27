export type Provider = "anthropic" | "openai";
export type Tone = "professional" | "confident" | "friendly";
export type LetterLength = "short" | "standard" | "detailed";

export interface AppSettings {
  provider: Provider;
  tone: Tone;
  length: LetterLength;
  fullName: string;
  sessionOnlyResume: boolean;
  models: Record<Provider, string>;
  apiKeys: Record<Provider, string>;
}

export interface GenerationRequest {
  provider: Provider;
  model: string;
  tone: Tone;
  length: LetterLength;
  jobText: string;
  resumeText: string;
  outputFormat?: "paste" | "pdf";
  currentDate?: string;
  candidateName?: string;
}

export interface GenerationResponse {
  letter: string;
}
