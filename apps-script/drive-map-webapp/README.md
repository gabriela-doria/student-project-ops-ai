# Drive Map web app

A read-only page that shows a shared Drive folder as an expandable tree, with search, file-type tags and links to each item.

**Why it is fast:** instead of opening folders one by one, it asks the Drive API for the children of up to 15 folders per request, then caches the whole tree (split into ~90 KB chunks, since the cache limits each key to 100 KB). The page opens with the tree already embedded.

**Why it is safe to share:** it runs as the person viewing it, so each viewer sees only what their own account can open. The cache is per user. File names are always inserted as text, never as HTML.

## Setup

1. Create an Apps Script project and add `Code.gs`, `Index.html` and `appsscript.json` (show the manifest under Project Settings).
2. Project Settings → Script Properties: add `ROOT_FOLDER_ID` (and optionally `REFRESH_MINUTES`).
3. Deploy → New deployment → Web app. Execute as: *User accessing the web app*. Who has access: *Anyone with a Google account* (the manifest's `ANYONE`). This is needed when members use personal accounts; it is safe because the app runs as the viewer, so it only shows what that viewer can already open. On a Workspace domain, use *Anyone within the domain* instead.
4. Open the URL in a private window to check that it asks for sign-in.
