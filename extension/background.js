console.log('Background script loaded!');

let popupWindow = null;

// Open popup window when extension icon is clicked
chrome.action.onClicked.addListener(async () => {
    console.log('Extension icon clicked');

    // If window already exists, focus it
    if (popupWindow) {
        try {
            const window = await chrome.windows.get(popupWindow);
            if (window) {
                await chrome.windows.update(popupWindow, { focused: true });
                console.log('Focused existing popup window');
                return;
            }
        } catch (error) {
            // Window was closed, create a new one
            popupWindow = null;
        }
    }

    // Create new popup window
    const popup = await chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 420,
        height: 600,
        top: 100
    });

    popupWindow = popup.id;
    console.log('Created popup window:', popupWindow);
});

// Clear popupWindow reference when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === popupWindow) {
        popupWindow = null;
        console.log('Popup window closed');
    }
});
