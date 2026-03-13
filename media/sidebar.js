(function () {
  const vscode = acquireVsCodeApi();

  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const modelSelect = document.getElementById("model-select");

  let currentAssistantEl = null;
  let isLoading = false;

  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  modelSelect.addEventListener("change", () => {
    vscode.postMessage({ type: "switchModel", modelId: modelSelect.value });
  });

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isLoading) return;

    vscode.postMessage({ type: "sendMessage", text });
    messageInput.value = "";
    messageInput.focus();
  }

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = "message " + role;

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "AI";
    div.appendChild(label);

    const content = document.createElement("div");
    content.innerHTML = formatContent(text);
    div.appendChild(content);

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function showLoading() {
    const div = document.createElement("div");
    div.className = "loading-indicator";
    div.id = "loading";
    div.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Thinking...</span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function hideLoading() {
    const el = document.getElementById("loading");
    if (el) el.remove();
  }

  function formatContent(text) {
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      return "<pre><code>" + code.trim() + "</code></pre>";
    });

    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\n/g, "<br>");

    return escaped;
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "init":
        modelSelect.innerHTML = "";
        message.models.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = m.name + " - " + m.description;
          modelSelect.appendChild(opt);
        });
        modelSelect.value = message.currentModel;
        break;

      case "userMessage":
        addMessage("user", message.text);
        break;

      case "loading":
        isLoading = message.loading;
        sendBtn.disabled = isLoading;
        if (isLoading) {
          showLoading();
        } else {
          hideLoading();
        }
        break;

      case "streamChunk":
        if (!currentAssistantEl) {
          hideLoading();
          currentAssistantEl = addMessage("assistant", "");
        }
        const contentEl = currentAssistantEl.querySelector("div:last-child");
        contentEl.innerHTML = formatContent(
          (contentEl.getAttribute("data-raw") || "") + message.text
        );
        contentEl.setAttribute(
          "data-raw",
          (contentEl.getAttribute("data-raw") || "") + message.text
        );
        chatMessages.scrollTop = chatMessages.scrollHeight;
        break;

      case "streamEnd":
        currentAssistantEl = null;
        break;

      case "error":
        hideLoading();
        addMessage("error", message.text);
        currentAssistantEl = null;
        break;
    }
  });

  vscode.postMessage({ type: "ready" });
})();
