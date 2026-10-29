/**
 * Drive Map: a live, read-only tree view of a shared Google Drive folder.
 *
 * Public, sanitized version. All IDs come from Script Properties:
 *   ROOT_FOLDER_ID  - the folder the map starts from (required)
 *   REFRESH_MINUTES - how old the cached tree may get (optional, default 10)
 *
 * Deploy as a web app with "Execute as: User accessing the web app".
 * Each viewer then sees only what their own Google account can open,
 * and the cache is per user (CacheService.getUserCache), so no viewer
 * ever receives another viewer's tree.
 */

const DEFAULT_REFRESH_MINUTES = 10;
const BATCH_SIZE = 15;              // parent folders per Drive API query
const CHUNK_CHARS = 90000;          // CacheService allows ~100 KB per key
const CACHE_TTL_SECONDS = 6 * 60 * 60;

function config_() {
  const props = PropertiesService.getScriptProperties();
  const rootId = props.getProperty('ROOT_FOLDER_ID');
  if (!rootId) throw new Error('Set the ROOT_FOLDER_ID script property first.');
  const minutes = Number(props.getProperty('REFRESH_MINUTES')) || DEFAULT_REFRESH_MINUTES;
  return { rootId: rootId, refreshMs: minutes * 60000 };
}

// ------------------------------------------------------------------ page

function doGet() {
  const page = HtmlService.createTemplateFromFile('Index');
  let data;
  try {
    data = getTree(false);
  } catch (e) {
    data = { error: 'Could not read the folder. Check your access and try again.' };
  }
  // Escape "<" so a file name can never close the <script> tag that embeds the JSON.
  page.bootJson = JSON.stringify(data).replace(/</g, '\\u003c');
  return page.evaluate()
    .setTitle('Drive Map')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Returns the full tree. Uses the per-user cache while it is fresh;
 * force = true rebuilds it now (the "refresh" button).
 */
function getTree(force) {
  const cfg = config_();
  const cache = CacheService.getUserCache();
  const cached = readCache_(cache);
  if (!force && cached && Date.now() - cached.builtAt < cfg.refreshMs) return cached;
  try {
    const fresh = buildTree_(cfg.rootId);
    writeCache_(cache, fresh);
    return fresh;
  } catch (e) {
    if (cached) return cached; // fail soft: show the last good tree
    throw e;
  }
}

// ------------------------------------------------------------------ Drive

/**
 * Breadth-first walk from the root. Each request asks for the children of
 * up to BATCH_SIZE folders at once, which is far faster than opening
 * folders one by one with DriveApp.
 * Item fields: i = id, n = name, t = mimeType, p = parent id, m = modified time.
 */
function buildTree_(rootId) {
  const root = DriveApp.getFolderById(rootId); // throws if the viewer has no access
  const token = ScriptApp.getOAuthToken();
  const items = [];
  const seen = {};
  seen[rootId] = true;
  let queue = [rootId];

  while (queue.length) {
    const next = [];
    for (let k = 0; k < queue.length; k += BATCH_SIZE) {
      const batch = queue.slice(k, k + BATCH_SIZE);
      const q = '(' + batch.map(function (id) { return "'" + id + "' in parents"; }).join(' or ') +
        ') and trashed = false';
      let pageToken = '';
      do {
        const params = [
          'q=' + encodeURIComponent(q),
          'fields=' + encodeURIComponent('nextPageToken,files(id,name,mimeType,parents,modifiedTime)'),
          'pageSize=1000',
          'supportsAllDrives=true',
          'includeItemsFromAllDrives=true'
        ];
        if (pageToken) params.push('pageToken=' + encodeURIComponent(pageToken));
        const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files?' + params.join('&'), {
          headers: { Authorization: 'Bearer ' + token },
          muteHttpExceptions: true
        });
        if (res.getResponseCode() !== 200) {
          throw new Error('Drive API returned ' + res.getResponseCode());
        }
        const body = JSON.parse(res.getContentText());
        (body.files || []).forEach(function (f) {
          if (seen[f.id]) return;
          // Keep only items whose parent is inside the tree we are walking.
          const parent = (f.parents || []).filter(function (p) { return batch.indexOf(p) >= 0; })[0];
          if (!parent) return;
          seen[f.id] = true;
          items.push({ i: f.id, n: f.name, t: f.mimeType, p: parent, m: f.modifiedTime });
          if (f.mimeType === 'application/vnd.google-apps.folder') next.push(f.id);
        });
        pageToken = body.nextPageToken || '';
      } while (pageToken);
    }
    queue = next;
  }
  return { root: { i: rootId, n: root.getName() }, items: items, builtAt: Date.now() };
}

// ------------------------------------------------------------------ cache

function writeCache_(cache, tree) {
  const json = JSON.stringify(tree);
  const parts = {};
  let n = 0;
  for (let k = 0; k < json.length; k += CHUNK_CHARS) {
    parts['tree_' + n] = json.slice(k, k + CHUNK_CHARS);
    n++;
  }
  parts.tree_n = String(n);
  cache.putAll(parts, CACHE_TTL_SECONDS);
}

function readCache_(cache) {
  const n = Number(cache.get('tree_n'));
  if (!n) return null;
  const keys = [];
  for (let k = 0; k < n; k++) keys.push('tree_' + k);
  const got = cache.getAll(keys);
  let json = '';
  for (let k = 0; k < n; k++) {
    if (got['tree_' + k] == null) return null; // a chunk expired: rebuild
    json += got['tree_' + k];
  }
  try { return JSON.parse(json); } catch (e) { return null; }
}
