const { ipcRenderer, shell } = require('electron');

// State management
const state = {
    activePane: 'left',
    leftPane: {
        currentFolder: 'root',
        currentFolderName: '',
        files: [],
        selectedIndex: 0,
        folderStack: [],
        pathNames: [] // Stack of folder names for building path
    },
    rightPane: {
        currentFolder: 'root',
        currentFolderName: '',
        files: [],
        selectedIndex: 0,
        folderStack: [],
        pathNames: [] // Stack of folder names for building path
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
const statusInfo = document.getElementById('status-info');
const dialogOverlay = document.getElementById('dialog-overlay');

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
    loadFiles('right');
}

async function loadFiles(pane) {
    const paneState = state[pane + 'Pane'];
    const listElement = pane === 'left' ? leftList : rightList;

    listElement.innerHTML = '<div class="loading">Loading...</div>';

    const result = await ipcRenderer.invoke('list-files', paneState.currentFolder);

    if (result.success) {
        paneState.files = result.files;
        renderFiles(pane);
        updateStatusBar();
    } else {
        listElement.innerHTML = `<div style="color: #FF0000;">Error: ${result.error}</div>`;
    }
}

function renderFiles(pane) {
    const paneState = state[pane + 'Pane'];
    const listElement = pane === 'left' ? leftList : rightList;

    listElement.innerHTML = '';

    // Add parent directory entry if not at root
    if (paneState.currentFolder !== 'root') {
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

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';

        const infoSpan = document.createElement('span');
        infoSpan.className = 'file-info';

        if (file.mimeType === 'application/vnd.google-apps.folder') {
            item.classList.add('folder');
            nameSpan.textContent = file.name;
            infoSpan.textContent = 'SUB-DIR';
        } else {
            item.classList.add('file');
            nameSpan.textContent = file.name;
            infoSpan.textContent = ''; // No info for regular files
        }

        // Add title attribute for full filename on hover
        item.title = file.name;

        item.appendChild(nameSpan);
        item.appendChild(infoSpan);
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

function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        // Check if dialog is open - if so, don't handle main screen keys
        if (!dialogOverlay.classList.contains('hidden')) {
            return; // Let dialog handle its own keyboard events
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

        case 'Tab':
            e.preventDefault();
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

        case 'F10':
            e.preventDefault();
            window.close();
            break;
    }
}

function toggleActivePane() {
    state.activePane = state.activePane === 'left' ? 'right' : 'left';

    if (state.activePane === 'left') {
        leftPane.classList.add('active');
        rightPane.classList.remove('active');
    } else {
        leftPane.classList.remove('active');
        rightPane.classList.add('active');
    }
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
        // Navigate into folder
        paneState.folderStack.push({
            id: paneState.currentFolder,
            selectedIndex: paneState.selectedIndex
        });
        paneState.currentFolder = currentFile.id;
        paneState.pathNames.push(currentFile.name); // Add folder name to path
        paneState.selectedIndex = -1; // Select parent (..) by default
        await loadFiles(state.activePane);
        updatePathDisplay();
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
    if (state.leftPane.pathNames.length === 0) {
        leftPath.textContent = 'Drive:\\';
    } else {
        leftPath.textContent = 'Drive:\\' + state.leftPane.pathNames.join('\\');
    }

    // Build DOS-style path for right pane
    if (state.rightPane.pathNames.length === 0) {
        rightPath.textContent = 'Drive:\\';
    } else {
        rightPath.textContent = 'Drive:\\' + state.rightPane.pathNames.join('\\');
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

// Start the app
init();
