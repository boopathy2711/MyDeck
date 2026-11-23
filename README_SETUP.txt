MYDOCK — API-BASED REBUILD

FILES
Frontend: index.html, styles.css, utils.js, storage.js, app.js, config.js
Backend: Code.gs (Google Apps Script)

1. GOOGLE SHEET
The backend is configured for spreadsheet ID:
1wJL8Y526QIIdOaHZJy5lyOWzbXvHxPNBpJP1OJrGDGA
Worksheet: MyDockData

2. APPS SCRIPT
Open Extensions > Apps Script from the spreadsheet. Replace Code.gs with the supplied Code.gs. Save. Run setupMyDock() once and authorize it.
Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone (or the least permissive option that still allows your intended users). Deploy and copy the /exec URL.

3. FRONTEND CONFIG
Open config.js and replace PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE with the deployed /exec URL. Keep the URL in quotes.

4. HOST FRONTEND
Keep all six frontend files in the same folder. Serve the folder using a static web host (for example GitHub Pages) or a local development server. Do not open index.html using file:// if your browser blocks requests.

5. TEST
Open the frontend URL. Add a test task, refresh, and confirm it remains. Then test edit, complete, delete, links, notes, export and import.

NETWORK NOTE
Reads use JSONP. Writes use a cross-origin POST with text/plain and are followed by a fresh read. Because no-cors POST responses are opaque, a browser cannot directly display the Apps Script error body; if a write fails, check Apps Script > Executions.

SECURITY
The Anyone deployment makes this API reachable by anyone who obtains its URL. Do not store sensitive/private information in this sheet. For a private multi-user app, add authentication and authorization before sharing.
