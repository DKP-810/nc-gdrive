const { ipcRenderer, shell } = require('electron');

// State management
const state = {
    activePane: 'left',
    showingSplash: true, // Track if splash screen is showing
    searchUsingKeyboard: false, // Track if user is using keyboard in search
    leftPane: {
        currentFolder: 'root',
        currentFolderName: '',
        files: [],
        selectedIndex: 0,
        folderStack: [],
        pathNames: [], // Stack of folder names for building path
        viewMode: 'drive' // 'drive', 'recent', or 'shared'
    },
    rightPane: {
        currentFolder: 'root',
        currentFolderName: '',
        files: [],
        selectedIndex: 0,
        folderStack: [],
        pathNames: [], // Stack of folder names for building path
        viewMode: 'drive' // 'drive', 'recent', or 'shared'
    }
};

// DOM elements
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const leftList = document.getElementById('left-list');
const rightList = document.getElementById('right-list');
const leftPane = document.getElementById('left-pane');
const rightPane = document.getElementById('right-pane');
const leftPath = document.getElementById('left-path');
const rightPath = document.getElementById('right-path');
const leftHeaders = document.getElementById('left-headers');
const rightHeaders = document.getElementById('right-headers');
const statusInfo = document.getElementById('status-info');
const dialogOverlay = document.getElementById('dialog-overlay');
const searchOverlay = document.getElementById('search-overlay');
const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
const suggestionsList = document.getElementById('suggestions-list');
const pulldownMenu = document.getElementById('pulldown-menu');
const pulldownMenuContainer = document.getElementById('pulldown-menu-container');
const shareOverlay = document.getElementById('share-overlay');
const shareFilename = document.getElementById('share-filename');
const shareEmailInput = document.getElementById('share-email-input');
const shareEmailSuggestions = document.getElementById('share-email-suggestions');
const shareRoleSelect = document.getElementById('share-role-select');
const sharePermissionsList = document.getElementById('share-permissions-list');
const shareAddBtn = document.getElementById('share-add-btn');
const shareCloseBtn = document.getElementById('share-close-btn');
const shareCopyLinkBtn = document.getElementById('share-copy-link-btn');
const shareGeneralAccessSelect = document.getElementById('share-general-access-select');
const shareGeneralAccessDesc = document.getElementById('share-general-access-desc');

// Initialize app
async function init() {
    setupKeyboardListeners();
    setupDragAndDrop();

    // Try to authenticate
    const authStatus = document.querySelector('.auth-status');
    authStatus.textContent = 'Authenticating...';

    const result = await ipcRenderer.invoke('authenticate');

    if (result.success) {
        showMainScreen();
    } else {
        authStatus.textContent = 'Authentication failed. Please restart the app.';
    }
}

function showMainScreen() {
    authScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');

    // Load initial directories
    loadFiles('left');
    showSplashScreen('right');
    updatePaneColors();
}

function showSplashScreen(pane) {
    const listElement = pane === 'left' ? leftList : rightList;
    listElement.innerHTML = '';

    // Get system memory info (if available)
    let totalMem = 'N/A';
    let freeMem = 'N/A';
    if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        const totalSystemMem = require('os').totalmem();
        const freeSystemMem = require('os').freemem();
        totalMem = Math.round(totalSystemMem / (1024 * 1024)) + ' MB';
        freeMem = Math.round(freeSystemMem / (1024 * 1024)) + ' MB';
    }

    // Generate hex serial number from current timestamp
    const now = new Date();
    const timestamp = now.getTime();
    const serialHex = timestamp.toString(16).toUpperCase().padStart(16, '0');
    const formattedSerial = serialHex.match(/.{1,4}/g).join('-');

    const splash = document.createElement('div');
    splash.className = 'splash-screen';
    splash.innerHTML = `
        <div class="splash-header">
            The Google Drive Norton Commander
        </div>
        <div class="splash-version">Version 1.01</div>
        <div class="splash-date">19 September 1996</div>

        <div class="splash-divider"></div>

        <div class="splash-section">
            <div class="splash-label">Total Memory:</div>
            <div class="splash-value">${totalMem}</div>
        </div>
        <div class="splash-section">
            <div class="splash-label">Free Memory:</div>
            <div class="splash-value">${freeMem}</div>
        </div>

        <div class="splash-divider"></div>

        <div class="splash-section">
            <div class="splash-label">Machine ID:</div>
            <div class="splash-value">Intel 486 DX4-100</div>
        </div>

        <div class="splash-divider"></div>

        <div class="splash-section">
            <div class="splash-label">Serial Number:</div>
            <div class="splash-value">${formattedSerial}</div>
        </div>

        <div class="splash-divider"></div>

        <div class="splash-footer">
            No "dirinfo" file in this directory
        </div>
    `;

    listElement.appendChild(splash);
}

async function loadFiles(pane) {
    const paneState = state[pane + 'Pane'];
    const listElement = pane === 'left' ? leftList : rightList;

    listElement.innerHTML = '<div class="loading">Loading...</div>';

    let result;

    // Load files based on view mode
    if (paneState.viewMode === 'recent') {
        result = await ipcRenderer.invoke('list-recent-files');
    } else if (paneState.viewMode === 'shared') {
        result = await ipcRenderer.invoke('list-shared-files');
    } else {
        // Default drive mode
        result = await ipcRenderer.invoke('list-files', paneState.currentFolder);
    }

    if (result.success) {
        paneState.files = result.files;
        renderFiles(pane);
        updateStatusBar();
        updatePaneColors();
    } else {
        listElement.innerHTML = `<div style="color: #FF0000;">Error: ${result.error}</div>`;
    }
}

function renderFiles(pane) {
    const paneState = state[pane + 'Pane'];
    const listElement = pane === 'left' ? leftList : rightList;
    const headersElement = pane === 'left' ? leftHeaders : rightHeaders;

    // Update column headers based on view mode
    const showOwner = paneState.viewMode === 'recent' || paneState.viewMode === 'shared';
    if (showOwner) {
        headersElement.innerHTML = `
            <span class="header-name">Name</span>
            <span class="header-divider">│</span>
            <span class="header-type">Type</span>
            <span class="header-divider">│</span>
            <span class="header-owner">Owner</span>
        `;
        headersElement.classList.add('has-owner');
    } else {
        headersElement.innerHTML = `
            <span class="header-name">Name</span>
            <span class="header-divider">│</span>
            <span class="header-type">Type</span>
        `;
        headersElement.classList.remove('has-owner');
    }

    listElement.innerHTML = '';

    // Add parent directory entry if not at root (and not in recent/shared mode)
    if (paneState.currentFolder !== 'root' && paneState.viewMode === 'drive') {
        const parentItem = document.createElement('div');
        parentItem.className = 'file-item parent';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = '[..]';

        const infoSpan = document.createElement('span');
        infoSpan.className = 'file-info';
        infoSpan.textContent = 'UP--DIR';

        parentItem.appendChild(nameSpan);
        parentItem.appendChild(infoSpan);
        parentItem.dataset.index = -1;
        parentItem.dataset.isParent = 'true';

        // Click handler for parent
        parentItem.addEventListener('click', () => {
            paneState.selectedIndex = -1;
            updateSelection(pane);
        });

        // Double-click handler for parent
        parentItem.addEventListener('dblclick', () => {
            paneState.selectedIndex = -1;
            handleEnter();
        });

        listElement.appendChild(parentItem);
    }

    // Add files and folders
    paneState.files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        if (showOwner) {
            item.classList.add('has-owner');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';

        const infoSpan = document.createElement('span');
        infoSpan.className = 'file-info';

        if (file.mimeType === 'application/vnd.google-apps.folder') {
            item.classList.add('folder');

            // Add folder icon
            const iconSpan = document.createElement('span');
            iconSpan.className = 'file-icon';
            iconSpan.textContent = '📁';
            item.appendChild(iconSpan);

            nameSpan.textContent = file.name;
            infoSpan.textContent = 'SUB-DIR';
        } else {
            item.classList.add('file');
            nameSpan.textContent = file.name;
            infoSpan.textContent = getFileType(file.mimeType);
        }

        // Add title attribute for full filename on hover
        item.title = file.name;

        item.appendChild(nameSpan);
        item.appendChild(infoSpan);

        // Add owner column if in recent/shared mode
        if (showOwner) {
            const ownerSpan = document.createElement('span');
            ownerSpan.className = 'file-owner';
            const ownerName = file.owners && file.owners[0] ? file.owners[0].displayName : 'Unknown';
            ownerSpan.textContent = ownerName;
            ownerSpan.title = ownerName; // Full name on hover
            item.appendChild(ownerSpan);
        }

        item.dataset.index = index;
        item.dataset.fileId = file.id;
        item.dataset.mimeType = file.mimeType;

        // Click handler
        item.addEventListener('click', () => {
            paneState.selectedIndex = index;
            updateSelection(pane);
        });

        // Double-click handler
        item.addEventListener('dblclick', () => {
            paneState.selectedIndex = index;
            handleEnter();
        });

        listElement.appendChild(item);
    });

    // Restore selection
    updateSelection(pane);
}

function updateSelection(pane) {
    const paneState = state[pane + 'Pane'];
    const listElement = pane === 'left' ? leftList : rightList;
    const items = listElement.querySelectorAll('.file-item');

    items.forEach((item, idx) => {
        const itemIndex = parseInt(item.dataset.index);
        if (itemIndex === paneState.selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function updateStatusBar() {
    const paneState = state[state.activePane + 'Pane'];
    const currentFile = paneState.files[paneState.selectedIndex];

    if (currentFile) {
        const size = currentFile.size ? formatBytes(currentFile.size) : '';
        const modified = currentFile.modifiedTime ? new Date(currentFile.modifiedTime).toLocaleString() : '';
        statusInfo.textContent = `${currentFile.name} | ${size} | ${modified}`;
    } else {
        statusInfo.textContent = '';
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
}

function getFileType(mimeType) {
    // Google Workspace types
    if (mimeType === 'application/vnd.google-apps.document') return 'GDOC';
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'GSHEET';
    if (mimeType === 'application/vnd.google-apps.presentation') return 'GSLIDE';
    if (mimeType === 'application/vnd.google-apps.form') return 'GFORM';
    if (mimeType === 'application/vnd.google-apps.drawing') return 'GDRAW';
    if (mimeType === 'application/vnd.google-apps.folder') return 'SUB-DIR';

    // Office documents
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'XLSX';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'PPTX';
    if (mimeType === 'application/msword') return 'DOC';
    if (mimeType === 'application/vnd.ms-excel') return 'XLS';
    if (mimeType === 'application/vnd.ms-powerpoint') return 'PPT';

    // PDFs and text
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType === 'text/plain') return 'TXT';
    if (mimeType === 'text/html') return 'HTML';
    if (mimeType === 'text/css') return 'CSS';
    if (mimeType === 'text/javascript' || mimeType === 'application/javascript') return 'JS';

    // Images
    if (mimeType.startsWith('image/')) {
        const type = mimeType.split('/')[1].toUpperCase();
        if (type === 'JPEG') return 'JPG';
        if (type === 'PNG') return 'PNG';
        if (type === 'GIF') return 'GIF';
        if (type === 'SVG+XML') return 'SVG';
        return 'IMG';
    }

    // Video
    if (mimeType.startsWith('video/')) return 'VIDEO';

    // Audio
    if (mimeType.startsWith('audio/')) return 'AUDIO';

    // Archives
    if (mimeType === 'application/zip') return 'ZIP';
    if (mimeType === 'application/x-rar-compressed') return 'RAR';
    if (mimeType === 'application/x-7z-compressed') return '7Z';

    // Default
    return 'FILE';
}

function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        // Check if dialog is open - if so, don't handle main screen keys
        if (!dialogOverlay.classList.contains('hidden')) {
            return; // Let dialog handle its own keyboard events
        }

        // Check if search dialog is open - if so, don't handle main screen keys
        if (!searchOverlay.classList.contains('hidden')) {
            return; // Let search dialog handle its own keyboard events
        }

        // Check if pulldown menu is open - if so, don't handle main screen keys
        if (!pulldownMenu.classList.contains('hidden')) {
            return; // Let pulldown menu handle its own keyboard events
        }

        // Check if share dialog is open - if so, don't handle main screen keys
        if (!shareOverlay.classList.contains('hidden')) {
            return; // Let share dialog handle its own keyboard events
        }

        // Main screen keyboard handling
        if (!mainScreen.classList.contains('hidden')) {
            handleMainScreenKeys(e);
        }
    });
}

function handleMainScreenKeys(e) {
    const paneState = state[state.activePane + 'Pane'];
    const hasParentDir = paneState.currentFolder !== 'root';
    const minIndex = hasParentDir ? -1 : 0;

    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (paneState.selectedIndex < paneState.files.length - 1) {
                paneState.selectedIndex++;
                updateSelection(state.activePane);
                updateStatusBar();
            }
            break;

        case 'ArrowUp':
            e.preventDefault();
            if (paneState.selectedIndex > minIndex) {
                paneState.selectedIndex--;
                updateSelection(state.activePane);
                updateStatusBar();
            }
            break;

        case 'PageDown':
            e.preventDefault();
            handlePageDown();
            break;

        case 'PageUp':
            e.preventDefault();
            handlePageUp();
            break;

        case 'Tab':
            e.preventDefault();
            // If splash is showing, hide it and load right pane
            if (state.showingSplash) {
                state.showingSplash = false;
                loadFiles('right');
            }
            toggleActivePane();
            break;

        case 'Enter':
            e.preventDefault();
            handleEnter();
            break;

        case 'Backspace':
            e.preventDefault();
            handleBackspace();
            break;

        case 'F5':
            e.preventDefault();
            handleCopy();
            break;

        case 'F6':
            e.preventDefault();
            handleMove();
            break;

        case 'F7':
            e.preventDefault();
            handleMkdir();
            break;

        case 'F8':
            e.preventDefault();
            handleDelete();
            break;

        case 'F9':
            e.preventDefault();
            showSearchDialog();
            break;

        case 'F1':
            e.preventDefault();
            handleRefresh();
            break;

        case 'F2':
            e.preventDefault();
            handleViewModeMenu();
            break;

        case 'F3':
            e.preventDefault();
            handlePulldownMenu();
            break;

        case 'F4':
            e.preventDefault();
            handleEditMenu();
            break;

        case 'F10':
            e.preventDefault();
            window.close();
            break;
    }
}

function toggleActivePane() {
    state.activePane = state.activePane === 'left' ? 'right' : 'left';
    updatePaneColors();
}

function handlePageDown() {
    const paneState = state[state.activePane + 'Pane'];
    const listElement = state.activePane === 'left' ? leftList : rightList;
    const hasParentDir = paneState.currentFolder !== 'root';
    const minIndex = hasParentDir ? -1 : 0;

    // Calculate visible items in the list
    const itemHeight = 20; // Approximate height of each item in pixels
    const visibleHeight = listElement.clientHeight;
    const pageSize = Math.floor(visibleHeight / itemHeight);

    // Jump down by a page
    const newIndex = Math.min(paneState.selectedIndex + pageSize, paneState.files.length - 1);
    paneState.selectedIndex = newIndex;
    updateSelection(state.activePane);
    updateStatusBar();
}

function handlePageUp() {
    const paneState = state[state.activePane + 'Pane'];
    const listElement = state.activePane === 'left' ? leftList : rightList;
    const hasParentDir = paneState.currentFolder !== 'root';
    const minIndex = hasParentDir ? -1 : 0;

    // Calculate visible items in the list
    const itemHeight = 20; // Approximate height of each item in pixels
    const visibleHeight = listElement.clientHeight;
    const pageSize = Math.floor(visibleHeight / itemHeight);

    // Jump up by a page
    const newIndex = Math.max(paneState.selectedIndex - pageSize, minIndex);
    paneState.selectedIndex = newIndex;
    updateSelection(state.activePane);
    updateStatusBar();
}

async function handleEnter() {
    const paneState = state[state.activePane + 'Pane'];

    // Handle parent directory (..)
    if (paneState.selectedIndex === -1) {
        await handleBackspace();
        return;
    }

    const currentFile = paneState.files[paneState.selectedIndex];

    if (!currentFile) return;

    if (currentFile.mimeType === 'application/vnd.google-apps.folder') {
        // In recent/shared mode, don't navigate into folders - just open them
        if (paneState.viewMode === 'recent' || paneState.viewMode === 'shared') {
            const url = await ipcRenderer.invoke('get-file-url', currentFile.id);
            shell.openExternal(url);
        } else {
            // Navigate into folder (drive mode only)
            paneState.folderStack.push({
                id: paneState.currentFolder,
                selectedIndex: paneState.selectedIndex
            });
            paneState.currentFolder = currentFile.id;
            paneState.pathNames.push(currentFile.name); // Add folder name to path
            paneState.selectedIndex = -1; // Select parent (..) by default
            await loadFiles(state.activePane);
            updatePathDisplay();
        }
    } else {
        // Open file in browser
        const url = await ipcRenderer.invoke('get-file-url', currentFile.id);
        shell.openExternal(url);
    }
}

async function handleBackspace() {
    const paneState = state[state.activePane + 'Pane'];

    if (paneState.folderStack.length > 0) {
        const previous = paneState.folderStack.pop();
        paneState.currentFolder = previous.id;
        paneState.selectedIndex = previous.selectedIndex;
        paneState.pathNames.pop(); // Remove last folder from path
        await loadFiles(state.activePane);
        updatePathDisplay();
    }
}

function updatePathDisplay() {
    // Build DOS-style path for left pane
    const leftPrefix = getPathPrefix('left');
    if (state.leftPane.pathNames.length === 0) {
        leftPath.textContent = leftPrefix;
    } else {
        leftPath.textContent = leftPrefix + state.leftPane.pathNames.join('\\');
    }

    // Build DOS-style path for right pane
    const rightPrefix = getPathPrefix('right');
    if (state.rightPane.pathNames.length === 0) {
        rightPath.textContent = rightPrefix;
    } else {
        rightPath.textContent = rightPrefix + state.rightPane.pathNames.join('\\');
    }
}

function getPathPrefix(pane) {
    const paneState = state[pane + 'Pane'];

    switch (paneState.viewMode) {
        case 'recent':
            return 'Recent:\\';
        case 'shared':
            return 'Shared:\\';
        case 'drive':
        default:
            return 'Drive:\\';
    }
}

async function handleRefresh() {
    // Reload the current directory for the active pane
    await loadFiles(state.activePane);
}

async function handleRename(file) {
    // Show input dialog with current filename
    const newName = await showInputDialog('Rename', 'Enter new name:', file.name);

    // If user cancelled or entered empty name, abort
    if (!newName || newName.trim() === '') {
        return;
    }

    // If name unchanged, do nothing
    if (newName === file.name) {
        return;
    }

    try {
        statusInfo.textContent = `Renaming ${file.name}...`;

        // Call IPC to rename file
        const result = await ipcRenderer.invoke('rename-file', file.id, newName);

        if (result.success) {
            statusInfo.textContent = `Renamed to: ${newName}`;

            // Refresh the active pane
            await loadFiles(state.activePane);

            // If both panes are in the same directory, refresh the other pane too
            const activePane = state.activePane;
            const otherPane = activePane === 'left' ? 'right' : 'left';
            const activePaneState = state[activePane + 'Pane'];
            const otherPaneState = state[otherPane + 'Pane'];

            // Check if both panes are viewing the same folder
            if (activePaneState.currentFolder === otherPaneState.currentFolder &&
                activePaneState.viewMode === otherPaneState.viewMode) {
                await loadFiles(otherPane);
            }
        } else {
            await showDialog('Rename Failed', result.error || 'Could not rename file.', ['OK']);
            statusInfo.textContent = '';
        }
    } catch (error) {
        await showDialog('Rename Error', `Error: ${error.message}`, ['OK']);
        statusInfo.textContent = '';
    }
}

async function showShareDialog(file) {
    // Set the filename in the title
    shareFilename.textContent = file.name;

    // Clear previous state
    shareEmailInput.value = '';
    shareEmailSuggestions.innerHTML = '';
    shareEmailSuggestions.classList.add('hidden');
    shareRoleSelect.value = 'reader';

    // Show loading in permissions list
    sharePermissionsList.innerHTML = '<div class="share-loading">Loading permissions...</div>';

    // Show the dialog
    shareOverlay.classList.remove('hidden');
    shareEmailInput.focus();

    // Load current permissions and general access
    await loadFilePermissionsAndAccess(file.id);

    // Set up event handlers
    let emailSuggestionIndex = -1;
    let emailSuggestions = [];
    let debounceTimer = null;

    const cleanup = () => {
        shareOverlay.classList.add('hidden');
        shareEmailInput.removeEventListener('input', emailInputHandler);
        shareEmailInput.removeEventListener('keydown', emailKeyHandler);
        shareAddBtn.removeEventListener('click', addClickHandler);
        shareCopyLinkBtn.removeEventListener('click', copyLinkClickHandler);
        shareCloseBtn.removeEventListener('click', closeClickHandler);
        shareGeneralAccessSelect.removeEventListener('change', generalAccessChangeHandler);
        document.removeEventListener('keydown', dialogKeyHandler);
        if (debounceTimer) clearTimeout(debounceTimer);
    };

    const emailInputHandler = (e) => {
        const query = e.target.value.trim();

        if (query.length < 2) {
            shareEmailSuggestions.classList.add('hidden');
            emailSuggestions = [];
            return;
        }

        // Debounce the autocomplete search
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            emailSuggestions = await searchContacts(query);
            displayEmailSuggestions(emailSuggestions);
        }, 300);
    };

    const displayEmailSuggestions = (suggestions) => {
        if (suggestions.length === 0) {
            shareEmailSuggestions.classList.add('hidden');
            return;
        }

        shareEmailSuggestions.innerHTML = '';

        // Show up to 10 suggestions (increased from default)
        const displayCount = Math.min(suggestions.length, 10);

        for (let index = 0; index < displayCount; index++) {
            const suggestion = suggestions[index];
            const div = document.createElement('div');
            div.className = 'share-email-suggestion';
            div.textContent = suggestion;
            div.addEventListener('click', () => {
                shareEmailInput.value = suggestion;
                shareEmailSuggestions.classList.add('hidden');
                shareEmailInput.focus();
            });
            shareEmailSuggestions.appendChild(div);
        }

        shareEmailSuggestions.classList.remove('hidden');
        emailSuggestionIndex = -1;
    };

    const emailKeyHandler = (e) => {
        if (!shareEmailSuggestions.classList.contains('hidden')) {
            const suggestions = shareEmailSuggestions.querySelectorAll('.share-email-suggestion');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                emailSuggestionIndex = Math.min(suggestions.length - 1, emailSuggestionIndex + 1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                emailSuggestionIndex = Math.max(-1, emailSuggestionIndex - 1);
                updateSuggestionSelection(suggestions);
            } else if (e.key === 'Enter' && emailSuggestionIndex >= 0) {
                e.preventDefault();
                shareEmailInput.value = emailSuggestions[emailSuggestionIndex];
                shareEmailSuggestions.classList.add('hidden');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                shareEmailSuggestions.classList.add('hidden');
            }
        }
        // Don't handle Tab here - let the document handler do it
    };

    const updateSuggestionSelection = (suggestions) => {
        suggestions.forEach((s, i) => {
            if (i === emailSuggestionIndex) {
                s.classList.add('selected');
            } else {
                s.classList.remove('selected');
            }
        });
    };

    const addClickHandler = async () => {
        const email = shareEmailInput.value.trim();
        const role = shareRoleSelect.value;

        if (!email) {
            await showDialog('Invalid Email', 'Please enter an email address.', ['OK']);
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            await showDialog('Invalid Email', 'Please enter a valid email address.', ['OK']);
            return;
        }

        try {
            statusInfo.textContent = `Sharing with ${email}...`;
            const result = await ipcRenderer.invoke('add-permission', file.id, email, role);

            if (result.success) {
                statusInfo.textContent = `Shared with ${email}`;
                shareEmailInput.value = '';
                shareEmailSuggestions.classList.add('hidden');
                await loadFilePermissionsAndAccess(file.id);
            } else {
                await showDialog('Share Failed', result.error || 'Could not add permission.', ['OK']);
                statusInfo.textContent = '';
            }
        } catch (error) {
            await showDialog('Share Error', `Error: ${error.message}`, ['OK']);
            statusInfo.textContent = '';
        }
    };

    const copyLinkClickHandler = async () => {
        try {
            const url = `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
            await navigator.clipboard.writeText(url);
            statusInfo.textContent = 'Link copied to clipboard!';
            setTimeout(() => {
                statusInfo.textContent = '';
            }, 2000);
        } catch (error) {
            await showDialog('Copy Failed', 'Could not copy link to clipboard.', ['OK']);
        }
    };

    const generalAccessChangeHandler = async () => {
        const accessType = shareGeneralAccessSelect.value;

        try {
            statusInfo.textContent = 'Updating general access...';
            const result = await ipcRenderer.invoke('set-general-access', file.id, accessType);

            if (result.success) {
                statusInfo.textContent = 'General access updated';
                updateGeneralAccessDescription(accessType);
                setTimeout(() => {
                    statusInfo.textContent = '';
                }, 2000);
            } else {
                await showDialog('Update Failed', result.error || 'Could not update general access.', ['OK']);
                statusInfo.textContent = '';
                await loadFilePermissionsAndAccess(file.id); // Reload to reset
            }
        } catch (error) {
            await showDialog('Update Error', `Error: ${error.message}`, ['OK']);
            statusInfo.textContent = '';
            await loadFilePermissionsAndAccess(file.id); // Reload to reset
        }
    };

    const closeClickHandler = () => {
        cleanup();
    };

    const dialogKeyHandler = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanup();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            // Tab cycling: Email Input → Role Select → Add Button → Close Button → Email Input
            const focused = document.activeElement;
            if (focused === shareEmailInput) {
                shareRoleSelect.focus();
            } else if (focused === shareRoleSelect) {
                shareAddBtn.focus();
            } else if (focused === shareAddBtn) {
                shareCloseBtn.focus();
            } else if (focused === shareCloseBtn) {
                shareEmailInput.focus();
            } else {
                shareEmailInput.focus(); // Default to input if focus is lost
            }
        }
    };

    shareEmailInput.addEventListener('input', emailInputHandler);
    shareEmailInput.addEventListener('keydown', emailKeyHandler);
    shareAddBtn.addEventListener('click', addClickHandler);
    shareCopyLinkBtn.addEventListener('click', copyLinkClickHandler);
    shareGeneralAccessSelect.addEventListener('change', generalAccessChangeHandler);
    shareCloseBtn.addEventListener('click', closeClickHandler);
    document.addEventListener('keydown', dialogKeyHandler);
}

async function loadFilePermissionsAndAccess(fileId) {
    try {
        const result = await ipcRenderer.invoke('get-permissions', fileId);

        if (result.success && result.permissions) {
            displayPermissions(result.permissions, fileId);
            updateGeneralAccessFromPermissions(result.permissions);
        } else {
            sharePermissionsList.innerHTML = '<div class="share-loading">Could not load permissions</div>';
        }
    } catch (error) {
        sharePermissionsList.innerHTML = `<div class="share-loading">Error: ${error.message}</div>`;
    }
}

function updateGeneralAccessFromPermissions(permissions) {
    // Check for 'anyone' or 'domain' permissions
    const anyonePermission = permissions.find(p => p.type === 'anyone');
    const domainPermission = permissions.find(p => p.type === 'domain');

    if (anyonePermission) {
        shareGeneralAccessSelect.value = 'anyone';
        updateGeneralAccessDescription('anyone');
    } else if (domainPermission) {
        shareGeneralAccessSelect.value = 'domain';
        updateGeneralAccessDescription('domain');
    } else {
        shareGeneralAccessSelect.value = 'restricted';
        updateGeneralAccessDescription('restricted');
    }
}

function updateGeneralAccessDescription(accessType) {
    if (accessType === 'restricted') {
        shareGeneralAccessDesc.textContent = 'Only people with access can open';
    } else if (accessType === 'domain') {
        shareGeneralAccessDesc.textContent = 'Anyone at Howell Public Schools with the link';
    } else if (accessType === 'anyone') {
        shareGeneralAccessDesc.textContent = 'Anyone on the internet with the link';
    }
}

function displayPermissions(permissions, fileId) {
    if (permissions.length === 0) {
        sharePermissionsList.innerHTML = '<div class="share-loading">No permissions set (private)</div>';
        return;
    }

    sharePermissionsList.innerHTML = '';

    // Filter out 'anyone' and 'domain' type permissions (they go in General Access)
    const userPermissions = permissions.filter(p => p.type === 'user' || p.type === 'group');

    userPermissions.forEach(perm => {
        const div = document.createElement('div');
        div.className = 'share-permission-item';

        const email = perm.emailAddress || perm.displayName || perm.type;
        const role = perm.role;
        const isOwner = role === 'owner';

        // Email/name span
        const emailSpan = document.createElement('span');
        emailSpan.className = 'share-permission-email';
        emailSpan.textContent = email;
        if (isOwner) {
            emailSpan.textContent += ' (Owner)';
        }

        div.appendChild(emailSpan);

        // Role dropdown or text for owner
        if (isOwner) {
            const ownerSpan = document.createElement('span');
            ownerSpan.className = 'share-permission-role';
            ownerSpan.textContent = 'Owner';
            div.appendChild(ownerSpan);
        } else {
            const roleSelect = document.createElement('select');
            roleSelect.className = 'share-permission-role-select';
            roleSelect.innerHTML = `
                <option value="reader" ${role === 'reader' ? 'selected' : ''}>Viewer</option>
                <option value="commenter" ${role === 'commenter' ? 'selected' : ''}>Commenter</option>
                <option value="writer" ${role === 'writer' ? 'selected' : ''}>Editor</option>
                <option value="remove" class="remove-option">Remove access</option>
            `;

            roleSelect.addEventListener('change', async (e) => {
                const newRole = e.target.value;

                if (newRole === 'remove') {
                    const confirmed = await showDialog(
                        'Remove Access',
                        `Remove access for ${email}?`,
                        ['Yes', 'No']
                    );

                    if (confirmed === 'Yes') {
                        try {
                            statusInfo.textContent = `Removing access for ${email}...`;
                            const result = await ipcRenderer.invoke('remove-permission', fileId, perm.id);

                            if (result.success) {
                                statusInfo.textContent = `Access removed for ${email}`;
                                await loadFilePermissionsAndAccess(fileId);
                            } else {
                                await showDialog('Remove Failed', result.error || 'Could not remove permission.', ['OK']);
                                statusInfo.textContent = '';
                                await loadFilePermissionsAndAccess(fileId); // Reload to reset
                            }
                        } catch (error) {
                            await showDialog('Remove Error', `Error: ${error.message}`, ['OK']);
                            statusInfo.textContent = '';
                            await loadFilePermissionsAndAccess(fileId); // Reload to reset
                        }
                    } else {
                        // User cancelled, reload to reset dropdown
                        await loadFilePermissionsAndAccess(fileId);
                    }
                } else {
                    // Update role
                    try {
                        statusInfo.textContent = `Updating access for ${email}...`;
                        const result = await ipcRenderer.invoke('update-permission', fileId, perm.id, newRole);

                        if (result.success) {
                            statusInfo.textContent = `Access updated for ${email}`;
                            setTimeout(() => {
                                statusInfo.textContent = '';
                            }, 2000);
                        } else {
                            await showDialog('Update Failed', result.error || 'Could not update permission.', ['OK']);
                            statusInfo.textContent = '';
                            await loadFilePermissionsAndAccess(fileId); // Reload to reset
                        }
                    } catch (error) {
                        await showDialog('Update Error', `Error: ${error.message}`, ['OK']);
                        statusInfo.textContent = '';
                        await loadFilePermissionsAndAccess(fileId); // Reload to reset
                    }
                }
            });

            div.appendChild(roleSelect);
        }

        sharePermissionsList.appendChild(div);
    });
}

async function searchContacts(query) {
    try {
        const result = await ipcRenderer.invoke('search-contacts', query);
        if (result.success && result.contacts) {
            return result.contacts;
        }
        return [];
    } catch (error) {
        console.error('Error searching contacts:', error);
        return [];
    }
}

async function handleCopy() {
    const sourcePane = state.activePane;
    const targetPane = sourcePane === 'left' ? 'right' : 'left';
    const sourcePaneState = state[sourcePane + 'Pane'];
    const targetPaneState = state[targetPane + 'Pane'];
    const currentFile = sourcePaneState.files[sourcePaneState.selectedIndex];

    if (!currentFile) return;

    const confirmed = await showDialog(
        'Copy',
        `Copy "${currentFile.name}" to the other pane?`,
        ['Yes', 'No']
    );

    if (confirmed === 'Yes') {
        const result = await ipcRenderer.invoke('copy-file', currentFile.id, targetPaneState.currentFolder);

        if (result.success) {
            await loadFiles(targetPane);
            showDialog('Success', 'File copied successfully!', ['OK']);
        } else {
            showDialog('Error', `Failed to copy: ${result.error}`, ['OK']);
        }
    }
}

async function handleMove() {
    const sourcePane = state.activePane;
    const targetPane = sourcePane === 'left' ? 'right' : 'left';
    const sourcePaneState = state[sourcePane + 'Pane'];
    const targetPaneState = state[targetPane + 'Pane'];
    const currentFile = sourcePaneState.files[sourcePaneState.selectedIndex];

    if (!currentFile || !currentFile.parents) return;

    const confirmed = await showDialog(
        'Move',
        `Move "${currentFile.name}" to the other pane?`,
        ['Yes', 'No']
    );

    if (confirmed === 'Yes') {
        const result = await ipcRenderer.invoke(
            'move-file',
            currentFile.id,
            targetPaneState.currentFolder,
            currentFile.parents[0]
        );

        if (result.success) {
            await loadFiles(sourcePane);
            await loadFiles(targetPane);
            showDialog('Success', 'File moved successfully!', ['OK']);
        } else {
            showDialog('Error', `Failed to move: ${result.error}`, ['OK']);
        }
    }
}

async function handleDelete() {
    const paneState = state[state.activePane + 'Pane'];
    const currentFile = paneState.files[paneState.selectedIndex];

    if (!currentFile) return;

    const confirmed = await showDialog(
        'Delete',
        `Delete "${currentFile.name}"? This action cannot be undone!`,
        ['Yes', 'No']
    );

    if (confirmed === 'Yes') {
        const result = await ipcRenderer.invoke('delete-file', currentFile.id);

        if (result.success) {
            await loadFiles(state.activePane);
            showDialog('Success', 'File deleted successfully!', ['OK']);
        } else {
            showDialog('Error', `Failed to delete: ${result.error}`, ['OK']);
        }
    }
}

async function handleMkdir() {
    const paneState = state[state.activePane + 'Pane'];

    const folderName = await showInputDialog(
        'Create Folder',
        'Enter folder name:',
        ''
    );

    if (folderName) {
        const result = await ipcRenderer.invoke('create-folder', folderName, paneState.currentFolder);

        if (result.success) {
            await loadFiles(state.activePane);
            showDialog('Success', 'Folder created successfully!', ['OK']);
        } else {
            showDialog('Error', `Failed to create folder: ${result.error}`, ['OK']);
        }
    }
}

function showDialog(title, content, buttons) {
    return new Promise((resolve) => {
        const dialogTitle = dialogOverlay.querySelector('.dialog-title');
        const dialogContent = dialogOverlay.querySelector('.dialog-content');
        const dialogButtons = dialogOverlay.querySelector('.dialog-buttons');

        dialogTitle.textContent = title;
        dialogContent.textContent = content;
        dialogButtons.innerHTML = '';

        // Default to last button (usually No/Cancel) for safety
        let selectedButtonIndex = buttons.length - 1;

        buttons.forEach((buttonText, index) => {
            const button = document.createElement('button');
            button.className = 'dialog-button';
            button.textContent = buttonText;
            button.dataset.index = index;

            button.addEventListener('click', () => {
                cleanup();
                resolve(buttonText);
            });

            dialogButtons.appendChild(button);
        });

        // Keyboard handler for dialog
        const dialogKeyHandler = (e) => {
            const buttonElements = dialogButtons.querySelectorAll('.dialog-button');

            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                selectedButtonIndex = Math.max(0, selectedButtonIndex - 1);
                buttonElements[selectedButtonIndex].focus();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                selectedButtonIndex = Math.min(buttons.length - 1, selectedButtonIndex + 1);
                buttonElements[selectedButtonIndex].focus();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                // Toggle between buttons
                selectedButtonIndex = (selectedButtonIndex + 1) % buttons.length;
                buttonElements[selectedButtonIndex].focus();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                cleanup();
                resolve(buttons[selectedButtonIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
                resolve(buttons[buttons.length - 1]); // Default to last button (usually No/Cancel)
            }
        };

        const cleanup = () => {
            dialogOverlay.classList.add('hidden');
            document.removeEventListener('keydown', dialogKeyHandler);
        };

        document.addEventListener('keydown', dialogKeyHandler);
        dialogOverlay.classList.remove('hidden');

        const buttonElements = dialogButtons.querySelectorAll('.dialog-button');
        buttonElements[selectedButtonIndex].focus();
    });
}

function showInputDialog(title, prompt, defaultValue) {
    return new Promise((resolve) => {
        const dialogTitle = dialogOverlay.querySelector('.dialog-title');
        const dialogContent = dialogOverlay.querySelector('.dialog-content');
        const dialogButtons = dialogOverlay.querySelector('.dialog-buttons');

        dialogTitle.textContent = title;
        dialogContent.innerHTML = `
            ${prompt}
            <input type="text" class="dialog-input" value="${defaultValue}" />
        `;
        dialogButtons.innerHTML = '';

        const input = dialogContent.querySelector('.dialog-input');

        const okButton = document.createElement('button');
        okButton.className = 'dialog-button';
        okButton.textContent = 'OK';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'dialog-button';
        cancelButton.textContent = 'Cancel';

        dialogButtons.appendChild(okButton);
        dialogButtons.appendChild(cancelButton);

        dialogOverlay.classList.remove('hidden');
        input.focus();
        input.select();

        const cleanup = () => {
            input.removeEventListener('keydown', inputKeyHandler);
            okButton.removeEventListener('keydown', buttonKeyHandler);
            cancelButton.removeEventListener('keydown', buttonKeyHandler);
            okButton.removeEventListener('click', okClickHandler);
            cancelButton.removeEventListener('click', cancelClickHandler);
            dialogOverlay.classList.add('hidden');
        };

        const okClickHandler = () => {
            cleanup();
            resolve(input.value);
        };

        const cancelClickHandler = () => {
            cleanup();
            resolve(null);
        };

        const inputKeyHandler = (e) => {
            if (e.key === 'Enter') {
                // Safety measure: Enter in input field does nothing
                // User must Tab to OK button and press Enter there
                e.preventDefault();
                e.stopPropagation();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resolve(null);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                okButton.focus();
            }
        };

        const buttonKeyHandler = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const focused = document.activeElement;
                if (focused === okButton) {
                    cancelButton.focus();
                } else {
                    okButton.focus();
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const focused = document.activeElement;
                if (focused === okButton) {
                    cancelButton.focus();
                } else if (focused === cancelButton) {
                    input.focus();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const focused = document.activeElement;
                cleanup();
                if (focused === okButton) {
                    resolve(input.value);
                } else if (focused === cancelButton) {
                    resolve(null);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup();
                resolve(null);
            }
        };

        input.addEventListener('keydown', inputKeyHandler);
        okButton.addEventListener('keydown', buttonKeyHandler);
        cancelButton.addEventListener('keydown', buttonKeyHandler);
        okButton.addEventListener('click', okClickHandler);
        cancelButton.addEventListener('click', cancelClickHandler);
    });
}

async function handleViewModeMenu() {
    const paneState = state[state.activePane + 'Pane'];
    const currentMode = paneState.viewMode;

    // Show selection menu with current mode pre-selected
    const options = ['Main Drive', 'Recent Files', 'Shared With Me'];
    const modeMap = {
        'Main Drive': 'drive',
        'Recent Files': 'recent',
        'Shared With Me': 'shared'
    };

    // Find current selection index
    let defaultIndex = 0;
    if (currentMode === 'recent') defaultIndex = 1;
    else if (currentMode === 'shared') defaultIndex = 2;

    const selected = await showSelectionDialog(
        'View Mode',
        'Select view mode for this pane:',
        options,
        defaultIndex
    );

    if (selected) {
        const newMode = modeMap[selected];

        // Only reload if mode actually changed
        if (newMode !== paneState.viewMode) {
            paneState.viewMode = newMode;

            // Reset pane state for new view mode
            if (newMode === 'recent' || newMode === 'shared') {
                // For recent/shared views, reset folder navigation
                paneState.currentFolder = 'root';
                paneState.folderStack = [];
                paneState.pathNames = [];
                paneState.selectedIndex = 0;
            }

            // Reload files for the active pane
            await loadFiles(state.activePane);
            updatePathDisplay();
        }
    }
}

function updatePaneColors() {
    // Update left pane color
    const leftPaneState = state.leftPane;
    leftPane.className = 'pane';
    if (state.activePane === 'left') {
        leftPane.classList.add('active');
    }
    leftPane.classList.add(`mode-${leftPaneState.viewMode}`);

    // Update right pane color
    const rightPaneState = state.rightPane;
    rightPane.className = 'pane';
    if (state.activePane === 'right') {
        rightPane.classList.add('active');
    }
    rightPane.classList.add(`mode-${rightPaneState.viewMode}`);
}

// Google Docs MIME types
const GOOGLE_DOC_MIME_TYPES = {
    'application/vnd.google-apps.document': { name: 'Google Doc', exports: ['pdf', 'docx'] },
    'application/vnd.google-apps.spreadsheet': { name: 'Google Sheet', exports: ['pdf', 'xlsx'] },
    'application/vnd.google-apps.presentation': { name: 'Google Slides', exports: ['pdf', 'pptx'] }
};

async function handleEditMenu() {
    const paneState = state[state.activePane + 'Pane'];

    // Check if a file is selected (not on parent directory)
    if (paneState.selectedIndex < 0 || paneState.files.length === 0) {
        await showDialog('No Selection', 'Please select a file or folder to edit.', ['OK']);
        return;
    }

    const selectedFile = paneState.files[paneState.selectedIndex];

    // Define edit menu structure
    const editMenuItems = [
        {
            label: 'Rename',
            action: () => handleRename(selectedFile)
        },
        {
            label: 'Share',
            action: () => showShareDialog(selectedFile)
        },
        {
            label: 'File Organization',
            hasSubmenu: true,
            submenu: [
                {
                    label: '[Coming Soon]',
                    action: () => showDialog('Not Implemented', 'File organization coming in Phase 4!', ['OK'])
                }
            ]
        }
    ];

    // Show the nested menu system
    await showNestedMenu('Edit', editMenuItems);
}

async function handlePulldownMenu() {
    const paneState = state[state.activePane + 'Pane'];

    // Check if a file is selected (not on parent directory)
    if (paneState.selectedIndex < 0 || paneState.files.length === 0) {
        await showDialog('No Selection', 'Please select a file to access the menu.', ['OK']);
        return;
    }

    const selectedFile = paneState.files[paneState.selectedIndex];

    // Check if it's a Google Doc that needs format selection
    const isGoogleDoc = GOOGLE_DOC_MIME_TYPES.hasOwnProperty(selectedFile.mimeType);

    // Define main menu structure
    const mainMenuItems = [
        {
            label: 'Download',
            hasSubmenu: true,
            submenu: isGoogleDoc ? [
                {
                    label: 'PDF',
                    action: () => downloadFile(selectedFile, 'pdf')
                },
                {
                    label: 'DOCX',
                    action: () => downloadFile(selectedFile, 'docx')
                }
            ] : [
                {
                    label: 'Download File',
                    action: () => downloadFile(selectedFile)
                }
            ]
        }
        // Add more menu items here in the future (e.g., Rename, Properties, etc.)
    ];

    // Show the nested menu system
    await showNestedMenu('Menu', mainMenuItems);
}

// Nested menu system with support for submenus
function showNestedMenu(title, menuItems) {
    return new Promise((resolve) => {
        const menuStack = []; // Stack of menu levels
        let currentKeyHandler = null;

        // Create a menu box
        function createMenuBox(title, items, level) {
            const box = document.createElement('div');
            box.className = 'pulldown-menu-box';
            box.dataset.level = level;

            const titleDiv = document.createElement('div');
            titleDiv.className = 'pulldown-menu-title';
            titleDiv.textContent = title;
            box.appendChild(titleDiv);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'pulldown-menu-items';

            items.forEach((item, index) => {
                const menuItem = document.createElement('div');
                menuItem.className = 'pulldown-menu-item';
                menuItem.dataset.index = index;

                const label = document.createElement('span');
                label.className = 'menu-item-label';
                label.textContent = item.label;
                menuItem.appendChild(label);

                // Add arrow for submenus
                if (item.hasSubmenu) {
                    const arrow = document.createElement('span');
                    arrow.className = 'menu-item-arrow';
                    arrow.textContent = '►';
                    menuItem.appendChild(arrow);
                }

                itemsContainer.appendChild(menuItem);
            });

            box.appendChild(itemsContainer);
            return box;
        }

        // Update which menu is active
        function updateMenuActivity() {
            const allBoxes = pulldownMenuContainer.querySelectorAll('.pulldown-menu-box');
            allBoxes.forEach((box, idx) => {
                if (idx === menuStack.length - 1) {
                    box.classList.remove('inactive');
                } else {
                    box.classList.add('inactive');
                }
            });
        }

        // Navigate to a submenu
        function openSubmenu(parentItem) {
            const currentMenu = menuStack[menuStack.length - 1];
            const selectedItem = currentMenu.items[currentMenu.selectedIndex];

            if (!selectedItem.hasSubmenu) return;

            const submenuBox = createMenuBox(selectedItem.label, selectedItem.submenu, menuStack.length);
            pulldownMenuContainer.appendChild(submenuBox);

            // Position the submenu relative to the parent menu
            // Get parent menu box dimensions and position
            const parentBox = currentMenu.box;
            const parentRect = parentBox.getBoundingClientRect();
            const containerRect = pulldownMenuContainer.getBoundingClientRect();

            // Calculate position: to the right of parent, offset by a bit
            const leftOffset = parentRect.width - 10; // Overlap by 10px for classic look
            const topOffset = 0; // Align with top of parent

            submenuBox.style.left = `${leftOffset}px`;
            submenuBox.style.top = `${topOffset}px`;

            menuStack.push({
                box: submenuBox,
                items: selectedItem.submenu,
                selectedIndex: 0
            });

            updateMenuActivity();
            updateSelection();
            setupKeyHandler();
        }

        // Go back to parent menu
        function closeSubmenu() {
            if (menuStack.length <= 1) {
                // At root menu, close everything
                cleanup();
                resolve();
                return;
            }

            const currentMenu = menuStack.pop();
            currentMenu.box.remove();

            updateMenuActivity();
            updateSelection();
            setupKeyHandler();
        }

        // Update selection highlighting
        function updateSelection() {
            const currentMenu = menuStack[menuStack.length - 1];
            const items = currentMenu.box.querySelectorAll('.pulldown-menu-item');

            items.forEach((item, idx) => {
                if (idx === currentMenu.selectedIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }

        // Set up keyboard handler for current menu level
        function setupKeyHandler() {
            // Remove old handler
            if (currentKeyHandler) {
                document.removeEventListener('keydown', currentKeyHandler);
            }

            const currentMenu = menuStack[menuStack.length - 1];

            currentKeyHandler = (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    currentMenu.selectedIndex = Math.min(currentMenu.items.length - 1, currentMenu.selectedIndex + 1);
                    updateSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    currentMenu.selectedIndex = Math.max(0, currentMenu.selectedIndex - 1);
                    updateSelection();
                } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                    e.preventDefault();
                    const selectedItem = currentMenu.items[currentMenu.selectedIndex];

                    if (selectedItem.hasSubmenu) {
                        openSubmenu();
                    } else if (selectedItem.action) {
                        // Execute action and close all menus
                        cleanup();
                        selectedItem.action();
                        resolve();
                    }
                } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
                    e.preventDefault();
                    closeSubmenu();
                } else if (e.key === 'F3') {
                    e.preventDefault();
                    cleanup();
                    resolve();
                }
            };

            document.addEventListener('keydown', currentKeyHandler);
        }

        // Cleanup function
        function cleanup() {
            if (currentKeyHandler) {
                document.removeEventListener('keydown', currentKeyHandler);
            }
            pulldownMenuContainer.innerHTML = '';
            pulldownMenu.classList.add('hidden');
        }

        // Initialize with root menu
        const rootBox = createMenuBox(title, menuItems, 0);
        pulldownMenuContainer.innerHTML = '';
        pulldownMenuContainer.appendChild(rootBox);

        menuStack.push({
            box: rootBox,
            items: menuItems,
            selectedIndex: 0
        });

        updateSelection();
        setupKeyHandler();
        pulldownMenu.classList.remove('hidden');
    });
}

async function downloadFile(file, exportFormat = null) {
    try {
        // Show loading indicator
        statusInfo.textContent = `Downloading ${file.name}...`;

        if (exportFormat) {
            // Google Doc export
            await ipcRenderer.invoke('export-google-doc', file.id, file.name, exportFormat);
        } else {
            // Regular file download
            await ipcRenderer.invoke('download-file', file.id, file.name);
        }

        statusInfo.textContent = `Downloaded: ${file.name}`;

        // Show success dialog
        await showDialog('Download Complete', `File downloaded to your Downloads folder:\n${file.name}`, ['OK']);
    } catch (error) {
        console.error('Download failed:', error);
        await showDialog('Download Failed', `Failed to download ${file.name}\n\nError: ${error.message}`, ['OK']);
    }
}

function showSelectionDialog(title, prompt, options, defaultIndex = 0) {
    return new Promise((resolve) => {
        const dialogTitle = dialogOverlay.querySelector('.dialog-title');
        const dialogContent = dialogOverlay.querySelector('.dialog-content');
        const dialogButtons = dialogOverlay.querySelector('.dialog-buttons');

        dialogTitle.textContent = title;
        dialogContent.innerHTML = `
            <div style="margin-bottom: 10px;">${prompt}</div>
            <div class="selection-list" style="border: 2px solid #00FFFF; background-color: #000088; padding: 5px;"></div>
        `;

        const selectionList = dialogContent.querySelector('.selection-list');
        let selectedIndex = defaultIndex;

        // Create selection items
        options.forEach((option, index) => {
            const item = document.createElement('div');
            item.className = 'selection-item';
            item.style.padding = '3px 8px';
            item.style.cursor = 'pointer';
            item.textContent = option;
            item.dataset.index = index;

            if (index === selectedIndex) {
                item.style.backgroundColor = '#00FFFF';
                item.style.color = '#000000';
            }

            item.addEventListener('click', () => {
                cleanup();
                resolve(option);
            });

            selectionList.appendChild(item);
        });

        dialogButtons.innerHTML = '';

        const escButton = document.createElement('button');
        escButton.className = 'dialog-button';
        escButton.textContent = 'Esc to exit';
        escButton.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });

        dialogButtons.appendChild(escButton);

        // Update selection highlighting
        const updateSelection = () => {
            const items = selectionList.querySelectorAll('.selection-item');
            items.forEach((item, idx) => {
                if (idx === selectedIndex) {
                    item.style.backgroundColor = '#00FFFF';
                    item.style.color = '#000000';
                } else {
                    item.style.backgroundColor = '';
                    item.style.color = '';
                }
            });
        };

        // Keyboard handler for selection
        const dialogKeyHandler = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(0, selectedIndex - 1);
                updateSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // If button is focused, trigger it; otherwise select current option
                if (document.activeElement === escButton) {
                    cleanup();
                    resolve(null);
                } else {
                    cleanup();
                    resolve(options[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
                resolve(null);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                escButton.focus();
            }
        };

        const cleanup = () => {
            dialogOverlay.classList.add('hidden');
            document.removeEventListener('keydown', dialogKeyHandler);
        };

        document.addEventListener('keydown', dialogKeyHandler);
        dialogOverlay.classList.remove('hidden');
        selectionList.focus();
    });
}

// Search functionality
let searchTimeout = null;
let searchSelectedIndex = 0;
let searchResults = [];

function showSearchDialog() {
    // Reset search state
    searchResults = [];
    searchSelectedIndex = 0;
    suggestionsList.innerHTML = '';
    searchSuggestions.classList.add('hidden');
    state.searchUsingKeyboard = false; // Reset keyboard flag

    // Reset header text
    const suggestionsHeader = document.querySelector('.suggestions-header');
    suggestionsHeader.textContent = 'Suggested matches:';

    // Show search overlay
    searchOverlay.classList.remove('hidden');

    // Set up event listeners and get the fresh input element
    const freshSearchInput = setupSearchListeners();

    // Focus and select all text immediately
    // Use setTimeout to ensure focus and selection happens after the overlay is fully visible
    setTimeout(() => {
        freshSearchInput.focus();
        freshSearchInput.select(); // Select all text so user can type over it or press End to edit
    }, 0);
}

function setupSearchListeners() {
    // Get the current search input element
    const currentSearchInput = document.getElementById('search-input');

    // Remove all existing event listeners by cloning and replacing
    const newSearchInput = currentSearchInput.cloneNode(true);
    currentSearchInput.parentNode.replaceChild(newSearchInput, currentSearchInput);

    // Add event listeners to the new element
    newSearchInput.addEventListener('input', handleSearchInput);
    newSearchInput.addEventListener('keydown', handleSearchKeydown);

    // Return the new element so we can focus it
    return newSearchInput;
}

async function handleSearchInput(e) {
    const query = e.target.value.trim();

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // If query is empty, hide suggestions
    if (query.length === 0) {
        searchSuggestions.classList.add('hidden');
        searchResults = [];
        return;
    }

    // Debounce search - wait 300ms after user stops typing
    searchTimeout = setTimeout(async () => {
        // Reset header back to suggestions mode
        const suggestionsHeader = document.querySelector('.suggestions-header');
        suggestionsHeader.textContent = 'Suggested matches:';

        // Search for suggestions (limit to 8 results)
        const result = await ipcRenderer.invoke('search-files', query, 8);

        if (result.success && result.files.length > 0) {
            searchResults = result.files;
            searchSelectedIndex = 0;
            renderSearchSuggestions();
            searchSuggestions.classList.remove('hidden');
        } else {
            searchSuggestions.classList.add('hidden');
            searchResults = [];
        }
    }, 300);
}

function renderSearchSuggestions() {
    suggestionsList.innerHTML = '';

    searchResults.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        if (index === searchSelectedIndex) {
            item.classList.add('selected');
        }

        // Add folder icon if it's a folder
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'suggestion-icon';
            iconSpan.textContent = '📁';
            item.appendChild(iconSpan);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'suggestion-name';
        nameSpan.textContent = file.name;
        nameSpan.title = file.name; // Full name on hover

        const typeSpan = document.createElement('span');
        typeSpan.className = 'suggestion-type';
        typeSpan.textContent = getFileType(file.mimeType);

        item.appendChild(nameSpan);
        item.appendChild(typeSpan);

        // Click handler
        item.addEventListener('click', async () => {
            await openSearchResult(file);
            closeSearchDialog();
        });

        // Hover handler - only update selection if not using keyboard
        item.addEventListener('mouseenter', () => {
            // Don't override keyboard selection
            if (!state.searchUsingKeyboard) {
                searchSelectedIndex = index;
                renderSearchSuggestions();
            }
        });

        // Mouse move handler - clear keyboard flag when mouse moves
        item.addEventListener('mousemove', () => {
            state.searchUsingKeyboard = false;
            searchSelectedIndex = index;
            renderSearchSuggestions();
        });

        suggestionsList.appendChild(item);
    });
}

async function handleSearchKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchDialog();
    } else if (e.key === 'Tab') {
        // Prevent Tab from switching panes while in search dialog
        e.preventDefault();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        const query = e.target.value.trim();

        if (query.length === 0) {
            return;
        }

        // If Shift+Enter, do a full search
        if (e.shiftKey) {
            performFullSearch(query);
        } else {
            // Regular Enter: If we have suggestions, open the selected one
            if (searchResults.length > 0) {
                const selectedFile = searchResults[searchSelectedIndex];
                await openSearchResult(selectedFile);
                closeSearchDialog();
            } else {
                // No suggestions yet, do a full search
                performFullSearch(query);
            }
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.searchUsingKeyboard = true; // Mark that keyboard is being used
        if (searchResults.length > 0) {
            searchSelectedIndex = Math.min(searchResults.length - 1, searchSelectedIndex + 1);
            renderSearchSuggestions();
            scrollToSelectedSuggestion();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.searchUsingKeyboard = true; // Mark that keyboard is being used
        if (searchResults.length > 0) {
            searchSelectedIndex = Math.max(0, searchSelectedIndex - 1);
            renderSearchSuggestions();
            scrollToSelectedSuggestion();
        }
    }
}

async function performFullSearch(query) {
    // Show loading state
    suggestionsList.innerHTML = '<div class="loading" style="padding: 10px; text-align: center;">Searching...</div>';
    searchSuggestions.classList.remove('hidden');

    // Perform full search with more results
    const result = await ipcRenderer.invoke('search-files', query, 100);

    if (result.success && result.files.length > 0) {
        searchResults = result.files;
        searchSelectedIndex = 0;

        // Update header to show we're in full results mode
        const suggestionsHeader = document.querySelector('.suggestions-header');
        suggestionsHeader.textContent = `Search results (${result.files.length} found):`;

        renderSearchSuggestions();

        // Scroll to top of results
        suggestionsList.scrollTop = 0;
    } else {
        suggestionsList.innerHTML = '<div style="padding: 10px; text-align: center; color: #FFFF00;">No results found</div>';
    }
}

async function openSearchResult(file) {
    // If it's a folder, navigate to it in the active pane
    if (file.mimeType === 'application/vnd.google-apps.folder') {
        const paneState = state[state.activePane + 'Pane'];

        // Only navigate if we're in drive mode
        if (paneState.viewMode === 'drive') {
            // Save current state to folder stack
            paneState.folderStack.push({
                id: paneState.currentFolder,
                selectedIndex: paneState.selectedIndex
            });

            // Navigate to the selected folder
            paneState.currentFolder = file.id;
            paneState.pathNames.push(file.name);
            paneState.selectedIndex = -1; // Select parent (..) by default

            await loadFiles(state.activePane);
            updatePathDisplay();
        } else {
            // In recent/shared mode, just open in browser
            const url = await ipcRenderer.invoke('get-file-url', file.id);
            shell.openExternal(url);
        }
    } else {
        // Open file in browser
        const url = await ipcRenderer.invoke('get-file-url', file.id);
        shell.openExternal(url);
    }
}

function scrollToSelectedSuggestion() {
    const selectedItem = suggestionsList.querySelector('.suggestion-item.selected');
    if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function closeSearchDialog() {
    searchOverlay.classList.add('hidden');
    // Don't clear the search input - keep it for next search
    // searchInput.value = '';
    searchResults = [];
    searchSuggestions.classList.add('hidden');
}

// Drag and Drop functionality
function setupDragAndDrop() {
    const panes = [
        { element: leftList, pane: 'left' },
        { element: rightList, pane: 'right' }
    ];

    panes.forEach(({ element, pane }) => {
        // Prevent default drag behaviors
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Only show visual feedback if in drive mode
            const paneState = state[pane + 'Pane'];
            if (paneState.viewMode === 'drive') {
                element.classList.add('drag-over');
            }
        });

        element.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');

            console.log('Drop event fired!');

            const paneState = state[pane + 'Pane'];

            // Only allow drops in drive mode
            if (paneState.viewMode !== 'drive') {
                console.log('Not in drive mode, ignoring drop');
                return;
            }

            const files = e.dataTransfer.files;
            console.log(`Dropped ${files.length} files`);

            if (files.length > 0) {
                // Upload files to current folder
                const parentId = paneState.currentFolder;
                console.log(`Uploading to folder: ${parentId}`);

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];

                    console.log(`Uploading ${file.name}...`);

                    try {
                        // Read file as ArrayBuffer
                        const arrayBuffer = await file.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);

                        console.log(`Read ${buffer.length} bytes from ${file.name}`);

                        // Upload the file buffer
                        const result = await ipcRenderer.invoke('upload-file-buffer', file.name, buffer, parentId);

                        if (result.success) {
                            console.log(`Successfully uploaded ${file.name}`);
                        } else {
                            console.error(`Failed to upload ${file.name}: ${result.error}`);
                            alert(`Failed to upload ${file.name}: ${result.error}`);
                        }
                    } catch (error) {
                        console.error(`Exception uploading ${file.name}:`, error);
                        alert(`Exception uploading ${file.name}: ${error.message}`);
                    }
                }

                // Reload the pane to show new files
                console.log('Reloading pane...');
                await loadFiles(pane);
            }
        });
    });
}

// Start the app
init();
