# Contributing

## Add a theme

1. Make a folder `themes/<id>/`. The id is lower-case letters, digits and hyphens. It is also the file name the theme gets in T3 Code.
2. Put these files in it:
   - `theme.json`: the theme file. See [the theme format](docs/theme-format.md).
   - `meta.json`: what the catalog shows. `author` is your GitHub user name, `description` is 20 to 200 characters, `tags` are up to 5 words such as `animated`, and `links` are optional extra buttons.

     ```json
     { "author": "octocat", "description": "Neon magenta on deep violet, with a hot-pink accent.", "tags": ["neon"] }
     ```
   - `README.md`: what the theme is, and anything a user must know (for example the CPU cost of an animated theme).
   - `preview.png`: make it with `node tools/preview.mjs <id>`. For a theme with a light mode, also add `preview-light.png` with `--light`.
   - Optional: the source of the theme (a generator, a settings page), if the theme file is built.
3. Run `node tools/catalog.mjs`. It puts the theme into `catalog.json` (the [catalog page](https://dwite.github.io/awesome-t3-code-themes/) reads it) and into the table in the top `README.md`.
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

## Import a theme from another repository

Only when its license allows it (for example MIT). A repository with no license cannot be imported; add a link instead.

1. Put the source's license text at `third-party/<owner>-<repo>/LICENSE` (and its `NOTICE`, if it has one). Add a row to `third-party/README.md`.
2. Run `node tools/import.mjs` with the theme file, the author, the repository, the commit and the license. The top of `tools/import.mjs` shows the arguments. It writes the theme folder with the credit.
3. Run `node tools/preview.mjs <id>` (and `--mode` for its other mode), then `node tools/catalog.mjs` and the checks.

## Add a link

To add a theme or a gallery that lives in another repository, add an entry to `elsewhere.json` (`name`, `repo` or `url`, `kind`: theme, collection, gallery or tool, and a short `description`). Then run `node tools/catalog.mjs`.

## Change the tools

The tools in `tools/` use Node 22 or later and no packages. Keep it that way. Run `node tools/validate.mjs`, `node tools/test/catalog-page.mjs` and, for Koi Pond, `node themes/koi-pond/test/check.mjs` before a pull request.
