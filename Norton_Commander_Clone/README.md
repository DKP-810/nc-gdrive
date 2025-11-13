# Norton Commander for Google Drive

A desktop application that recreates the classic Norton Commander dual-pane file manager interface for browsing and managing Google Drive files, complete with authentic 1990s DOS aesthetic.

## Features

- **Dual-pane file browser** - Navigate two directories simultaneously
- **Classic DOS aesthetic** - Blue background, cyan text, retro monospace font
- **Full Google Drive integration** - Browse, copy, move, delete files and folders
- **Keyboard-driven interface** - All operations accessible via function keys
- **Authentic Norton Commander experience** - Captures the feel of the original

## Prerequisites

- Node.js (v14 or higher)
- A Google Cloud project with Drive API enabled
- OAuth 2.0 credentials (already configured in this project)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Ensure your Google OAuth credentials file is in the project root (already present)

## Running the Application

Start the application:
```bash
npm start
```

Or run in development mode with logging:
```bash
npm run dev
```

## First Time Setup

1. When you first launch the app, you'll see an authentication screen
2. Press ENTER to start the Google OAuth flow
3. Your default browser will open - sign in to your Google account
4. Grant the necessary permissions for Drive access
5. You'll see a success message - return to the app
6. The dual-pane file manager will load with your Google Drive contents

## Keyboard Controls

### Navigation
- **Arrow Up/Down** - Move selection up/down
- **Enter** - Open folder or file
- **Backspace** - Go to parent folder
- **Tab** - Switch between left and right pane

### File Operations
- **F5** - Copy selected file/folder to other pane
- **F6** - Move selected file/folder to other pane
- **F7** - Create new folder
- **F8** - Delete selected file/folder (with confirmation)
- **F10** - Quit application

### File Opening
- When you press Enter on a file, it opens in your default browser via Google Drive web interface

## Project Structure

```
Norton_Commander_Clone/
├── main.js                 # Electron main process (backend)
├── renderer.js             # Frontend logic and UI interactions
├── index.html              # Application layout
├── styles.css              # DOS-themed styling
├── package.json            # Project configuration
├── client_secret_*.json    # Google OAuth credentials
└── README.md               # This file
```

## Technical Details

### Technology Stack
- **Electron** - Desktop application framework
- **Google Drive API v3** - File operations and authentication
- **OAuth 2.0** - Secure Google authentication
- **electron-store** - Persistent token storage

### How It Works

1. **Authentication**: Uses OAuth 2.0 flow with a local server on port 3000 to catch the redirect
2. **Token Storage**: Securely stores access tokens using electron-store
3. **Drive API**: All file operations go through Google Drive API v3
4. **Dual Panes**: Each pane maintains its own navigation state independently
5. **Keyboard Events**: Centralized keyboard handler routes function keys to appropriate actions

## Features Implemented

✅ Google OAuth2 authentication with token refresh
✅ Dual-pane file browser interface
✅ Navigate Google Drive folder hierarchy
✅ Copy files/folders between locations
✅ Move files/folders between locations
✅ Delete files/folders with confirmation
✅ Create new folders
✅ Open files in browser via Google Drive
✅ Classic DOS blue/cyan color scheme
✅ Function key shortcuts (F5-F10)
✅ Status bar with file information
✅ Modal dialogs with DOS styling

## Troubleshooting

### Authentication Issues
- Make sure port 3000 is not in use by another application
- Check that your OAuth credentials are valid
- Try deleting stored tokens: Find electron-store config and delete `tokens` entry

### Can't See Files
- Verify you granted Drive permissions during OAuth
- Check internet connection
- Look for error messages in the console (run with `npm run dev`)

### Keyboard Shortcuts Not Working
- Make sure the application window has focus
- Check if function keys are mapped to system shortcuts on your OS

## Future Enhancements

Potential features for future versions:
- Multi-file selection (Shift/Ctrl)
- File search functionality
- Sorting options (by name, date, size)
- File preview (F3)
- Configuration file for customizing colors
- Support for other cloud storage providers
- Breadcrumb navigation trail
- Bookmarks/favorites

## License

MIT

## Credits

Inspired by the classic Norton Commander file manager (1986-1998)
