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

// Scopes for Google Drive, Contacts, and Directory access
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/directory.readonly'
];

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0000AA',
    icon: path.join(__dirname, 'NC_icon.ico'),
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

// Handle rename file
ipcMain.handle('rename-file', async (event, fileId, newName) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.update({
      fileId: fileId,
      requestBody: {
        name: newName
      },
      fields: 'id, name'
    });

    return { success: true, file: response.data };
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

// Handle get file permissions
ipcMain.handle('get-permissions', async (event, fileId) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.permissions.list({
      fileId: fileId,
      fields: 'permissions(id, type, emailAddress, role, displayName)'
    });

    return { success: true, permissions: response.data.permissions || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle add permission
ipcMain.handle('add-permission', async (event, fileId, email, role) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        type: 'user',
        role: role,
        emailAddress: email
      },
      sendNotificationEmail: true,
      fields: 'id'
    });

    return { success: true, permission: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle search contacts - searches both directory and personal contacts
ipcMain.handle('search-contacts', async (event, query) => {
  try {
    console.log('Searching contacts for:', query);
    const people = google.people({ version: 'v1', auth: oauth2Client });
    const queryLower = query.toLowerCase();

    let allMatches = [];

    // 1. Search Directory Contacts (organization contacts like *.howellschools.com)
    try {
      console.log('Searching directory contacts...');
      const directoryResponse = await people.people.searchDirectoryPeople({
        query: query,
        readMask: 'names,emailAddresses',
        pageSize: 50, // Get up to 50 directory matches
        sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'] // Organization contacts
      });

      if (directoryResponse.data.people) {
        console.log(`Found ${directoryResponse.data.people.length} directory contacts`);

        directoryResponse.data.people.forEach(person => {
          if (person.emailAddresses && person.emailAddresses.length > 0) {
            const email = person.emailAddresses[0].value;
            const name = person.names?.[0]?.displayName || '';

            allMatches.push({
              email: email,
              name: name,
              source: 'directory' // Mark as directory contact for priority
            });
          }
        });
      } else {
        console.log('No directory contacts found');
      }
    } catch (dirError) {
      console.warn('Directory search failed (this is normal if not in Workspace):', dirError.message);
      // Don't fail completely if directory search doesn't work
    }

    // 2. Search Personal Contacts
    try {
      console.log('Searching personal contacts...');

      // Use searchContacts API for better search results
      const personalResponse = await people.people.searchContacts({
        query: query,
        readMask: 'names,emailAddresses',
        pageSize: 30 // Get up to 30 personal matches
      });

      if (personalResponse.data.results) {
        console.log(`Found ${personalResponse.data.results.length} personal contacts`);

        personalResponse.data.results.forEach(result => {
          const person = result.person;
          if (person.emailAddresses && person.emailAddresses.length > 0) {
            const email = person.emailAddresses[0].value;
            const name = person.names?.[0]?.displayName || '';

            allMatches.push({
              email: email,
              name: name,
              source: 'personal'
            });
          }
        });
      } else {
        console.log('No personal contacts found');
      }
    } catch (personalError) {
      console.warn('Personal contacts search failed:', personalError.message);
      // Continue even if personal search fails
    }

    // Remove duplicates (prefer directory contacts over personal)
    const uniqueEmails = new Set();
    const uniqueMatches = [];

    // First add directory contacts (priority)
    allMatches
      .filter(m => m.source === 'directory')
      .forEach(match => {
        const emailLower = match.email.toLowerCase();
        if (!uniqueEmails.has(emailLower)) {
          uniqueEmails.add(emailLower);
          uniqueMatches.push(match);
        }
      });

    // Then add personal contacts
    allMatches
      .filter(m => m.source === 'personal')
      .forEach(match => {
        const emailLower = match.email.toLowerCase();
        if (!uniqueEmails.has(emailLower)) {
          uniqueEmails.add(emailLower);
          uniqueMatches.push(match);
        }
      });

    // Extract just the email addresses for return
    const contacts = uniqueMatches
      .map(m => m.email)
      .slice(0, 10); // Limit to 10 suggestions total

    console.log(`Returning ${contacts.length} unique contacts:`, contacts);
    return { success: true, contacts };

  } catch (error) {
    console.error('Contact search error:', error.message);
    console.error('Error details:', error);
    return { success: true, contacts: [], error: error.message };
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

// Upload file to Google Drive from buffer
ipcMain.handle('upload-file-buffer', async (event, fileName, fileBuffer, parentId = 'root') => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const { Readable } = require('stream');

    const fileMetadata = {
      name: fileName,
      parents: [parentId]
    };

    // Convert buffer to stream
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    const media = {
      body: bufferStream
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, size, modifiedTime, parents'
    });

    return { success: true, file: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Download file from Google Drive to temp directory for drag-out
ipcMain.handle('download-file-for-drag', async (event, fileId, fileName) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const os = require('os');

    // Create temp file path
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, fileName);

    // Download file
    const dest = fs.createWriteStream(tempFilePath);

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          resolve({ success: true, path: tempFilePath });
        })
        .on('error', (err) => {
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start drag operation for external file drop
ipcMain.handle('start-drag', async (event, filePath) => {
  const { webContents } = event.sender;

  webContents.startDrag({
    file: filePath,
    icon: '' // Optional: could add an icon here
  });

  return { success: true };
});

// Sanitize filename to remove invalid Windows characters
function sanitizeFilename(filename) {
  // Replace invalid Windows filename characters: < > : " / \ | ? *
  // Also replace newlines and tabs
  return filename
    .replace(/[<>:"/\\|?*\r\n\t]/g, '_')
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Download regular file to Downloads folder
ipcMain.handle('download-file', async (event, fileId, fileName) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Get Downloads folder path
    const downloadsPath = app.getPath('downloads');
    const sanitizedFileName = sanitizeFilename(fileName);
    const filePath = path.join(downloadsPath, sanitizedFileName);

    // Download file
    const dest = fs.createWriteStream(filePath);

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          resolve({ success: true, path: filePath });
        })
        .on('error', (err) => {
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error) {
    console.error('Download error:', error);
    throw new Error(error.message);
  }
});

// Export Google Doc to specific format
ipcMain.handle('export-google-doc', async (event, fileId, fileName, exportFormat) => {
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Get Downloads folder path
    const downloadsPath = app.getPath('downloads');

    // Map export format to MIME type and file extension
    const exportMimeTypes = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };

    const mimeType = exportMimeTypes[exportFormat];
    if (!mimeType) {
      throw new Error(`Unsupported export format: ${exportFormat}`);
    }

    // Remove any existing extension and add the new one
    const baseFileName = fileName.replace(/\.[^/.]+$/, '');
    const sanitizedBaseFileName = sanitizeFilename(baseFileName);
    const exportFileName = `${sanitizedBaseFileName}.${exportFormat}`;
    const filePath = path.join(downloadsPath, exportFileName);

    // Export file
    const dest = fs.createWriteStream(filePath);

    const response = await drive.files.export(
      {
        fileId: fileId,
        mimeType: mimeType
      },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      response.data
        .on('end', () => {
          resolve({ success: true, path: filePath });
        })
        .on('error', (err) => {
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error) {
    console.error('Export error:', error);
    throw new Error(error.message);
  }
});
