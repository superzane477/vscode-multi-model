import * as vscode from "vscode";
import * as fs from "fs";
import { AIService } from "../services/aiService";
import { DEFAULT_MODELS, ChatMessage, Model } from "../types";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _aiService?: AIService;
  private _messages: ChatMessage[] = [];
  private _currentModel: string;
  private _models: Model[] = DEFAULT_MODELS;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri, private readonly _globalState: vscode.Memento) {
    this._currentModel = this._globalState.get("selectedModel", DEFAULT_MODELS[0].id);

    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("multiModelAI")) {
          this._aiService = undefined;
          this._sendInitWithDefaults();
          this._fetchAndUpdateModels();
        }
      })
    );
  }

  dispose() {
    this._disposables.forEach((d) => d.dispose());
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
          if (!message.shareContext) {
            this._messages = [];
          }
          break;
        case "newChat":
          this._messages = [];
          break;
        case "ready":
          this._sendInitWithDefaults();
          this._fetchAndUpdateModels();
          break;
        case "refreshModels":
          this._aiService = undefined;
          this._sendInitWithDefaults();
          this._fetchAndUpdateModels();
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

  private _sendInitWithDefaults() {
    if (!this._models.find((m) => m.id === this._currentModel) && this._models.length > 0) {
      this._currentModel = this._models[0].id;
    }
    this._view?.webview.postMessage({
      type: "init",
      models: this._models,
      currentModel: this._currentModel,
    });
  }

  private async _fetchAndUpdateModels() {
    try {
      const service = this._getAIService();
      const remoteModels = await service.fetchModels();
      if (remoteModels.length > 0) {
        this._models = remoteModels;
        this._sendInitWithDefaults();
      }
    } catch {
      // keep current models
    }
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
