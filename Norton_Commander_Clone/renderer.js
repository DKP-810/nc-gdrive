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

// Initialize app
async function init() {
    setupKeyboardListeners();

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

        case 'F2':
            e.preventDefault();
            handleViewModeMenu();
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
        okButton.addEventListener('click', () => {
            dialogOverlay.classList.add('hidden');
            resolve(input.value);
        });

        const cancelButton = document.createElement('button');
        cancelButton.className = 'dialog-button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            dialogOverlay.classList.add('hidden');
            resolve(null);
        });

        dialogButtons.appendChild(okButton);
        dialogButtons.appendChild(cancelButton);

        dialogOverlay.classList.remove('hidden');
        input.focus();
        input.select();

        const inputKeyHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                dialogOverlay.classList.add('hidden');
                resolve(input.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                dialogOverlay.classList.add('hidden');
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
            }
        };

        input.addEventListener('keydown', inputKeyHandler);
        okButton.addEventListener('keydown', buttonKeyHandler);
        cancelButton.addEventListener('keydown', buttonKeyHandler);
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

// Start the app
init();
