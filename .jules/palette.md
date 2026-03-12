## 2025-05-14 - [Confirmation Dialog for Destructive Actions]
**Learning:** In a local-first application where data is stored in localStorage, accidental deletion is a high-risk event because there is no easy server-side restore. Adding a confirmation dialog for folder deletion is a critical UX safeguard that aligns with the "Palette" philosophy of making interaction feel smooth and safe.
**Action:** Always implement confirmation steps or "undo" patterns for destructive actions in local-first apps to maintain user trust and prevent data loss.

## 2025-05-15 - [Empty State CTAs for Better Onboarding]
**Learning:** In a minimalist or technical UI (like the "Industrial" theme), empty states can easily feel like "dead ends" if they only contain static text. Adding a prominent, themed CTA button (e.g., using a dashed border for a "placeholder" look) significantly improves the onboarding experience and makes the next logical step unambiguous.
**Action:** Always accompany empty state messages with a direct call-to-action button that triggers the primary intended interaction for that view.

## 2026-02-11 - [Album Removal Safeguards]
**Learning:** Destructive actions on individual items (like albums) require the same level of protection as larger entities (like folders) in a local-first application. Users expect consistent safety patterns across the UI.
**Action:** Apply the confirmation dialog + toast feedback pattern consistently to all destructive actions, regardless of the item's perceived "size" in the hierarchy.

## 2025-05-16 - [Search Result Hover Affordance]
**Learning:** Providing visual affordance for primary actions in a search list (like adding an item) is critical for discoverability. Using a 'Plus' icon on hover for non-added items, and an 'X' on hover for added items (replacing a 'Check' mark), creates a consistent and intuitive interaction pattern.
**Action:** Always ensure interactive list items have clear hover states that signal their primary affordance, while maintaining accessibility via ARIA labels on the container.

## 2026-05-20 - [Character Counters and Double-Click Shortcuts]
**Learning:** Combining intuitive shortcuts (double-click to rename) with real-time feedback (character counters) enhances both power-user efficiency and general accessibility. When implementing counters, using `aria-describedby` ensures screen reader compatibility, while slightly larger font sizes and higher contrast maintain legibility in technical UIs.
**Action:** Always link character counters to their inputs using ARIA attributes and ensure they meet minimum contrast requirements even in minimalist themes.

## 2025-05-21 - [Keyboard Shortcut Hints and Power-User Patterns]
**Learning:** Introducing global keyboard shortcuts (e.g., 'S' for Settings, 'T' for Theme) significantly enhances power-user efficiency. Visually communicating these shortcuts via bracketed hints in labels and tooltips (e.g., 'Settings [S]') improves discoverability while ensuring they don't trigger during text input.
**Action:** Accompany global keyboard shortcuts with visual bracketed hints in labels and titles, and ensure they are guarded against active input elements and modifier keys.

## 2026-02-19 - [Keyboard Shortcuts for Primary Actions]
**Learning:** Adding global keyboard shortcuts for primary actions (like 'N' for new collection) significantly improves power-user efficiency. Ensuring these shortcuts don't fire when focus is on INPUT, TEXTAREA, or SELECT elements is critical for a frustration-free experience.
**Action:** Always accompany primary action buttons with keyboard shortcuts, visual bracketed hints, and robust input-focus guards.

## 2026-05-22 - [Refining Search Accessibility with Live Regions]
**Learning:** For dynamic search interfaces, adding `aria-keyshortcuts` to inputs improves discoverability of existing global listeners. However, informing the user of the result count is best handled via `aria-live="polite"` on the results message rather than linking hidden counters. Redundant shortcuts (like 'Enter' on listbox options) should be avoided to stay clean and follow standard ARIA expectations.
**Action:** Use `aria-live="polite"` for dynamic status messages and ensure `aria-keyshortcuts` attributes accurately reflect active global listeners while avoiding redundancy with role-default behaviors.

## 2025-05-23 - [Feedback for File Export Actions]
**Learning:** Actions that trigger background browser processes (like file downloads) often lack immediate UI feedback, leaving users unsure if the action succeeded. Momentarily transforming the button into a success state (e.g., "Data Exported!") provides clear confirmation and improves the perceived reliability of the interface.
**Action:** Always provide momentary visual and textual feedback for actions that trigger file downloads or other non-UI browser events.

## 2025-05-24 - [Formatting Bracketed Shortcut Hints]
**Learning:** When using single-character bracket keys (like '[' or ']') as shortcuts, the standard bracketed hint format (e.g., '[[]') can be visually confusing and cluttered. Using parentheses for these specific hints (e.g., '([)' and '])') improves clarity and maintains the technical aesthetic without sacrificing discoverability.
**Action:** Use parentheses for shortcut hints involving bracket keys, while maintaining standard square brackets for all other keyboard shortcuts.

## 2026-05-25 - [Accessibility and Metadata in Tracklists]
**Learning:** Using semantic `<button>` elements for list items (like tracks in a tracklist) ensures they are keyboard-focusable and correctly identified by assistive technologies. Pairing these with `aria-live="polite"` on the global player status ensures that track changes (especially automatic ones) are communicated clearly to screen reader users. Additionally, providing track durations in a concise `font-mono` format adds professional metadata polish without cluttering the "industrial" UI.
**Action:** Always use semantic interactive elements with descriptive ARIA labels for list items, and use `aria-live` regions for any background state changes that impact the user's focus or context.

## 2026-05-26 - [Volume Control Accessibility and Safety]
**Learning:** For continuous-value controls like volume sliders, providing both granular visual feedback (percentage in tooltips) and semantic feedback (`aria-valuetext`) ensures a consistent experience for all users. Furthermore, when implementing keyboard shortcuts for these controls, explicit clamping and rounding (e.g., to 1 decimal place) are essential to prevent floating-point precision issues and potential runtime errors from out-of-bounds values.
**Action:** Always pair sliders with human-readable ARIA values and tooltips, and ensure all incremental adjustment logic includes robust clamping and rounding.

## 2026-05-27 - [Closure Feedback for Spatial Actions]
**Learning:** While drag-and-drop interactions provide transient visual feedback (like drop targets), the completion of the action (the "drop") can sometimes feel ambiguous in complex trees or large grids. Providing a success toast upon a successful move or reorder provides critical interaction closure, confirming the system has processed the change and explicitly stating the new state (e.g., where an item was moved).
**Action:** Always provide explicit textual feedback (like toasts) for spatial reordering and movement actions to provide a clear sense of closure and system confirmation.
