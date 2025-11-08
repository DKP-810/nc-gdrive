const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');

// Simple token storage using filesystem
// Note: TOKEN_FILE path is determined after app is ready
let TOKEN_FILE;

function getTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error reading tokens:', error);
  }
  return null;
}

function setTokens(tokens) {
  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), 'utf8');
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

function deleteTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    console.error('Error deleting tokens:', error);
  }
}

// Load OAuth credentials
let credentials, client_id, client_secret, redirect_uris, oauth2Client;

try {
  credentials = require('./client_secret_2_68079929091-9kj0qlt5qd227l1n4sb5jlho62plou0b.apps.googleusercontent.com.json');
  ({ client_id, client_secret, redirect_uris } = credentials.web);

  // OAuth2 client
  oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
} catch (error) {
  console.error('Error loading OAuth credentials:', error);
  console.error('Make sure client_secret_2_68079929091-9kj0qlt5qd227l1n4sb5jlho62plou0b.apps.googleusercontent.com.json exists');
}

// Scopes for Google Drive access
const SCOPES = ['https://www.googleapis.com/auth/drive'];

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0000AA',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Initialize TOKEN_FILE path now that app is ready
  TOKEN_FILE = path.join(app.getPath('userData'), 'tokens.json');

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle authentication
ipcMain.handle('authenticate', async () => {
  try {
    // Check if we have stored tokens
    const tokens = getTokens();
    if (tokens) {
      oauth2Client.setCredentials(tokens);

      // Verify tokens are still valid
      try {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.list({ pageSize: 1 });
        return { success: true, tokens };
      } catch (error) {
        // Tokens expired, need to re-authenticate
        deleteTokens();
      }
    }

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    // Open auth URL in default browser
    require('electron').shell.openExternal(authUrl);

    // Start local server to catch redirect
    return new Promise((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        try {
          if (req.url.indexOf('/?code=') > -1) {
            const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
            const code = qs.get('code');

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Authentication successful!</h1><p>You can close this window and return to the app.</p></body></html>');

            server.close();

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            setTokens(tokens);

            resolve({ success: true, tokens });
          }
        } catch (error) {
          reject(error);
        }
      }).listen(3000);
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle listing files
ipcMain.handle('list-files', async (event, folderId = 'root') => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size, modifiedTime, parents)',
      pageSize: 1000
    });

    // Sort: folders first (alphabetically), then files (alphabetically)
    const files = response.data.files || [];
    files.sort((a, b) => {
      const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
      const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';

      // Folders before files
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;

      // Both same type, sort alphabetically (case-insensitive)
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle copy file
ipcMain.handle('copy-file', async (event, fileId, newParentId) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.copy({
      fileId: fileId,
      requestBody: {
        parents: [newParentId]
      }
    });

    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle move file
ipcMain.handle('move-file', async (event, fileId, newParentId, oldParentId) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.update({
      fileId: fileId,
      addParents: newParentId,
      removeParents: oldParentId,
      fields: 'id, name, parents'
    });

    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle delete file
ipcMain.handle('delete-file', async (event, fileId) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    await drive.files.delete({
      fileId: fileId
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle get file URL
ipcMain.handle('get-file-url', async (event, fileId) => {
  return `https://drive.google.com/file/d/${fileId}/view`;
});

// Handle create folder
ipcMain.handle('create-folder', async (event, name, parentId) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id, name, mimeType'
    });

    return { success: true, folder: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle listing recent files
ipcMain.handle('list-recent-files', async () => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.list({
      q: 'trashed=false',
      fields: 'files(id, name, mimeType, size, modifiedTime, parents, owners)',
      orderBy: 'viewedByMeTime desc',
      pageSize: 100
    });

    return { success: true, files: response.data.files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle listing shared files
ipcMain.handle('list-shared-files', async () => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.list({
      q: 'sharedWithMe and trashed=false',
      fields: 'files(id, name, mimeType, size, modifiedTime, parents, owners)',
      orderBy: 'sharedWithMeTime desc',
      pageSize: 100
    });

    return { success: true, files: response.data.files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle search files
ipcMain.handle('search-files', async (event, query, limit = 10) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Build search query - escape single quotes in the search term
    const escapedQuery = query.replace(/'/g, "\\'");

    // Use fullText contains for better matching (includes file content and metadata)
    // This matches Google Drive's native search behavior better
    const searchQuery = `trashed=false and fullText contains '${escapedQuery}'`;

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, mimeType, size, modifiedTime, parents, owners)',
      pageSize: limit
      // No orderBy - uses Google's default relevance ranking
    });

    return { success: true, files: response.data.files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
