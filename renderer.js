window.addEventListener("DOMContentLoaded", () => {
  const loginContainer = document.getElementById("login-container");
  const welcomeMessage = document.getElementById("welcome-message");
  const googleBtn = document.getElementById("googleBtn");
  const microsoftBtn = document.getElementById("microsoftBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  //start google login flow when clicked
  googleBtn.addEventListener("click", async () => {
    welcomeMessage.textContent = "Starting Gmail OAuth flow…";
    try {
      const result = await window.api.loginWithGoogle();
      if (result.success) {
        loginContainer.style.display = "none";
        logoutBtn.hidden = false;
        welcomeMessage.textContent = `Welcome, ${result.name}!`;
      } else {
        welcomeMessage.textContent = `Error: ${result.message}`;
      }
    } catch (err) {
      welcomeMessage.textContent = `Unexpected Error: ${err.message}`;
    }
  });

  //start microsft login flow when clicked
  microsoftBtn.addEventListener("click", async () => {
    welcomeMessage.textContent = "Starting Hotmail OAuth flow…";
    try {
      const result = await window.api.loginWithMicrosoft();
      if (result.success) {
        loginContainer.style.display = "none";
        logoutBtn.hidden = false;
        welcomeMessage.textContent = `Welcome, ${result.name}!`;
      } else {
        welcomeMessage.textContent = `Error: ${result.message}`;
      }
    } catch (err) {
      welcomeMessage.textContent = `Unexpected Error: ${err.message}`;
    }
  });

  //logout
  logoutBtn.addEventListener("click", () => {
    loginContainer.style.display = "block";
    welcomeMessage.textContent = "";
    logoutBtn.hidden = true;
  });
});
