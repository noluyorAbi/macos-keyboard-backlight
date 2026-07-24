# assets

Drop the rendered files here. The paths are what `content.json` points at.

| File | Size | Where it comes from | Commit it? |
|------|------|---------------------|------------|
| `demo.mp4` | 1920 by 1080 | The sibling Remotion template, `npm run render` | Yes |
| `demo.gif` | downsampled loop of the same recording | The sibling Remotion template | Yes |
| `social-card.png` | exactly 1200 by 630 | Remotion still, or any 1200 by 630 export | Yes |
| `favicon.svg` | 32 by 32 | Shipped with this template, recolor if you like | Yes |
| `banner.png` | 1280 wide or more | Optional, used by the README template, not by this page | Yes |

All of these belong in git. The README and the deployed page both reference
them by path, so a repository without them renders broken images. What does not
belong in git is the Remotion workspace output that produced them: see the
`.gitignore` template in `templates/github`.

Keep `social-card.png` at exactly 1200 by 630. The `og:image:width` and
`og:image:height` tags are hard coded to that size, and several crawlers refuse
a card whose real dimensions disagree with the declared ones.
