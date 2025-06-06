# Simple Login Electron App

## Prerequisites

* Node.js v14+ and npm installed on your system
* Google OAuth 2.0 Desktop credentials (Client ID and Client Secret)
* Microsoft (Azure) OAuth 2.0 Desktop credentials (Application ID)

## Installation

1. **Clone the repository**

   ```bash
   git https://github.com/Lanhui312/Simple-Electron-Login.git
   cd simple-login
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. \*\*Create your \*\***.env file** in the project root:

   ```dotenv
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   MICROSOFT_CLIENT_ID=your-microsoft-client-id
   ```

## Running the App

```bash
npm start
```

* The Electron window will open, showing two buttons: **Login with Gmail** and **Login with Hotmail**.
* Click one to initiate the OAuth flow in your default browser.

---

## OAuth Implementation

1. **Google OAuth 2.0**

   * Google OAuth 2.0 requires the use of a client secret; therefore, the Google login flow uses both the client ID and the client secret.
   * The app opens the default browser to Google’s OAuth consent URL, passing:

     * `client_id` and `client_secret` (from `.env`)
     * `redirect_uri=http://localhost:12345/google-callback`
     * `scope=openid profile email`
   * Google prompts the user to sign in and consent.
   * Upon approval, Google redirects the browser to the callback endpoint with an authorization code.
   * The app’s embedded HTTP server captures the code and exchanges it, using the client secret for access and refresh tokens at Google’s token endpoint.

2. **Microsoft OAuth 2.0**

   * Configured as a public client; only a client ID (Application ID) is required.
   * The app opens the default browser to Azure’s authorize endpoint with:

     * `client_id` (from `.env`)
     * `redirect_uri=http://localhost:12345/microsoft-callback`
     * `scope=user.read`
   * Upon redirect, the app captures the authorization code and exchanges it for tokens at Microsoft’s token endpoint without a client secret.

*All secrets and IDs live in ********\`\`******** and are never checked into Git.*

---

## Redirect Flow

1. **Electron App** starts an HTTP server on `http://localhost:12345` with two endpoints:

   * `/google-callback`
   * `/microsoft-callback`
2. When the OAuth provider redirects to one of these endpoints with `?code=...`, the server:

   * Reads `req.query.code`.
   * Calls the respective token endpoint.
   * Sends the tokens via `ipcMain`/`webContents.send` back to the renderer process.
   * Responds to the browser with a simple HTML page:

     ```html
     <strong>Authentication successful! You may close this tab.</strong>
     ```
3. **Electron** listens for the IPC message, then:

   * Updates the main window UI to show a welcome message with the user’s name and a **Logout** button.

---

## Issues & Limitations

* **Client Secret in Desktop Flow**: Microsoft does not require a secret in OAuth 2.0 + PKCE; However, pure PKCE without a secret isn’t supported for Google desktop apps. Workaround: run a small backend service to handle Google's token exchange.
* **Browser Tab Closing**: Auto-closing relies on browser support for `window.close()`, and most browsers do not support or allow such a feature unless the tab is opened by the script, so auto-closing is not implemented. 
* **Token Storage**: Tokens are held in-memory for security. No persistence across app restarts; users must log in each session.
* **Cross-Platform**: Tested on macOS and Windows 10+. Linux support is untested.
* **Scopes & Permissions**: Only `openid profile email` (Google) and `user.read` (Microsoft) are requested. Request additional scopes in the code if needed.
* **Logout**: Since only in-memory storage is used, the logout button only changes the display state of other UI, such as the two buttons. 
