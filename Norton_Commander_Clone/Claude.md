# Norton Commander for Google Drive

## Project Overview
Build a desktop application that recreates the classic Norton Commander dual-pane file manager interface for browsing and managing Google Drive files. The app should capture the authentic 1990s DOS aesthetic while providing modern Google Drive functionality.

## Core Functionality

### File Operations
- **Browse**: Navigate through Google Drive folder structure in dual-pane view
- **Copy (F5)**: Copy files/folders between locations
- **Move (F6)**: Move files/folders between locations  
- **Delete (F8)**: Delete files/folders (with confirmation dialog)
- **Open**: When user wants to view/edit a file, open it in Chrome via Google Drive web interface
- **Refresh**: Reload current directory contents

### Navigation
- **Dual-pane layout**: Two independent file browser panes side-by-side
- **Tab key**: Switch focus between left and right pane
- **Arrow keys**: Navigate up/down through file lists
- **Enter**: Navigate into folders or open files
- **Backspace/..**: Navigate up to parent folder
- **F10**: Quit application

## Technical Architecture

### Technology Stack
- **Framework**: Electron (desktop app for Windows/Mac/Linux)
- **Frontend**: HTML/CSS/JavaScript (or React if preferred)
- **Google Drive API**: For all file operations and authentication
- **OAuth2**: Google authentication flow

### Key Components

1. **Authentication Module**
   - Handle Google OAuth2 flow
   - Store and refresh access tokens securely
   - Provide logged-in user info

2. **Drive API Wrapper**
   - List files and folders
   - Get file metadata
   - Copy, move, delete operations
   - Navigate folder hierarchy
   - Handle API errors gracefully

3. **UI Layer**
   - Dual-pane file browser component
   - Keyboard event handler
   - Function key menu bar (F1-F10)
   - Modal dialogs for confirmations
   - Status bar showing current path and file info

4. **Styling System**
   - DOS blue background (#0000AA or similar)
   - Yellow/cyan text
   - Box-drawing characters for borders
   - Monospace font (preferably DOS-style like "Perfect DOS VGA 437")
   - Proper highlighting for selected items

## Visual Design Specifications

### Color Scheme
- Background: Classic DOS blue (#0000AA)
- Text: Light cyan/white (#00FFFF or #FFFFFF)  
- Highlighted selection: Cyan background (#00FFFF) with black text (#000000)
- Function key bar: Cyan text on black background
- Title bars: White/yellow text
- Status information: Yellow (#FFFF00)

### Layout
```
┌─ C:\Drive ───────────────────┬─ C:\Drive\Projects ──────────┐
│ ↑ Name                       │ ↑ Name                       │
│ [..] (parent)                │ [..] (parent)                │
│ 📁 Documents/                │ 📁 Code/                     │
│ 📁 Photos/                   │ 📁 Design/                   │
│ 📄 File1.pdf                 │ 📄 README.md                 │
│ 📄 File2.docx                │ 📄 notes.txt                 │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
1Help 2Menu 3View 4Edit 5Copy 6Move 7Mkdir 8Delete 9PullDn 10Quit
```

### Typography
- Use a DOS-style monospace font
- Consider fonts like: "Perfect DOS VGA 437", "IBM VGA 8x16", or fallback to "Courier New"
- All text should feel like authentic DOS text-mode display

## User Experience Flow

1. **Startup**
   - App launches in fullscreen (optional)
   - If not authenticated, show Google OAuth login
   - After auth, show dual-pane view starting at Drive root

2. **Navigation**
   - Left pane active by default
   - Arrow keys move selection up/down
   - Enter on folder: navigate into it
   - Enter on file: show preview info or prompt to open in browser
   - Tab: switch active pane
   - Backspace or clicking ".." parent entry: go up one level

3. **File Operations**
   - F5 (Copy): Copy selected items from active pane to the other pane's current directory
   - F6 (Move): Move selected items from active pane to the other pane's current directory
   - F8 (Delete): Show confirmation dialog, then delete selected items
   - All operations show progress/confirmation dialogs styled like DOS dialogs

4. **Opening Files**
   - When user wants to open a file for viewing/editing
   - Launch system default browser with Google Drive URL for that file
   - Keep the Norton Commander app open in background

## Technical Requirements

### Google Drive API Scopes Needed
- `https://www.googleapis.com/auth/drive` (full access) OR
- `https://www.googleapis.com/auth/drive.file` (limited to app-created files - may be too restrictive)

### Error Handling
- Network errors: Show user-friendly message, allow retry
- API rate limits: Implement exponential backoff
- Authentication expiry: Auto-refresh tokens or prompt re-login
- Invalid operations: Show clear error dialogs

### Performance Considerations
- Cache directory listings briefly to avoid excessive API calls
- Lazy load large directories
- Show loading indicators for slow operations
- Implement pagination for folders with 1000+ items

## Development Phases

### Phase 1: Core Infrastructure
- Set up Electron project
- Implement Google OAuth flow
- Create basic Drive API wrapper
- Test listing files and folders

### Phase 2: Basic UI
- Build single-pane file browser
- Implement keyboard navigation
- Style with DOS aesthetic
- Add function key bar

### Phase 3: Dual-Pane & Operations
- Implement dual-pane layout
- Add copy/move/delete operations
- Create confirmation dialogs
- Handle file operation errors

### Phase 4: Polish
- Refine DOS styling (colors, fonts, borders)
- Add status bar with file info
- Implement breadcrumb path display
- Add keyboard shortcuts reference (F1 Help)
- Test cross-platform compatibility

## Future Enhancements (Optional)
- F7: Create new folder
- F3: View file details/preview
- F4: Edit file (opens in browser)
- Search functionality (Ctrl+F)
- Multi-file selection (Shift/Ctrl)
- File filtering/sorting options
- Bookmarks/favorites for quick access
- Configuration file for customizing colors/keybindings
- Support for other cloud storage providers

## Resources & References
- Google Drive API v3 Documentation: https://developers.google.com/drive/api/v3/about-sdk
- Electron Documentation: https://www.electronjs.org/docs/latest/
- Norton Commander UI reference: Use the uploaded screenshot as visual guide
- Box-drawing characters: Unicode box-drawing characters for borders

## Success Criteria
- User can authenticate with Google account
- User can navigate their entire Google Drive in dual-pane view
- User can copy, move, and delete files successfully
- UI authentically recreates Norton Commander DOS aesthetic
- Opening files launches them in Chrome/default browser
- App is stable and handles errors gracefully
- Keyboard navigation feels responsive and intuitive

## Notes
- Focus on capturing the nostalgic feel - this is as much about aesthetics as functionality
- The app doesn't need to be a full replacement for Google Drive web interface
- Prioritize the core file management operations that Norton Commander was famous for
- Keep the code clean and maintainable for future enhancements

---

## Current Implementation Status (Updated: 2025-11-08)

### ✅ Completed Features

**Core Functionality:**
- Full dual-pane file browser with keyboard navigation
- Google OAuth2 authentication with token persistence
- F5 Copy, F6 Move, F7 Mkdir, F8 Delete operations
- F9 Search - Google Drive search with live suggestions
- Tab to switch panes, Arrow keys for navigation
- Enter to open files/folders, Backspace to go up
- PageUp/PageDown for quick scrolling
- F10 to quit

**View Modes (F2):**
- **Main Drive** (blue theme) - Browse normal Google Drive folders
- **Recent Files** (yellow theme) - Shows recently viewed files
- **Shared With Me** (green theme) - Shows files shared by others
- Each pane can independently switch between view modes
- Color-coded panes indicate current view mode
- Path display updates (Drive:\, Recent:\, Shared:\)

**Search (F9):**
- Google Drive search with live suggestions dropdown
- Suggestions appear as you type (300ms debounce)
- Shows up to 8 suggested matches before hitting Enter
- Arrow keys to navigate suggestions
- Click or press Enter to open selected file
- Press Enter without selection for full search (up to 100 results)
- Searches both file names and content
- Esc to cancel search

**Owner Column:**
- Automatically shown in Recent and Shared views
- Displays file/folder owner name
- Small font (11px) to save space
- Truncates with ellipsis for long names
- Full name shown on hover

**File Sorting:**
- Main Drive view: Folders alphabetically first, then files alphabetically
- Case-insensitive sorting using `localeCompare`

**UI/UX:**
- Authentic DOS blue aesthetic with cyan/yellow accents
- Modal dialogs block interaction (DOS-style)
- Splash screen on right pane at startup
- Status bar shows file details on selection
- Function key bar at bottom
- Loading indicators during API calls

### 🔧 Technical Details

**Files:**
- `main.js` - Electron main process, Google Drive API handlers
- `renderer.js` - UI logic, keyboard handlers, file rendering
- `index.html` - Main layout structure
- `styles.css` - DOS styling and color themes
- `client_secret_*.json` - OAuth credentials (gitignored)

**API Handlers:**
- `list-files` - List files in a folder (with client-side sorting)
- `list-recent-files` - Recent files with owner info
- `list-shared-files` - Shared files with owner info
- `search-files` - Search Drive by filename and content
- `copy-file`, `move-file`, `delete-file` - File operations
- `create-folder` - Make new directory
- `get-file-url` - Get Google Drive web URL

**State Management:**
- Each pane tracks: currentFolder, files, selectedIndex, folderStack, pathNames, viewMode
- Active pane highlighted with brighter border
- View mode persists per-pane

### 🚧 Known Limitations

- F3 PullDn not implemented (reserved for future pull-down menu)
- F4 Edit not implemented
- No multi-file selection
- Opens all files in browser (no inline preview)
- No offline/sync functionality
- Limited to 100 files in Recent/Shared views (API pageSize)
- Search limited to 100 results for full search

### 📝 Setup Notes

**Requirements:**
- Node.js (tested with v24.11.0)
- Python 3.13 for other projects (not needed here)
- Google Cloud Project with Drive API enabled
- OAuth 2.0 credentials (Web application type)

**Installation:**
```bash
cd d:\Claude\projects\Norton_Commander_Clone
npm install
```

**Running:**
```bash
npm start
```

**First Time Setup:**
1. Download OAuth credentials from Google Cloud Console
2. Save as `client_secret_*.json` in project root
3. File is gitignored for security
4. Update `main.js:45` if filename differs
5. First run will open browser for OAuth consent

### 🎯 Next Priorities

1. **Pull-down Menu (F3)** - Implement menu system for advanced options
2. **File Details** - Show metadata in a dialog
3. **Better Error Handling** - More informative error messages
4. **Refresh Key** - Manual refresh without reloading view
5. **Multi-select** - Select multiple files for batch operations
