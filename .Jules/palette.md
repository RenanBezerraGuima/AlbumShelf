## 2025-05-15 - [Accessible Search Combobox Pattern]
**Learning:** Implementing keyboard navigation in a search dropdown requires more than just listening for arrow keys; it requires a full ARIA combobox pattern (aria-expanded, aria-controls, aria-activedescendant) to be truly accessible to screen readers.
**Action:** Always use the standard ARIA combobox attributes when building search-with-results components to ensure screen readers announce selections correctly.
