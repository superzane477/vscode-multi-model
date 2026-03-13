import { AVAILABLE_MODELS, ChatMessage } from "../src/types";
import { AIService } from "../src/services/aiService";
import * as http from "http";
import * as assert from "assert";

let server: http.Server;
let serverPort: number;

function startMockServer(): Promise<void> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        const isStream = parsed.stream === true;

        res.writeHead(200, { "Content-Type": isStream ? "text/event-stream" : "application/json" });

        if (isStream) {
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello " } }] })}\n\n`
          );
          res.write(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "World" } }] })}\n\n`
          );
          res.write("data: [DONE]\n\n");
          res.end();
        } else {
          res.end(
            JSON.stringify({
              choices: [{ message: { content: `Response from ${parsed.model}` } }],
              model: parsed.model,
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            })
          );
        }
      });
    });

    server.listen(0, () => {
      serverPort = (server.address() as any).port;
      resolve();
    });
  });
}

async function testModels() {
  assert.strictEqual(AVAILABLE_MODELS.length, 2);
  assert.strictEqual(AVAILABLE_MODELS[0].id, "gpt-5.4");
  assert.strictEqual(AVAILABLE_MODELS[1].id, "claude-sonnet-4.6");
  console.log("  PASS: model definitions");
}

async function testChat() {
  const service = new AIService("test-key", `http://127.0.0.1:${serverPort}`);
  const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

  const response = await service.chat("gpt-5.4", messages);
  assert.strictEqual(response.content, "Response from gpt-5.4");
  assert.strictEqual(response.model, "gpt-5.4");
  assert.strictEqual(response.usage?.total_tokens, 15);
  console.log("  PASS: chat (gpt-5.4)");

  const response2 = await service.chat("claude-sonnet-4.6", messages);
  assert.strictEqual(response2.content, "Response from claude-sonnet-4.6");
  console.log("  PASS: chat (claude-sonnet-4.6)");
}

async function testStreamChat() {
  const service = new AIService("test-key", `http://127.0.0.1:${serverPort}`);
  const messages: ChatMessage[] = [{ role: "user", content: "Hi" }];
  const chunks: string[] = [];

  await service.streamChat("gpt-5.4", messages, (chunk) => {
    if (!chunk.done) {
      chunks.push(chunk.content);
    }
  });

  assert.deepStrictEqual(chunks, ["Hello ", "World"]);
  console.log("  PASS: stream chat");
}

async function main() {
  console.log("Running tests...\n");
  await startMockServer();

  try {
    await testModels();
    await testChat();
    await testStreamChat();
    console.log("\nAll tests passed!");
  } catch (err) {
    console.error("\nTest failed:", err);
    process.exit(1);
  } finally {
    server.close();
  }
}

main();
