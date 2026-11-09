# Protocol page

`web/protocol/index.html` is a generated static page for `/protocol/`. GitHub Pages
redirects `/protocol` to that directory. It uses SCI's existing page shell and
the protocol UI introduced in [Sciscape PR #17](https://github.com/azaho/sciscape/pull/17):
the pinned GitHub source link, horizontal dividers, and collapsible nested contents.
No browser JavaScript, runtime Markdown fetch, or frontend build is required.

`README.md` is copied byte-for-byte from the SCI revision in `SOURCE.json`, initially
the same revision as Sciscape's vendored library. This documents the new SCI protocol;
it does not change the legacy publication service's API or formats.

To update the document, use the full SCI commit from Sciscape's
`web/src/vendor/sci/SOURCE.json`:

```sh
node deploy/render_protocol.mjs --update <40-character-sci-commit>
node --test tests/protocol_page.test.mjs
```

The update downloads only that pinned Markdown and records its SHA-256. Review and
commit the source, pin, and generated HTML together. To edit the page shell, change
`docs/protocol/page.html`; protocol-specific styles live in `web/protocol/protocol.css`.
Regenerate offline with `node deploy/render_protocol.mjs`, or verify with `--check`.
The generator reuses the existing vendored Markdown-it and Sciscape's rendering
rules: source HTML is escaped except `<br>`, unsafe links are rejected by Markdown-it,
images are disabled, and contents labels and attributes are escaped.

CI checks the generated page and section targets. Website deployment copies it with
the other static files and verifies that the live page matches the deployed artifact.
