chrome.devtools.panels.create(
  "MockGQL",
  "icons/icon48.png",
  "panel/panel.html",
  (panel) => {
    console.log("MockGQL panel created");
  }
);
