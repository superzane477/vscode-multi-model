export interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export const AVAILABLE_MODELS: Model[] = [
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "OpenAI",
    description: "Best for general tasks, reasoning, and creative writing",
  },
  {
    id: "claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    description: "Optimized for code generation and technical analysis",
  },
];
