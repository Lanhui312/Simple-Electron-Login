const { app, BrowserWindow, ipcMain, shell } = require("electron");
require("dotenv").config();
const http = require("http");
const url = require("url");
const crypto = require("crypto");
const fetch = require("node-fetch");

//Google OAuth 2.0 Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

//Microsoft Application ID
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !MICROSOFT_CLIENT_ID) {
  console.error("Missing OAuth credentials—check your .env file");
  process.exit(1);
}

//listen on port 12345 for redirects
const REDIRECT_PORT = 12345;
const REDIRECT_URI_BASE = `http://localhost:${REDIRECT_PORT}`;

//generates a random string used for PKCE code verifier
function generateRandomString(length) {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}

function base64URLEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

//encrypt the buffer for PKCE code challenge
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest();
}

//listens for the callback on the given path and resolves with { code, state } or rejects on error/timeout.
function listenForCallback(expectedPath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      if (parsedUrl.pathname === expectedPath) {
        const { code, state, error } = parsedUrl.query;

        //prompt the user for successful login
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h2>Authentication successful. You may close this window.</h2>"
        );

        server.close();

        if (error) {
          reject(new Error(`OAuth Provider Error: ${error}`));
        } else {
          resolve({ code, state });
        }
      } else {
        //prompt the user for an unsuccessful login
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(REDIRECT_PORT, () => {
      //Now waiting for the incoming request at the redirect URI
    });

    //Timeout after 1 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: no OAuth callback received"));
    }, 60 * 1000);
  });
}

//GOOGLE LOGIN
async function handleGoogleLogin() {
  //Generate PKCE code_verifier & code_challenge
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64URLEncode(sha256(codeVerifier));

  //Generate a random state
  const state = generateRandomString(16);

  //Build Google’s OAuth URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set(
    "redirect_uri",
    `${REDIRECT_URI_BASE}/google-callback`
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  //Start listening for the callback
  const callbackPromise = listenForCallback("/google-callback");

  //Open the user’s default browser
  await shell.openExternal(authUrl.toString());

  //Wait for the callback
  const { code: returnedCode, state: returnedState } = await callbackPromise;

  //Verify the state matches
  if (returnedState !== state) {
    throw new Error("Google OAuth: state mismatch");
  }

  //Exchange the authorization code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: returnedCode,
      code_verifier: codeVerifier,
      redirect_uri: `${REDIRECT_URI_BASE}/google-callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Google Token Error: ${JSON.stringify(tokenData)}`);
  }
  const accessToken = tokenData.access_token;

  //Using the People API to fetch the authenticated user's name
  const peopleResponse = await fetch(
    "https://people.googleapis.com/v1/people/me?personFields=names",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!peopleResponse.ok) {
    const text = await peopleResponse.text();
    throw new Error(`People API Error: ${text}`);
  }

  const peopleJson = await peopleResponse.json();
  if (
    !peopleJson.names ||
    !Array.isArray(peopleJson.names) ||
    peopleJson.names.length === 0
  ) {
    throw new Error("People API Error: no `names` field in response");
  }

  const displayName = peopleJson.names[0].displayName;
  return displayName;
}

//MICROSOFT LOGIN
async function handleMicrosoftLogin() {
  //Generate PKCE code_verifier & code_challenge
  const codeVerifier = generateRandomString(64);
  const codeChallenge = base64URLEncode(sha256(codeVerifier));

  //Generate a random state
  const state = generateRandomString(16);

  //Build Microsoft’s OAuth URL
  const authUrl = new URL(
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  );
  authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set(
    "redirect_uri",
    `${REDIRECT_URI_BASE}/microsoft-callback`
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("scope", "User.Read offline_access");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  //Start listening for the callback
  const callbackPromise = listenForCallback("/microsoft-callback");

  //Open the default browser
  await shell.openExternal(authUrl.toString());

  //Wait for the callback
  const { code: returnedCode, state: returnedState } = await callbackPromise;

  //Verify state
  if (returnedState !== state) {
    throw new Error("Microsoft OAuth: state mismatch");
  }

  //Exchange code for tokens
  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        code: returnedCode,
        code_verifier: codeVerifier,
        redirect_uri: `${REDIRECT_URI_BASE}/microsoft-callback`,
        grant_type: "authorization_code",
      }),
    }
  );

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Microsoft Token Error: ${JSON.stringify(tokenData)}`);
  }
  const accessToken = tokenData.access_token;

  //Call Microsoft Graph API to get the user’s display name
  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profileData = await profileResponse.json();
  if (!profileData.displayName) {
    throw new Error("Microsoft Profile Error: could not retrieve displayName");
  }
  return profileData.displayName;
}

//Electron browser window
let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: __dirname + "/preload.js",
    },
  });

  mainWindow.loadFile(__dirname + "/index.html");
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

//IPC handler
ipcMain.handle("oauth-google", async () => {
  try {
    const name = await handleGoogleLogin();
    return { success: true, name };
  } catch (err) {
    console.error("Google Login Error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("oauth-microsoft", async () => {
  try {
    const name = await handleMicrosoftLogin();
    return { success: true, name };
  } catch (err) {
    console.error("Microsoft Login Error:", err);
    return { success: false, message: err.message };
  }
});
