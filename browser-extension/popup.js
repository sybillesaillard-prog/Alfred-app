const loginForm = document.getElementById("loginForm");
const statusConnected = document.getElementById("statusConnected");
const statusEmail = document.getElementById("statusEmail");
const logoutBtn = document.getElementById("logoutBtn");
const loginError = document.getElementById("loginError");

function render(connected, email) {
  loginForm.classList.toggle("hidden", connected);
  statusConnected.classList.toggle("hidden", !connected);
  logoutBtn.classList.toggle("hidden", !connected);
  if (connected) statusEmail.textContent = email || "";
}

chrome.runtime.sendMessage({ type: "STATUS" }, (resp) => {
  render(!!resp?.connected, resp?.email);
});

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const submitBtn = loginForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Connexion…";
  chrome.runtime.sendMessage({ type: "LOGIN", email, password }, (resp) => {
    submitBtn.disabled = false;
    submitBtn.textContent = "Se connecter";
    if (!resp?.ok) {
      loginError.textContent = resp?.error || "La connexion a échoué.";
      return;
    }
    render(true, resp.email);
  });
});

logoutBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "LOGOUT" }, () => render(false));
});
