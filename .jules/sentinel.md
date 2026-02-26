# Sentinel's Journal 🛡️

## 2025-05-15 - [Defense in Depth: Input Validation]
**Vulnerability:** Lack of input length limits on user-facing fields (folder names, search, password).
**Learning:** Purely client-side applications often overlook input validation as there is no backend to "protect". However, missing limits can lead to state corruption and storage-based DoS (filling localStorage with massive strings).
**Prevention:** Always enforce `maxLength` on UI inputs AND implement truncation logic in the state management layer (e.g., Zustand store) to ensure data integrity even if UI constraints are bypassed.

## 2025-05-16 - [Bulk Import Validation Gap]
**Vulnerability:** Data import function (`importFolders`) bypassed the "Defense in Depth" input validation patterns applied to single-item UI actions.
**Learning:** Security patterns like input truncation and property filtering must be applied at the state management level for ALL entry points. A secure UI doesn't guarantee a secure state if bulk operations (like JSON imports) skip the same checks.
**Prevention:** Implement a central sanitization helper or ensure that bulk processing logic (e.g., recursive import) explicitly maps to allowed types and enforces constraints like `maxLength` consistently with the rest of the application.

## 2025-05-17 - [URL-based XSS Prevention]
**Vulnerability:** Malicious URLs (`javascript:`) could be injected via data import or external APIs and executed via `window.open` or image `src`.
**Learning:** Whitelisting protocols (http, https, data:image/) is more robust than blacklisting `javascript:`. Centralizing this logic ensures consistency across manual and bulk entry points.
**Prevention:** Use a dedicated sanitization utility (e.g., `sanitizeUrl`) for all URL fields before they reach the state store.

## 2025-05-18 - [Secure OAuth State & Randomness]
**Vulnerability:** Use of insecure `Math.random()` for OAuth PKCE verifiers and lack of `state` parameter in Spotify auth flow.
**Learning:** OAuth 2.0 flows, even with PKCE, should always use a `state` parameter to prevent CSRF attacks. Cryptographically secure random number generators (CSPRNG) like `crypto.getRandomValues()` are mandatory for any security-sensitive value (verifiers, states, IDs).
**Prevention:** Always implement the `state` parameter in OAuth flows and verify it in the callback. Use `crypto.getRandomValues()` instead of `Math.random()` for any value that must be unpredictable.

## 2026-02-07 - [Centralized Sanitization for External Data]
**Vulnerability:** Inconsistent and missing input sanitization for Album data across search results and state management.
**Learning:** Fragmented sanitization logic (e.g., sanitizing in the store but not in the search service) creates windows where unsanitized data is rendered in the UI. Early sanitization at the edge (API service) combined with defense-in-depth sanitization at the state level ensures safety.
**Prevention:** Implement a centralized sanitization utility (e.g., `sanitizeAlbum`) that handles all fields (URLs and text) and apply it at every entry point where untrusted data is converted into application objects.

## 2026-02-15 - [SVG-based XSS in Data URLs]
**Vulnerability:** Allowing all `data:image/*` types in the sanitization layer included `image/svg+xml`, which can embed executable scripts.
**Learning:** Even if images are primarily used in `<img>` tags (where scripts are blocked), allowing SVG data URLs provides an XSS vector if those URLs are ever used in other contexts (e.g., `background-image`, `window.open`, or if the user saves/opens the image).
**Prevention:** Explicitly disallow `svg+xml` in the image sanitization layer if only bitmap images (JPG, PNG, WebP) are expected.

## 2026-02-20 - [Case-Insensitive Bypass for Data URLs]
**Vulnerability:** Case-sensitive string checks for `data:` protocol and `image/svg+xml` MIME type allowed bypasses via uppercase letters (e.g., `data:image/SVG+XML`).
**Learning:** Security filters based on URL schemes or MIME types must be case-insensitive, as per RFC 2397 and standard browser behavior. Relying on `startsWith()` with a lowercase string is insufficient for security validation of untrusted input.
**Prevention:** Always normalize untrusted URLs or MIME types to lowercase before performing prefix or inclusion checks, while ensuring the original payload is preserved if it is case-sensitive (like base64 data).

## 2026-02-25 - [Percent-Encoding Bypass in Data URLs]
**Vulnerability:** Sanitization logic for `data:` URLs could be bypassed using percent-encoding in the MIME type (e.g., `data:image/svg%2Bxml`).
**Learning:** Browsers may decode percent-encoded MIME types in `data:` URLs. Security checks that rely on simple string matching or `startsWith` against the raw URL can be bypassed if they don't account for this decoding.
**Prevention:** Always decode the MIME/metadata part of a `data:` URL using `decodeURIComponent` before performing security checks like blocking `svg+xml`. Similarly, be cautious of protocol-relative URLs (`//`) which can sometimes bypass relative-path filters if not explicitly handled.

## 2026-03-01 - [URL-based Open Redirect & DoS hardening]
**Vulnerability:** `sanitizeUrl` was vulnerable to protocol-relative bypasses via percent-encoded characters or internal whitespace. `sanitizeImageUrl` allowed 1MB data URLs, posing a storage exhaustion risk.
**Learning:** Defense-in-depth requires sanitization to be resilient against browser normalization quirks. Stripping internal whitespace and blocking encoded variants of slashes/backslashes at the start of relative paths prevents common open redirect bypasses.
**Prevention:** Always strip/reject control characters and internal whitespace from URLs before validation. Implement strict size limits on data URLs when stored in `localStorage` to prevent storage DoS.

## 2026-03-05 - [Relative Path Bypass in Sanitization]
**Vulnerability:** `sanitizeUrl` was over-permissive with relative paths (starting with `./` or `../`), allowing dangerous content like `javascript:` or backslash bypasses.
**Learning:** Checking for the *start* of a string is insufficient for security validation if the remainder of the string is not constrained. A relative path should not contain characters like `:` (which indicates a protocol) or `\` (which browsers often normalize to `/` and can lead to protocol-relative bypasses).
**Prevention:** When allowing relative paths, explicitly reject any input containing colons or backslashes. This ensures that a relative path remains a simple path and cannot be coerced into an absolute or protocol-relative URL.

## 2026-03-05 - [JSONP Domain Whitelisting]
**Vulnerability:** The `jsonp` utility allowed loading scripts from any URL provided, posing a massive XSS risk if the URL was ever influenced by external data.
**Learning:** JSONP is an inherently dangerous pattern as it executes remote code. Even if currently used with hardcoded URLs, utilities like this should have "defense-in-depth" protections such as a domain whitelist to prevent future misuse or exploitation.
**Prevention:** Implement a strict whitelist of trusted hostnames for all JSONP requests. Validate the hostname using the `URL` constructor before creating or appending any `<script>` tags to the document.

## 2026-03-10 - [State Injection & Type Safety Gap]
**Vulnerability:** Application state (Theme, ViewMode, StreamingProvider) was updated from untrusted sources (JSON imports, storage) without runtime validation, relying solely on TypeScript types.
**Learning:** TypeScript provides compile-time safety, but runtime security requires explicit validation of data entering the application state from external boundaries. Unvalidated state can lead to class injection (in ThemeHandler) or logical bypasses.
**Prevention:** Define runtime constants (allowlists) for all enumerated types and implement strict validation helpers. Enforce these validations at every entry point: individual setters, bulk import functions, and state hydration logic.

## 2026-03-15 - [CSP for Static Exports]
**Vulnerability:** Lack of Content Security Policy (CSP) left the application vulnerable to XSS and unauthorized data exfiltration.
**Learning:** For static Next.js exports, a `<meta http-equiv="Content-Security-Policy">` tag is the primary defense. It must carefully whitelist all external domains for scripts (especially JSONP), images, and API connections to prevent breakage while maintaining a restrictive posture.
**Prevention:** Implement a restrictive CSP meta tag and verify it against all supported streaming providers. Ensure `script-src` and `connect-src` cover all API domains, and `img-src` covers all CDN domains used for album covers (e.g., `dzcdn.net`, `mzstatic.com`).

## 2026-03-20 - [Insecure Mixed Content Protocol Bypasses]
**Vulnerability:** Allowing `http:` in `sanitizeUrl` permitted the use of insecure external resources (images/links), exposing users to potential man-in-the-middle attacks.
**Learning:** Hardening protocol whitelists to `https:` is a simple but effective defense-in-depth measure. While most modern APIs use HTTPS, explicitly enforcing it in the application's sanitization layer prevents accidental or malicious fallback to insecure protocols.
**Prevention:** Only allow `https:` and safe relative paths in `sanitizeUrl` by default.

## 2025-05-20 - [Defense in Depth: State Hydration Validation]
**Vulnerability:** Application state (Theme, StreamingProvider) hydrated from untrusted localStorage without validation.
**Learning:** Persisted state in local-first applications is an attack vector if a user is tricked into modifying localStorage or if an XSS exists elsewhere. Relying on setters is insufficient for security if hydration skips those checks.
**Prevention:** Always implement validation logic in the store's hydration hook (e.g., Zustand's onRehydrateStorage) to ensure data integrity on startup.

## 2026-03-25 - [Query Truncation Gap in Cached Search]
**Vulnerability:** Search queries were truncated for cache keys but the original un-truncated query was passed to search functions, bypassing DoS protections.
**Learning:** Validation wrappers must ensure that only the validated/transformed data is passed to downstream functions. Partial validation (e.g. for cache keys only) leaves internal systems or external APIs exposed to oversized inputs.
**Prevention:** Always pass the sanitized/truncated version of inputs to downstream functions within wrappers or middlewares.

## 2026-03-30 - [Asymmetric State Hardening]
**Vulnerability:** Core application state (selected IDs, token metadata) was validated in setters but skipped during hydration from localStorage.
**Learning:** Hardening setters provides runtime safety but leaves the application vulnerable to "time-of-check to time-of-use" style attacks where malicious state is injected directly into storage. Validation must be symmetric across the entire lifecycle: from initial set, to persistence, to rehydration.
**Prevention:** Implement strict type and length validation in the store's hydration hook () for ALL persisted fields, not just the complex ones like folder trees. Use explicit  and  checks to prevent coercion-based logic bypasses.

## 2026-03-30 - [Asymmetric State Hardening]
**Vulnerability:** Core application state (selected IDs, token metadata) was validated in setters but skipped during hydration from localStorage.
**Learning:** Hardening setters provides runtime safety but leaves the application vulnerable to "time-of-check to time-of-use" style attacks where malicious state is injected directly into storage. Validation must be symmetric across the entire lifecycle: from initial set, to persistence, to rehydration.
**Prevention:** Implement strict type and length validation in the store's hydration hook (`onRehydrateStorage`) for ALL persisted fields, not just the complex ones like folder trees. Use explicit `typeof` and `Number.isFinite` checks to prevent coercion-based logic bypasses.

## 2026-04-05 - [Recursive State DoS and Truncation Order]
**Vulnerability:** Recursive tree structures (folders) and large search queries could be used for Client-side DoS.
**Learning:** Defense-in-depth requires explicit depth limits for recursive data structures entering the state (rehydration or import). For input validation, the order of operations matters: always slice/truncate BEFORE performing expensive operations like `trim()` or `toLowerCase()` on untrusted strings to minimize processing time for malicious payloads.
**Prevention:** Implement `MAX_FOLDER_DEPTH` and item limits in recursive sanitization helpers. In search/input wrappers, enforce length limits as the very first step of processing.

## 2026-04-10 - [URL-encoded Bypass & Global State DoS]
**Vulnerability:** `sanitizeUrl` could be bypassed via URL-encoded control characters or colons in relative paths. Recursive sanitization lacked a global item limit, allowing large imports to crash the application.
**Learning:** Browsers may interpret URL-encoded control characters (like `%0A`) in ways that bypass simple regex checks for literal characters. Similarly, enforcing per-folder limits is insufficient if the total number of items across all folders remains unbounded.
**Prevention:** Explicitly block encoded control characters (`%(0[0-9A-F]|1[0-9A-F]|7F)`) and encoded dangerous delimiters like `%3A` in sanitization logic. Implement a shared context object in recursive sanitization helpers to enforce a `MAX_TOTAL_ALBUMS` limit across the entire tree.

## 2026-04-15 - [JSONP Security Drift & Centralization]
**Vulnerability:** `hydration-service.ts` contained an insecure, local implementation of `jsonp` (missing domain whitelist and CSPRNG) despite the vulnerability being previously fixed in `search-service.ts`.
**Learning:** Fragmented implementations of sensitive utilities (like JSONP or sanitizers) lead to "security drift" where fixes in one area are not propagated to others. Circular dependency concerns often drive this fragmentation but should be resolved via centralization rather than duplication.
**Prevention:** Centralize sensitive security constants (like trusted domains) and validators in a dedicated `security.ts` layer. Ensure all services consuming untrusted data use these centralized primitives to maintain a consistent security posture across the application.

## 2025-02-26 - [DoS via Recursive Data Structure]
**Vulnerability:** Maliciously crafted deep or wide folder trees could bypass local limits because limits were enforced per-root-folder rather than globally across the entire structure, leading to potential browser hang or memory exhaustion.
**Learning:** When using recursion to sanitize data that can contain multiple root nodes (like a shared shelf), a shared context object MUST be used to track cumulative counts across all branches.
**Prevention:** Implement a standardized entry point like `sanitizeFolderTree` that initializes a shared context and enforces limits before calling recursive sanitizers on root nodes. Use loops or `filter` with stateful checks to break out of processing once global limits are reached.
