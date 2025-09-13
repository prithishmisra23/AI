function toggleChat() {
  const chatWindow = document.getElementById("chatbot-window");
  const icon = document.getElementById("chatbot-icon");
  if (chatWindow.style.display === "none" || chatWindow.style.display === "") {
    chatWindow.style.display = "flex";
    icon.style.display = "none"; // hide icon when open
  } else {
    chatWindow.style.display = "none";
    icon.style.display = "block"; // show icon again
  }
}

function handleKey(event) {
  if (event.key === "Enter") { sendMessage(); }
}

function sendMessage() {
  const input = document.getElementById("chatbot-input");
  const msg = input.value.trim();
  if (msg === "") return;

  addMessage(msg, "user");
  saveConversation(); // save after user message
  input.value = "";

  setTimeout(() => {
    const reply = getBotReply(msg);
    addMessage(reply, "bot");
    saveConversation(); // save after bot reply
  }, 500);
}

function addMessage(text, sender) {
  const container = document.getElementById("chatbot-messages");
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.innerText = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Bot reply logic
function getBotReply(input) {
  input = input.toLowerCase();

  if (input.includes("internship")) return "You can explore internships in the 'Find Internships' page.";
  if (input.includes("application")) return "Check your application status under 'My Applications'.";
  if (input.includes("skill")) return "Visit 'Skill Insights' to see your skill progress.";
  if (input.includes("profile")) return "You can update details in your 'Profile' page.";
  if (input.includes("setting")) return "Go to 'Settings' to change your preferences.";
  if (input.includes("pm scheme")) return "The PM Internship Scheme connects students with government internships easily.";
  if (input.includes("hello") || input.includes("hi")) return "Hello 👋! I’m AiNTERN Assistant. How can I help you today?";
  if (input.includes("bye")) return "Goodbye 👋! Come back anytime.";

  return "I’m not sure about that 🤔. Try asking about internships, applications, skills, or profile!";
}

//
// 🔹 Conversation Memory Functions
//
function saveConversation() {
  const chatMessages = document.getElementById("chatbot-messages").innerHTML;
  localStorage.setItem("chatHistory", chatMessages);
}

function loadConversation() {
  const chatMessages = localStorage.getItem("chatHistory");
  if (chatMessages) {
    document.getElementById("chatbot-messages").innerHTML = chatMessages;
  }
}

//
// 🔹 Greeting on load
//
window.addEventListener("load", () => {
  loadConversation(); // restore old conversation if exists

  const name = localStorage.getItem("username") || "Student";

  // Only greet if chat is empty
  if (!localStorage.getItem("chatHistory")) {
    addMessage(`Welcome back, ${name}! 👋 I’m AiNTERN Assistant. How can I help you today?`, "bot");
    saveConversation();
  }
});
