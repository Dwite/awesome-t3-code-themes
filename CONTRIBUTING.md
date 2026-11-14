# Contributing

## Add a theme

1. Make a folder `themes/<id>/`. The id is lower-case letters, digits and hyphens. It is also the file name the theme gets in T3 Code.
2. Put these files in it:
   - `theme.json`: the theme file. See [the theme format](docs/theme-format.md).
   - `README.md`: what the theme is, and anything a user must know (for example the CPU cost of an animated theme).
   - `preview.png`: make it with `node tools/preview.mjs <id>`. For a theme with a light mode, also add `preview-light.png` with `--light`.
   - Optional: the source of the theme (a generator, a settings page), if the theme file is built.
3. Add a row for the theme to the table in the top `README.md`.
4. Run the checks:
   - `node tools/validate.mjs`
   - `node tools/preview.mjs <id> --check`
5. Open a pull request.

## Rules for a theme

- It is your own work, or you have the right to publish it under the MIT license.
- It passes `node tools/validate.mjs`. T3 Code drops a theme file that breaks its rules, and gives no message.
- Text stays readable. Look at your `preview.png`: chat text, code blocks and the composer must be easy to read.
- An animated theme stops its motion under `prefers-reduced-motion: reduce`, and its README says what it costs in CPU if you measured it.
- No tracking and no remote files. T3 Code refuses remote files in theme CSS in any case.

## Add a link

To add a theme or a gallery that lives in another repository, add one line to "Themes elsewhere" in the top `README.md`: the link and a few words on what it is.

## Change the tools

The tools in `tools/` use Node 22 or later and no packages. Keep it that way. Run `node tools/validate.mjs` and, for Koi Pond, `node themes/koi-pond/test/check.mjs` before a pull request.
