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
