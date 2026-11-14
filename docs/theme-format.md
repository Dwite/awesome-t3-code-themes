# The T3 Code theme format

A theme is one JSON file in the themes folder of a machine: `~/.t3/userdata/themes/<id>.json` (Windows: `%USERPROFILE%\.t3\userdata\themes\<id>.json`). The id is lower-case letters, digits and hyphens, at most 48 characters, and not `system`, `light` or `dark`. T3 Code watches the folder. A new file shows up as a theme, and a change to the active theme's file shows at once.

This page describes T3 Code Nightly as of November 2026, from its theme guide and from tests. T3 Code can change these rules.

## The file

```json
{
  "version": 1,
  "name": "My Theme",
  "appearance": "dark",
  "canvas": "#06141a",
  "accent": "#5ee0c8",
  "colors": { "messageAction": "#5ee0c8" },
  "variants": { "light": { "canvas": "#e7f7f1", "accent": "#1f8f86" } },
  "css": ".dark [data-workspace-area=\"conversation\"]{...}"
}
```

| Field | Rule |
|---|---|
| `version` | `1` |
| `name` | 1 to 48 characters. A longer name makes T3 Code drop the file. |
| `appearance` | `"dark"` or `"light"`: the mode the theme is made for. |
| `canvas`, `accent` | `"#rgb"` or `"#rrggbb"`. T3 Code derives a full palette from these two. Without them, `colors` is the palette. |
| `colors` | Optional. Single colour roles. Each value is a literal CSS colour of at most 64 characters: `"#rrggbb"`, `"#rrggbbaa"`, `"oklch(0.6 0.1 200)"` and so on. Not `var(...)`. |
| `variants` | Optional. `light` and `dark`: colour roles for the other mode. Each is a flat map of role to colour, the same shape as `colors`. `canvas` and `accent` are roles too. |
| `css` | Optional. At most 20,000 characters. Applied after the app's own styles. |

The whole file is at most 32,768 bytes.

**T3 Code drops a file that breaks these rules and gives no message.** The theme is then missing from the list. A nested object where a colour belongs (for example `variants.light.colors`) is enough. Run `node tools/validate.mjs` to find such mistakes.

## Two ways into T3 Code, two shapes

The file above is the shape for the **themes folder**. T3 Code also imports a theme in its settings (Themes, Import theme), and the community gallery [t3themes.com](https://t3themes.com) uses that import shape. They differ:

| | Themes folder (this repository) | Import in settings, and the gallery |
|---|---|---|
| `id` | the file name | an `id` field (optional; made from the name) |
| `canvas`, `accent` | top-level fields; T3 Code derives the other roles from them | roles inside `colors`; nothing is derived |
| `colors` | optional | required. A role you leave out takes the default T3 Chat colour |
| `variants` | `light` and `dark` | only the other mode than `appearance` |
| `css` | applied | the gallery keeps it in the file; a contributor to the gallery reports that T3 Code applies it on import. Not tested here |

To publish a themes-folder theme in the gallery, give `colors` every role. T3 Code's own `createVividThemeColors` (in its `themePalette.ts`) makes the full set from a canvas and an accent. The import shape is read from the T3 Code source that the gallery keeps a copy of, as of 2026-11-14.

## Colour roles

canvas, chrome, toolbar, toolbarForeground, toolbarBorder, toolbarControl, toolbarControlForeground, toolbarControlHover, surface, surfaceRaised, surfaceOverlay, text, textMuted, border, input, focus, accent, accentForeground, secondary, secondaryForeground, muted, mutedForeground, placeholder, secondaryLabel, iconMuted, error, errorForeground, errorSurface, warning, warningForeground, warningSurface, update, updateForeground, updateSurface, accentSurface, accentSurfaceForeground, messageSurface, messageForeground, messageAction, messageActionForeground, messageActionHover, codeBackground, codeForeground, searchMatchBackground, searchMatchForeground, searchMatchActiveBackground, searchMatchActiveForeground, sidebar, sidebarForeground, sidebarMutedForeground, sidebarControlSurface, sidebarRowHover, sidebarRowActive, sidebarRowSelected, sidebarBorder, terminalBackground, terminalForeground, terminalCursor, terminalSelection, terminalScrollbar, terminalScrollbarHover.

Prefer colours over CSS. Colours reach places that CSS cannot, such as the terminal and the file tree.

## CSS

Use `.dark` or `:root:not(.dark)` to style one mode. If a rule has no effect, add `!important`: the app's own rule can be more specific.

T3 Code checks the CSS and removes every property that could load a file:

- No `@import`, no `image-set()`, no `src()`.
- `url()` only with a `data:` address or a `#id`.
- No backslash anywhere in a value.

An image must be a `data:` address inside the CSS. For an SVG image:

- Wrap the address in double quotes and use single quotes inside the SVG. A double quote inside the address becomes a backslash when the browser reads the rule back, and the property is removed.
- Write `#` as `%23` inside the address.
- A `%` followed by two hex digits is read as an escape. Check that your keyframe percentages and colours do not make one by accident.
- Inside an SVG `<style>`, write `<` as `&lt;`.

### Selectors that stay stable

Other class names change between releases.

| Selector | What it is |
|---|---|
| `[data-slot="sidebar"]`, `[data-slot="sidebar-inner"]` | the app sidebar and its surface |
| `[data-thread-item]` | a thread row in the sidebar |
| `[data-chat-header]` | the chat header |
| `[data-workspace-area="conversation"]` | the chat area, behind the messages |
| `.messages-timeline-scroll` | the chat scroller |
| `[data-timeline-row-kind]` | a chat row, such as `="message"` or `="work"` |
| `[data-message-role="user"]`, `[data-message-role="assistant"]` | message rows |
| `[data-user-message-bubble]` | the user message bubble |
| `.chat-markdown`, `.chat-markdown-codeblock` | assistant text and code blocks |
| `[data-chat-composer-form]`, `[data-slot="composer-host"]`, `.composer-tiptap` | the composer, its card, its text |
| `[data-slot="button"]`, `[data-slot="input"]`, `[data-slot="switch"]`, `[data-slot="select-trigger"]` | controls |
| `[data-slot="dialog-popup"]`, `[data-slot="popover-popup"]`, `[data-slot="menu-popup"]`, `[data-slot="tooltip-popup"]` | overlays |
| `[data-slot="scroll-area-scrollbar"]`, `[data-slot="scroll-area-thumb"]` | overlay scrollbars |
| `svg.lucide` | icons; `stroke-width`, `stroke-linecap` and `stroke-linejoin` restyle them |

The stop button of the composer is `[data-chat-composer-form] button[aria-label^="Stop"]`.

## Animated backgrounds

A theme has no script. Motion comes from CSS animation, most easily inside an SVG image used as the background of `[data-workspace-area="conversation"]::before`.

What we measured while building [Koi Pond](../themes/koi-pond) (one Mac, T3 Code Nightly, share of one CPU core):

- Any running animation costs something: a still theme used about 5% of a core in the window process, a pond with 3 koi about 10%. Each further koi (8 animated parts) added about 0.5%.
- Animate standard properties (`offset-distance`, `transform`, `translate`, `opacity`). Animating registered custom properties (`@property`) on many elements forced a full style pass for each of them on each frame: 61% against 17% for the same picture.
- Each animated element costs. Fewer, larger parts are cheaper than many small ones.
- Use `steps()` and make every duration and delay a whole number of ticks. Then the image repaints once per tick and not on every frame.
- An SVG image follows `prefers-color-scheme` from the `color-scheme` of the element it is on. Set `color-scheme: dark` or `light` on the element per mode, and one image can serve both modes.
- `filter: url("data:image/svg+xml,<svg ...><filter id='p'>...</filter></svg>#p")` works on the element. A filter that samples one pixel per cell turns smooth vector art into pixel art on a fixed grid.
- Stop the motion under `@media (prefers-reduced-motion: reduce)`.
