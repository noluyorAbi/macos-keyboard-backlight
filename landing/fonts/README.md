# fonts

Optional. The page looks correct without anything in this directory.

The `@font-face` blocks in `styles.css` try, in order:

1. `local("JetBrains Mono")`, a copy already installed on the visitor's machine
2. `fonts/JetBrainsMono-Regular.woff2` and `fonts/JetBrainsMono-Bold.woff2`
3. the platform monospace stack

Step 2 only happens if you put the files here. To do that:

1. Download JetBrains Mono from the official releases page
   (`https://github.com/JetBrains/JetBrainsMono/releases`).
2. Convert or extract the two weights you need to woff2, and name them exactly
   `JetBrainsMono-Regular.woff2` and `JetBrainsMono-Bold.woff2`.
3. Copy `OFL.txt` from the download into this directory. JetBrains Mono is
   licensed under the SIL Open Font License 1.1, which requires the license
   text to travel with the font files.

Two files, regular and bold, are enough for this page. Subsetting to Latin
basic plus punctuation typically cuts each file to well under 30 KB.

Never link a font from a remote host here. The Content Security Policy in
`vercel.json` allows `font-src 'self'` only, and a remote font would both fail
to load and put a third party in the request path of every visitor.
