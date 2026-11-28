// Stable across reloads and shared by this browser's tabs. Web Locks serialize
// tabs locally; the server lease prevents a second browser/device speaking.
export const voiceOwner=(()=>{try{const key='qi-broadcast-device-v2',saved=localStorage.getItem(key);if(saved&&/^[a-f0-9-]{36}$/.test(saved))return saved;const id=crypto.randomUUID();localStorage.setItem(key,id);return id;}catch{return crypto.randomUUID();}})();
