## 2025-05-14 - [Zustand Over-subscription and Structural Sharing]
**Learning:** Subscribing to the entire `folders` tree in components like `AlbumGrid` or `AlbumSearch` causes them to re-render whenever ANY folder is modified. However, because the store uses structural sharing, only the modified branch gets a new reference. Using granular selectors that find the specific selected folder website Zustand to skip re-renders if that folder's reference (and its path from root) hasn't changed.
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

## 2026-03-20 - [Deferring Global Store Updates for Canvas Dragging]
**Learning:** High-frequency updates to a persisted global store (like album positions on a canvas during drag) trigger expensive side effects: structural sharing recalculations across the tree, serialization for persistence (localStorage), and re-renders in distant, unrelated components. Using local component state for the transient drag position and only committing to the global store on drag end eliminates this overhead while preserving data consistency.
**Action:** Use local state or refs for high-frequency transient UI state (dragging, resizing, etc.) and only sync with the global store on interaction completion. Ensure visibility logic (like viewport culling) accounts for this temporary state.

## 2026-03-25 - [Conditional Store Subscriptions and Handler Stability]
**Learning:** Components that are always mounted but conditionally visible (like a global search bar) still trigger expensive re-renders on every store update if they subscribe to large data structures. Returning `undefined` from the Zustand selector when the component is closed (`!isOpen`) prevents these re-renders. Additionally, making event handlers truly stable by using `getState()` inside them allows `React.memo` child components to skip re-renders entirely when the parent's state changes.
**Action:** Use local visibility state (`isOpen`) within Zustand selectors to prune subscriptions when hidden. Always prefer stable handler references (`[]` dependency array) by using `getState()` for interaction-only data.

## 2026-04-10 - [Reducing Search Input Re-rendering Overhead]
**Learning:** In components with high-frequency state updates (like a search input's `query`), the entire render tree reconciles on every keystroke. Mapping over search results and performing string operations (like key concatenation and case normalization) for each item adds measurable overhead. Extracting the results list into a memoized component and pre-calculating match keys when results arrive eliminates this redundancy. Additionally, using a `Set` for membership checks is more efficient than a `Map` when only existence is needed.
**Action:** Extract large list maps into memoized sub-components. Pre-calculate search metadata using `useMemo` to keep the render loop lean. Prefer `Set` for O(1) existence checks.

## 2026-04-15 - [Eliminating Redundant Re-renders in Static Dialogs]
**Learning:** Components that are always mounted (like global settings dialogs) but subscribe to large, frequently-changing state slices (like the entire `folders` tree) suffer from constant redundant re-renders even when the dialog is closed. Accessing these large slices ONLY inside event handlers via `getState()` eliminates the subscription entirely. Combining this with `React.memo` and `useShallow` for the remaining small reactive pieces ensures the component only reconciles when absolutely necessary.
**Action:** For always-mounted components, use `getState()` for data needed only in callbacks. Use `React.memo` and `useShallow` to prune reactive updates.

## 2026-04-20 - [Optimizing Canvas Panning with Stable Handlers and Memoization]
**Learning:** In interactive canvas views, updating screen-space positions during pan/zoom triggers re-renders of the entire item list. While `AlbumCard` might be memoized, the parent container's reconciliation still happens every frame. Extracting the item wrapper into a `memo` component and using truly stable event handlers (stabilized by `useRef` or by pruning dependencies from `useCallback`) allows React to skip reconciliation for almost all items during high-frequency movement.
**Action:** Use memoized item wrappers in lists/grids. Stabilize handlers by accessing state via `ref` or `getState()` to avoid dependency changes.

## 2025-05-28 - [Early-Exit Tree Traversal and Recursive Breadcrumb Caching]
**Learning:** Standard `map`-based tree updates always visit every node in a level even if the target has been found. Switching to `for` loops with early returns reduces traversal overhead. Additionally, `getBreadcrumb` benefits from recursive caching; by calling itself recursively, it populates the `WeakMap` cache for stable subtrees, turning O(N) traversals into O(depth) on subsequent state versions.
**Action:** Use `for` loops for single-target tree mutations. Ensure recursive tree lookups call themselves to maximize cache hits across structural sharing updates.

## 2026-03-27 - [Isolating Volatile List Items for Smooth Dragging]
**Learning:** When an item in a large list is being moved or updated at high frequency (e.g., canvas dragging), passing the entire volatile state to the list component forces full reconciliation on every frame. Lifting the active item out of the list and passing only a stable identifier (like `id`) allows the memoized list to completely skip re-rendering during the interaction.
**Action:** Always lift high-frequency volatile items out of stable list components. Render the active/dragged item separately in the parent.

## 2026-05-25 - [Minimizing Re-renders in Large Grids during Drag and Settings Changes]
**Learning:** In large grids, every item subscribing to global settings (like `streamingProvider`) or the parent re-rendering on every drag step causes O(N) reconciliations. Extracting items into memoized components with granular boolean props (`isDropTarget`) and moving global subscriptions into lazy-rendered leaf components (like context menu items) reduces overhead to O(1) or O(Constant) for most updates. Stabilizing handlers with `useCallback` and `getState()` is crucial for this isolation to work.
**Action:** Always lift high-frequency or global subscriptions out of large list items. Use memoized wrappers with minimal boolean props for list items.

## 2026-06-15 - [Breadcrumb Segment Stability and useShallow Effectiveness]
**Learning:** Even with structural sharing and result-level caching, recursive path constructions (like breadcrumbs) can return new object references for segments on every call. This causes `useShallow` to fail shallow equality checks on the resulting array. Using a `WeakMap` to cache the individual segment objects `{ id, name }` keyed by the stable `Folder` object ensures stable references within the array, allowing `useShallow` to correctly skip redundant re-renders.
**Action:** When returning arrays of objects from recursive lookups on immutable trees, cache the individual segment objects using `WeakMap` to preserve reference stability for `useShallow` and `React.memo`.

## 2026-07-20 - [Comprehensive Store Bail-outs and Reference Stability]
**Learning:** Redundant state updates and frequent re-renders occur when store actions (setters and tree mutations) trigger a `set()` call even when the underlying data is unchanged. Implementing strict equality checks (`===`) within all actions and ensuring that recursive tree mutation helpers return the original array reference when no changes occur preserves structural sharing and prevents unnecessary re-renders across the entire application.
**Action:** Always implement 'bail-out' logic in store actions. For scalar values, compare before calling `set()`. For tree mutations, ensure helpers return the original reference if the updater produces no changes, and check this reference before calling `set()`.

## 2026-08-15 - [In-flight Search Request Deduplication]
**Learning:** In highly interactive search interfaces, rapid user input or provider switching can trigger multiple identical network requests before the first one settles. While a debounce helps, it doesn't prevent redundant requests if the network latency is higher than the debounce interval or if the same search is triggered from multiple entry points. Caching the *promise* of the in-flight request in a Map and returning it for identical subsequent calls eliminates this redundancy and ensures only one network call is made per unique query.
**Action:** Implement a `pendingRequests` Map in async service wrappers to deduplicate simultaneous identical operations. Ensure promises are removed in a `finally` block to prevent stale state or memory leaks.

## 2026-09-10 - [Optimizing Sanitization Hot Paths]
**Learning:** `new URL()` is a relatively expensive constructor in both Node.js and browser environments. When sanitizing thousands of items (e.g., during store rehydration), calling it repeatedly for standard `https://` URLs can block the main thread. Implementing a fast-path that validates the prefix and character safety before falling back to the full parser significantly improves startup performance.
**Action:** Use fast-path validation (prefix and character checks) to avoid expensive object constructors or complex regexes in hot paths like sanitization.

## 2024-05-22 - [Eliminating Layout Thrashing in High-Frequency Render Paths]
**Learning:** Accessing DOM properties that trigger layout (like `clientWidth`, `clientHeight`, or `getBoundingClientRect`) inside a `useMemo` or render function causes synchronous layout thrashing when the component re-renders frequently (e.g., during panning or dragging). Moving these measurements into a `ResizeObserver` that updates a local state ensures that dimensions are available during render without forcing the browser to recalculate layout mid-cycle.
**Action:** Use `ResizeObserver` and state to track element dimensions for spatial calculations. Avoid direct DOM measurement calls inside `useMemo` or the component body.
