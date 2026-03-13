(function () {
  var vscode;
  try {
    vscode = acquireVsCodeApi();
  } catch (e) {
    return;
  }

  var chatMessages = document.getElementById("chat-messages");
  var messageInput = document.getElementById("message-input");
  var sendBtn = document.getElementById("send-btn");
  var modelSelect = document.getElementById("model-select");
  var refreshBtn = document.getElementById("refresh-btn");
  var newChatBtn = document.getElementById("new-chat-btn");
  var contextToggleBtn = document.getElementById("context-toggle-btn");
  var statusBar = document.getElementById("status-bar");

  var currentAssistantEl = null;
  var isLoading = false;
  var shareContext = true;

  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  modelSelect.addEventListener("change", function () {
    vscode.postMessage({ type: "switchModel", modelId: modelSelect.value, shareContext: shareContext });
    setStatus("Switched to " + modelSelect.options[modelSelect.selectedIndex].textContent);
  });

  refreshBtn.addEventListener("click", function () {
    setStatus("Refreshing models...");
    vscode.postMessage({ type: "refreshModels" });
  });

  newChatBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "newChat" });
    clearChat();
    setStatus("New chat started");
  });

  contextToggleBtn.addEventListener("click", function () {
    shareContext = !shareContext;
    contextToggleBtn.className = shareContext ? "toggle-on" : "toggle-off";
    contextToggleBtn.title = shareContext ? "Context shared: new model sees previous chat" : "Context isolated: new model starts fresh";
    setStatus(shareContext ? "Context sharing ON" : "Context sharing OFF");
  });

  function clearChat() {
    chatMessages.innerHTML = "";
    currentAssistantEl = null;
    isLoading = false;
    sendBtn.disabled = false;
  }

  function setStatus(text) {
    if (statusBar) statusBar.textContent = text;
  }

  function sendMessage() {
    var text = messageInput.value.trim();
    if (!text || isLoading) return;

    vscode.postMessage({ type: "sendMessage", text: text });
    messageInput.value = "";
    messageInput.focus();
  }

  function addMessage(role, text) {
    var div = document.createElement("div");
    div.className = "message " + role;

    var label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "AI";
    div.appendChild(label);

    var content = document.createElement("div");
    content.innerHTML = formatContent(text);
    div.appendChild(content);

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function showLoading() {
    var div = document.createElement("div");
    div.className = "loading-indicator";
    div.id = "loading";
    div.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Thinking...</span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function hideLoading() {
    var el = document.getElementById("loading");
    if (el) el.remove();
  }

  function formatContent(text) {
    var escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, function (match, lang, code) {
      return "<pre><code>" + code.trim() + "</code></pre>";
    });

    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\n/g, "<br>");

    return escaped;
  }

  window.addEventListener("message", function (event) {
    var message = event.data;
    switch (message.type) {
      case "init":
        if (message.models && message.models.length > 0) {
          modelSelect.innerHTML = "";
          for (var i = 0; i < message.models.length; i++) {
            var m = message.models[i];
            var opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = m.description ? (m.name + " - " + m.description) : m.name;
            modelSelect.appendChild(opt);
          }
          if (message.currentModel) {
            modelSelect.value = message.currentModel;
          }
          setStatus(message.models.length + " models loaded");
        }
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
        var contentEl = currentAssistantEl.querySelector("div:last-child");
        var raw = (contentEl.getAttribute("data-raw") || "") + message.text;
        contentEl.setAttribute("data-raw", raw);
        contentEl.innerHTML = formatContent(raw);
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

  setStatus("Connecting...");
  vscode.postMessage({ type: "ready" });
})();
