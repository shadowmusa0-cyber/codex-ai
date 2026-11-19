const messages = document.getElementById("messages");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const statusBox = document.getElementById("status");

const passwordOverlay = document.getElementById("passwordOverlay");
const passwordInput = document.getElementById("accessPassword");
const unlockBtn = document.getElementById("unlockBtn");
const passwordError = document.getElementById("passwordError");

let conversation = [];
let selectedFiles = [];

const MAX_FILES = 8;
const MAX_FILE_SIZE = 60 * 1024;

// -----------------------------
// Access password
// -----------------------------

function getPassword() {
  return sessionStorage.getItem("codex_access") || "";
}

function showPasswordDialog() {
  passwordOverlay.classList.add("show");
}

function hidePasswordDialog() {
  passwordOverlay.classList.remove("show");
}

if (getPassword()) {
  hidePasswordDialog();
} else {
  showPasswordDialog();
}

unlockBtn.addEventListener("click", () => {
  const password = passwordInput.value.trim();

  if (!password) {
    passwordError.textContent = "Please enter your password.";
    return;
  }

  sessionStorage.setItem("codex_access", password);
  passwordError.textContent = "";
  hidePasswordDialog();
  passwordInput.value = "";
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    unlockBtn.click();
  }
});

// -----------------------------
// Status
// -----------------------------

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.className = isError ? "status error" : "status";
}

// -----------------------------
// Safe message formatting
// -----------------------------

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[char];
  });
}

function formatMarkdown(text) {
  const lines = String(text).split("\n");
  let html = "";
  let inCode = false;
  let inList = false;
  let codeLines = [];

  function inlineFormat(value) {
    let result = escapeHTML(value);

    result = result.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );

    result = result.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    result = result.replace(
      /\*(.*?)\*/g,
      "<em>$1</em>"
    );

    return result;
  }

  function closeList() {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  }

  for (const line of lines) {

    if (line.startsWith("```")) {

      closeList();

      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        html += `
          <pre>
            <button class="copy-code" type="button">
              Copy
            </button>
            <code>${escapeHTML(codeLines.join("\n"))}</code>
          </pre>
        `;

        inCode = false;
      }

      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      closeList();

      const level = heading[1].length;

      html += `<h${level}>${inlineFormat(heading[2])}</h${level}>`;

      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }

      html += `<li>${inlineFormat(
        line.replace(/^\s*[-*]\s+/, "")
      )}</li>`;

      continue;
    }

    closeList();

    if (!line.trim()) {
      continue;
    }

    html += `<p>${inlineFormat(line)}</p>`;
  }

  closeList();

  if (inCode) {
    html += `<pre><code>${escapeHTML(codeLines.join("\n"))}</code></pre>`;
  }

  return html;
}

// -----------------------------
// Display messages
// -----------------------------

function addMessage(role, text) {

  const message = document.createElement("article");

  message.className = `message ${role}`;

  const label = document.createElement("div");

  label.className = "message-label";

  label.textContent =
    role === "user" ? "YOU" : "CODEX AI";

  const content = document.createElement("div");

  content.className = "message-content";

  if (role === "assistant") {
    content.innerHTML = formatMarkdown(text);
  } else {
    content.textContent = text;
  }

  message.appendChild(label);
  message.appendChild(content);

  messages.appendChild(message);

  document.getElementById("welcome").style.display = "none";

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
}

// -----------------------------
// Copy generated code
// -----------------------------

messages.addEventListener("click", async (event) => {

  const button = event.target.closest(".copy-code");

  if (!button) return;

  const code = button.parentElement.querySelector("code");

  try {
    await navigator.clipboard.writeText(code.textContent);

    button.textContent = "Copied!";

    setTimeout(() => {
      button.textContent = "Copy";
    }, 1500);

  } catch {
    button.textContent = "Copy manually";
  }
});

// -----------------------------
// File attachments
// -----------------------------

fileInput.addEventListener("change", () => {

  const files = Array.from(fileInput.files || []);

  if (files.length > MAX_FILES) {
    setStatus("Maximum 8 files allowed.", true);
    fileInput.value = "";
    return;
  }

  for (const file of files) {

    if (file.size > MAX_FILE_SIZE) {
      setStatus(
        `${file.name} is larger than 60 KB.`,
        true
      );

      fileInput.value = "";
      selectedFiles = [];
      fileList.textContent = "";
      return;
    }
  }

  selectedFiles = files;

  fileList.textContent = selectedFiles.length
    ? "Attached: " + selectedFiles.map(file => file.name).join(", ")
    : "";

  setStatus("Files ready.");
});

// -----------------------------
// Send message to AI
// -----------------------------

async function sendMessage() {

  const text = promptInput.value.trim();

  if (!text && selectedFiles.length === 0) {
    return;
  }

  const password = getPassword();

  if (!password) {
    showPasswordDialog();
    return;
  }

  const files = [];

  try {

    for (const file of selectedFiles) {

      files.push({
        name: file.name,
        content: await file.text()
      });

    }

  } catch {
    setStatus("Unable to read attached files.", true);
    return;
  }

  const userMessage = text ||
    "Please review my attached code files.";

  const displayMessage = userMessage +
    (files.length
      ? "\nAttached: " + files.map(file => file.name).join(", ")
      : "");

  addMessage("user", displayMessage);

  conversation.push({
    role: "user",
    parts: [
      {
        text: userMessage
      }
    ]
  });

  promptInput.value = "";
  selectedFiles = [];
  fileInput.value = "";
  fileList.textContent = "";

  sendBtn.disabled = true;

  setStatus("CodeX AI is thinking...");

  try {

    const response = await fetch("/api/chat", {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-codex-password": password
      },

      body: JSON.stringify({

        history: conversation.slice(-16),

        files: files

      })

    });

    const result = await response.json();

    if (response.status === 401) {

      sessionStorage.removeItem("codex_access");

      showPasswordDialog();

      passwordError.textContent =
        "Incorrect password. Please try again.";

      conversation.pop();

      throw new Error("Access denied.");

    }

    if (!response.ok) {
      throw new Error(
        result.error || "Something went wrong."
      );
    }

    const answer = result.text;

    if (!answer) {
      throw new Error("AI returned an empty response.");
    }

    conversation.push({
      role: "model",
      parts: [
        {
          text: answer
        }
      ]
    });

    addMessage("assistant", answer);

    setStatus("Ready.");

  } catch (error) {

    if (error.message !== "Access denied.") {
      conversation.pop();
      setStatus(error.message || "Connection failed.", true);
    }

  } finally {

    sendBtn.disabled = false;
    promptInput.focus();

  }
}

// -----------------------------
// Button events
// -----------------------------

sendBtn.addEventListener("click", sendMessage);

promptInput.addEventListener("keydown", event => {

  if (event.key === "Enter" && !event.shiftKey) {

    event.preventDefault();

    sendMessage();

  }

});

// -----------------------------
// Suggested prompts
// -----------------------------

document.querySelectorAll(".suggestion").forEach(button => {

  button.addEventListener("click", () => {

    promptInput.value = button.dataset.prompt || "";

    promptInput.focus();

  });

});

// -----------------------------
// New conversation
// -----------------------------

document.getElementById("newChat").addEventListener("click", () => {

  conversation = [];

  messages.innerHTML = "";

  selectedFiles = [];

  fileInput.value = "";

  fileList.textContent = "";

  document.getElementById("welcome").style.display = "block";

  setStatus("New conversation started.");

  promptInput.focus();

});

console.log("CodeX AI frontend initialized.");
