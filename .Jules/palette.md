## 2025-05-15 - [Accessible Search Combobox Pattern]
**Learning:** Implementing keyboard navigation in a search dropdown requires more than just listening for arrow keys; it requires a full ARIA combobox pattern (aria-expanded, aria-controls, aria-activedescendant) to be truly accessible to screen readers.
**Action:** Always use the standard ARIA combobox attributes when building search-with-results components to ensure screen readers announce selections correctly.

## 2025-05-16 - [Action Feedback and Input Management]
**Learning:** In highly interactive components like search-and-add, user confidence is significantly boosted by two simple touches: a one-click reset for the search input (Clear button) and immediate, high-contrast feedback for destructive or additive actions (Toast notifications).
**Action:** Always include a clear button for search inputs and use success/error toasts to confirm background state changes that might not be immediately obvious in the primary UI.

## 2026-02-05 - [Accessibility Standards for Icon-Only Buttons]
**Learning:** Icon-only buttons (like expansion toggles or inline action buttons) are completely inaccessible to screen readers without ARIA labels, and confusing for sighted users without tooltips. Combining `aria-label` with the `title` attribute provides a baseline of accessibility and usability.
**Action:** All icon-only interactive elements must have a descriptive `aria-label` and a matching `title` attribute for tooltips.

## 2025-05-20 - [Native Tooltips for Icon-Only Buttons]
**Learning:** While ARIA labels are essential for screen readers, sighted users often benefit from the immediate visual context provided by hover tooltips. Using the native `title` attribute in conjunction with `aria-label` provides a lightweight, dependency-free way to improve discovery for icon-only interactive elements.
**Action:** Consistently apply both `aria-label` and a matching `title` attribute to all icon-only buttons to ensure they are both accessible and intuitive.
