import * as vscode from "vscode";
import { SidebarProvider } from "./sidebar/SidebarProvider";
import { AVAILABLE_MODELS } from "./types";

let sidebarProvider: SidebarProvider;

export function activate(context: vscode.ExtensionContext) {
  sidebarProvider = new SidebarProvider(context.extensionUri, context.globalState);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("multi-model-sidebar-view", sidebarProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-multi-model.askAI", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage("Select some code first.");
        return;
      }
      await vscode.commands.executeCommand("multi-model-sidebar-view.focus");
      await sidebarProvider.sendCodeQuery(selection, "Analyze this code");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-multi-model.explainCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage("Select some code first.");
        return;
      }
      await vscode.commands.executeCommand("multi-model-sidebar-view.focus");
      await sidebarProvider.sendCodeQuery(selection, "explain");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-multi-model.switchModel", async () => {
      const items = AVAILABLE_MODELS.map((m) => ({
        label: m.name,
        description: m.description,
        id: m.id,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Select AI model",
      });
      if (picked) {
        vscode.window.showInformationMessage(`Switched to ${picked.label}`);
      }
    })
  );
}

export function deactivate() {}
