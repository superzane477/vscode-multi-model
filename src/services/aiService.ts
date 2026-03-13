import * as https from "https";
import * as http from "http";
import { ChatMessage, AIResponse, StreamChunk, Model } from "../types";

export class AIService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async fetchModels(): Promise<Model[]> {
    const data = await this.get("/models");
    const parsed = JSON.parse(data);
    const list = parsed.data ?? parsed;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.map((m: any) => ({
      id: m.id,
      name: m.display_name || m.name || m.id,
      provider: m.owned_by || m.provider || "",
      description: m.description || "",
    }));
  }

  async chat(model: string, messages: ChatMessage[]): Promise<AIResponse> {
    const body = JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    });

    const data = await this.request("/chat/completions", body);
    const parsed = JSON.parse(data);

    return {
      content: parsed.choices?.[0]?.message?.content ?? "",
      model: parsed.model ?? model,
      usage: parsed.usage,
    };
  }

  async streamChat(
    model: string,
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const body = JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + "/chat/completions");
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
        (res) => {
          let buffer = "";
          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) {
                continue;
              }
              const payload = trimmed.slice(6);
              if (payload === "[DONE]") {
                onChunk({ content: "", done: true });
                return;
              }
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  onChunk({ content: delta, done: false });
                }
              } catch {
                // skip malformed chunks
              }
            }
          });
          res.on("end", () => resolve());
          res.on("error", reject);
        }
      );

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  private request(path: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`API error ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          });
          res.on("error", reject);
        }
      );

      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  private get(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: "GET",
          timeout: 10000,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => (data += chunk.toString()));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`API error ${res.statusCode}: ${data}`));
            } else {
              resolve(data);
            }
          });
          res.on("error", reject);
        }
      );

      req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
      req.on("error", reject);
      req.end();
    });
  }
}
