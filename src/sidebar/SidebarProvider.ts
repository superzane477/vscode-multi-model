import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { AIService } from "../services/aiService";
import { AVAILABLE_MODELS, ChatMessage } from "../types";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _aiService?: AIService;
  private _messages: ChatMessage[] = [];
  private _currentModel: string;

  constructor(private readonly _extensionUri: vscode.Uri, private readonly _globalState: vscode.Memento) {
    this._currentModel = this._globalState.get("selectedModel", AVAILABLE_MODELS[0].id);
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case "sendMessage":
          await this._handleUserMessage(message.text);
          break;
        case "switchModel":
          this._currentModel = message.modelId;
          this._globalState.update("selectedModel", message.modelId);
          break;
        case "ready":
          webviewView.webview.postMessage({
            type: "init",
            models: AVAILABLE_MODELS,
            currentModel: this._currentModel,
          });
          break;
      }
    });
  }

  get currentModel(): string {
    return this._currentModel;
  }

  async sendCodeQuery(code: string, action: string) {
    const prompt = action === "explain"
      ? `Explain the following code:\n\n\`\`\`\n${code}\n\`\`\``
      : `${action}:\n\n\`\`\`\n${code}\n\`\`\``;
    await this._handleUserMessage(prompt);
  }

  private _getAIService(): AIService {
    if (!this._aiService) {
      const config = vscode.workspace.getConfiguration("multiModelAI");
      const apiKey = config.get<string>("apiKey", "");
      const baseUrl = config.get<string>("apiBaseUrl", "https://api.example.com/v1");

      if (!apiKey) {
        throw new Error("API key not configured. Set it in Settings > Multi-Model AI > API Key");
      }

      this._aiService = new AIService(apiKey, baseUrl);
    }
    return this._aiService;
  }

  private async _handleUserMessage(text: string) {
    this._messages.push({ role: "user", content: text, timestamp: Date.now() });

    this._view?.webview.postMessage({
      type: "userMessage",
      text,
    });

    this._view?.webview.postMessage({ type: "loading", loading: true });

    try {
      const service = this._getAIService();
      let fullContent = "";

      await service.streamChat(this._currentModel, this._messages, (chunk) => {
        if (chunk.done) {
          this._messages.push({ role: "assistant", content: fullContent, timestamp: Date.now() });
          this._view?.webview.postMessage({ type: "loading", loading: false });
          this._view?.webview.postMessage({ type: "streamEnd" });
        } else {
          fullContent += chunk.content;
          this._view?.webview.postMessage({ type: "streamChunk", text: chunk.content });
        }
      });
    } catch (err: any) {
      this._view?.webview.postMessage({ type: "loading", loading: false });
      this._view?.webview.postMessage({
        type: "error",
        text: err.message || "Failed to get AI response",
      });
    }
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const mediaPath = vscode.Uri.joinPath(this._extensionUri, "media");
    const htmlPath = vscode.Uri.joinPath(mediaPath, "sidebar.html");
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, "sidebar.css"));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, "sidebar.js"));

    let html = fs.readFileSync(htmlPath.fsPath, "utf-8");
    html = html.replace("{{cssUri}}", cssUri.toString());
    html = html.replace("{{jsUri}}", jsUri.toString());

    return html;
  }
}
