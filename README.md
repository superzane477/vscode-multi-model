# Multi-Model AI Assistant for VS Code

A VS Code extension that lets you switch between AI models via a sidebar dropdown and chat with them directly in your editor.

## Features

- **Model Switching**: Quickly switch between GPT-5.4 and Claude Sonnet 4.6 via a dropdown
- **Sidebar Chat**: Full chat interface in the VS Code sidebar
- **Streaming Responses**: Real-time streaming output from AI models
- **Code Actions**: Right-click on selected code to "Ask AI" or "Explain Code"
- **Theme Adaptive**: Automatically adapts to your VS Code light/dark theme

## Supported Models

| Model | Best For |
|-------|---------|
| GPT-5.4 | General tasks, reasoning, creative writing |
| Claude Sonnet 4.6 | Code generation, technical analysis |

## Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd vscode-multi-model
   npm install
   ```

2. Configure your API credentials in VS Code Settings:
   - `multiModelAI.apiKey` — Your API key
   - `multiModelAI.apiBaseUrl` — Base URL (default: `https://api.example.com/v1`)

   Or copy `env.example` to `.env` and fill in your values.

3. Build and run:
   ```bash
   npm run compile
   ```
   Then press `F5` in VS Code to launch the extension in a development host.

## Usage

1. Click the AI icon in the activity bar to open the sidebar
2. Select your preferred model from the dropdown
3. Type a message and press Enter or click Send
4. To analyze code: select code in the editor, right-click, and choose "Ask AI" or "Explain Code with AI"

## Architecture

```
src/
├── extension.ts           # Extension entry point, registers commands and views
├── sidebar/
│   └── SidebarProvider.ts # Webview sidebar provider (model selection + chat)
├── services/
│   └── aiService.ts       # Unified AI API client (OpenAI-compatible format)
└── types.ts               # Type definitions and model list
media/
├── sidebar.html           # Sidebar webview markup
├── sidebar.css            # VS Code theme-adaptive styles
└── sidebar.js             # Frontend interaction logic
```

The extension uses the OpenAI-compatible Chat Completions API format (`/chat/completions`). Switching models is done by changing the `model` parameter — no endpoint changes needed.

## Development

```bash
npm run compile   # Build
npm run watch     # Watch mode
npm test          # Run tests
```

## License

MIT
