# Norton Commander for Google Drive - Beta Testing Guide

## What is this?

A desktop application that recreates the classic Norton Commander dual-pane file manager interface for browsing and managing your Google Drive files. It combines 1990s DOS nostalgia with modern cloud storage functionality.

## Current Features

### File Management
- **Dual-pane browsing** - Navigate two folders simultaneously
- **Copy (F5)** - Copy files/folders between locations
- **Move (F6)** - Move files/folders between locations
- **Delete (F8)** - Delete files/folders with confirmation
- **Create Folder (F7)** - Make new directories
- **Download (F3 menu)** - Download files to your Downloads folder
  - Regular files download directly
  - Google Docs export as PDF or DOCX

### Navigation
- **View Modes (F2)** - Switch between:
  - Main Drive (blue) - Browse your normal Google Drive folders
  - Recent Files (yellow) - Recently viewed files
  - Shared With Me (green) - Files shared by others
- **Search (F9)** - Search your entire Drive with live suggestions
- **Tab** - Switch between left and right pane
- **Arrow keys** - Navigate up/down through files
- **Enter** - Open folders or files (opens in browser)
- **Backspace** - Go to parent folder
- **PageUp/PageDown** - Quick scrolling

### Additional Features
- Drag files from Windows Explorer into panes to upload to Google Drive
- Authentic DOS blue aesthetic with cyan/yellow accents
- Status bar shows file details
- Folder icons for easy identification

## Installation Instructions

### Prerequisites
1. **Node.js** - Download and install from [nodejs.org](https://nodejs.org/) (LTS version recommended)
2. **Git** - Download from [git-scm.com](https://git-scm.com/) (or download ZIP from GitHub)
3. **Google Account** - You'll need a Google account to test

### Setup Steps

1. **Clone or download the repository**
   ```bash
   git clone https://github.com/[your-username]/Norton_Commander_Clone.git
   cd Norton_Commander_Clone
   ```
   *Or download as ZIP and extract*

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add OAuth credentials** (I'll provide this)
   - I'll send you a file named `client_secret_[...].json`
   - Place it in the root project folder (same location as `package.json`)
   - **Important:** Don't share this file with anyone!

4. **Add you as a test user**
   - I'll add your Google account as an authorized test user in the Google Cloud Console
   - This allows the OAuth authentication to work during beta testing

5. **Run the application**
   ```bash
   npm start
   ```

6. **First launch**
   - A browser window will open asking you to authorize the app
   - Sign in with your Google account
   - Grant access to Google Drive
   - The app will remember your login for future sessions

## Known Limitations

- Opens all files in your default browser (no inline preview)
- No multi-file selection yet
- Search limited to 100 results
- Drag-out (from app to Windows Explorer) not working
- No offline functionality

## Reporting Issues

Please report any bugs, crashes, or suggestions! Include:
- What you were doing when the issue occurred
- Any error messages you saw
- Screenshots if applicable

## Privacy & Security

- The app only accesses your Google Drive (no other Google services)
- All authentication is handled through official Google OAuth
- Your credentials are stored locally on your machine
- The app doesn't send any data anywhere except to Google's APIs

## Contact

[Your email/contact info here]

---

**Thank you for beta testing!** Your feedback will help make this app better.
