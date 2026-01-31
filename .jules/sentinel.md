# Sentinel's Journal 🛡️

## 2025-05-15 - [Defense in Depth: Input Validation]
**Vulnerability:** Lack of input length limits on user-facing fields (folder names, search, password).
**Learning:** Purely client-side applications often overlook input validation as there is no backend to "protect". However, missing limits can lead to state corruption and storage-based DoS (filling localStorage with massive strings).
**Prevention:** Always enforce `maxLength` on UI inputs AND implement truncation logic in the state management layer (e.g., Zustand store) to ensure data integrity even if UI constraints are bypassed.
