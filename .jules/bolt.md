## 2025-05-14 - [Zustand Over-subscription and Structural Sharing]
**Learning:** Subscribing to the entire `folders` tree in components like `AlbumGrid` or `AlbumSearch` causes them to re-render whenever ANY folder is modified. However, because the store uses structural sharing, only the modified branch gets a new reference. Using granular selectors that find the specific selected folder allows Zustand to skip re-renders if that folder's reference (and its path from root) hasn't changed.
**Action:** Always use granular selectors and `useShallow` for store subscriptions. Define selectors that return the specific leaf data needed by the component.

## 2025-05-20 - [Optimizing Persisted Stores]
**Learning:** In a persisted Zustand store, every `set()` call triggers a `localStorage` write by default. High-frequency updates (like drag-and-drop state) cause expensive serialization and I/O hits that can lead to main-thread jank, especially with large data trees. Using `partialize` to exclude transient state from the persistence layer eliminates this overhead.
**Action:** Use `partialize` in `persist` middleware to exclude all non-essential or high-frequency transient state from `localStorage`.

## 2026-02-05 - [Avoiding Subscriptions for Event Handlers]
**Learning:** Components subscribing to store values only used in event handlers (e.g., drag state in `FolderItem`, or settings in `AlbumCard`) cause unnecessary re-renders. Accessing these values via `useFolderStore.getState()` inside handlers eliminates the subscription and preserves `React.memo` effectiveness.
**Action:** For state or actions used ONLY in event handlers, use `getState()` instead of `useFolderStore(state => ...)`.

## 2024-05-20 - [Search Result Caching and Image Attributes]
**Learning:** Client-side search for album data is highly repetitive (users often re-type or tweak queries). Caching these results in a simple Map with a TTL dramatically improves perceived responsiveness. Additionally, standard `<img>` attributes like `loading="lazy"` and `decoding="async"` provide easy performance wins for media-heavy grids by reducing main-thread contention.
**Action:** Implement caching for external API calls when data is relatively static. Use `decoding="async"` for all significant images to keep the UI smooth during scroll.

## 2025-05-25 - [Tree Traversal Caching and Subscription Pruning]
**Learning:** Recursive O(N) tree traversals (like `findFolder` and `getBreadcrumb`) in Zustand selectors run on every state change and component re-render. Using a `WeakMap` cache keyed by the immutable `folders` array reference turns these into O(1) lookups for stable state versions. Additionally, subscribing to store actions in components like `FolderTree` is unnecessary; accessing them via `getState()` in handlers eliminates redundant listeners.
**Action:** Use `WeakMap` to cache expensive computations on immutable state trees. Prefer `getState()` for store actions used exclusively in event handlers.

## 2026-02-10 - [Redundant State Updates in High-Frequency Events]
**Learning:** React's `onDragOver` event fires continuously during a drag operation. Triggering `setState` on every firing causes excessive re-renders even if the resulting state value is identical. While React bails out of identical updates at a certain level, checking the value manually before calling the setter avoids the overhead of the reconciliation trigger entirely.
**Action:** Always wrap state updates in high-frequency event handlers (drag, scroll, mousemove) with a check to ensure the value has actually changed.

## 2026-03-10 - [Canvas Rendering and Spatial Visibility]
**Learning:** In a zoomable/pannable canvas, updating the screen-space position (left/top) and transform of every visible item on every frame causes significant React reconciliation and DOM overhead. Applying the camera transform once to a parent "stage" div allows the browser to handle panning/zooming efficiently while keeping children positions stable in world space. Additionally, performing visibility checks in world space by pre-calculating viewport boundaries once per frame avoids redundant O(N) coordinate transformations.
**Action:** Always use a single parent transform for camera movement in canvas views. Perform intersection tests in world space to minimize operations per item.
