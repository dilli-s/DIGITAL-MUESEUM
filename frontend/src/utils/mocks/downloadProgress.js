// TEMPORARY: Adapter to simulate download progress until real events are wired in.
// Connects to Workbox precache and Dexie populate functions conceptually.

export const simulateOfflineDownload = (onProgress, onComplete) => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 5; // increment 5-20%
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      onProgress(progress);
      setTimeout(() => {
        onComplete();
      }, 400); // slight delay at 100%
    } else {
      onProgress(progress);
    }
  }, 250);
};
