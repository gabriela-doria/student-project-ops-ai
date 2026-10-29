/**
 * Drive migration toolkit: audit, restructure and re-permission a shared
 * project Drive without losing anything on the way.
 *
 * Public, sanitized version. Requires the Advanced Drive Service (v3).
 * All IDs and e-mail addresses come from Script Properties (see Config.example.gs).
 *
 * Every function that changes something is a dry run by default.
 * It logs exactly what it WOULD do; pass { dryRun: false } to apply.
 * Every function is idempotent: running it twice changes nothing the second time.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

// ------------------------------------------------------------------ config

function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const need = function (k) {
    const v = p.getProperty(k);
    if (!v) throw new Error('Missing script property: ' + k);
    return v;
  };
  return {
    rootId: need('ROOT_FOLDER_ID'),          // the new project root
    activeId: need('ACTIVE_FOLDER_ID'),      // members edit here
    archiveId: need('ARCHIVE_FOLDER_ID'),    // members read here
    restrictedId: need('RESTRICTED_FOLDER_ID'), // coordination only
    projectAccount: need('PROJECT_ACCOUNT_EMAIL'), // the account that should own everything
    rosterSheetId: need('ROSTER_SHEET_ID'),  // one column "email", one row per member
    logFolderId: need('LOG_FOLDER_ID')       // where reports are written
  };
}

// ------------------------------------------------------------------ walking

/** All descendants of a folder, using batched Drive API queries. */
function listTree_(rootId, fields) {
  fields = fields || 'id,name,mimeType,parents,owners(emailAddress)';
  const out = [];
  let queue = [rootId];
  const seen = {};
  while (queue.length) {
    const next = [];
    for (let k = 0; k < queue.length; k += 15) {
      const batch = queue.slice(k, k + 15);
      const q = '(' + batch.map(function (id) { return "'" + id + "' in parents"; }).join(' or ') + ') and trashed = false';
      let pageToken;
      do {
        const res = Drive.Files.list({
          q: q, pageSize: 1000, pageToken: pageToken,
          fields: 'nextPageToken,files(' + fields + ')',
          supportsAllDrives: true, includeItemsFromAllDrives: true
        });
        (res.files || []).forEach(function (f) {
          if (seen[f.id]) return;
          seen[f.id] = true;
          out.push(f);
          if (f.mimeType === FOLDER_MIME) next.push(f.id);
        });
        pageToken = res.nextPageToken;
      } while (pageToken);
    }
    queue = next;
  }
  return out;
}

/** Every permission on an item, following pagination. */
function listPermissions_(itemId) {
  const all = [];
  let pageToken;
  do {
    const res = Drive.Permissions.list(itemId, {
      pageToken: pageToken, pageSize: 100, supportsAllDrives: true,
      fields: 'nextPageToken,permissions(id,type,role,emailAddress,domain,pendingOwner)'
    });
    (res.permissions || []).forEach(function (p) { all.push(p); });
    pageToken = res.nextPageToken;
  } while (pageToken);
  return all;
}

function writeReport_(name, lines) {
  const c = cfg_();
  const stamp = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyyMMdd-HHmm');
  DriveApp.getFolderById(c.logFolderId).createFile(stamp + '_' + name + '.txt', lines.join('\n'));
  Logger.log(lines.join('\n'));
}

// ------------------------------------------------------------------ 1. inventory

/** Inventory of a legacy folder before migrating: path, type and owner of every item. */
function inventory(legacyFolderId) {
  const items = listTree_(legacyFolderId);
  const byId = {};
  items.forEach(function (f) { byId[f.id] = f; });
  const path = function (f) {
    const parts = [f.name];
    let p = (f.parents || [])[0];
    while (p && byId[p]) { parts.unshift(byId[p].name); p = (byId[p].parents || [])[0]; }
    return parts.join(' / ');
  };
  const lines = items.map(function (f) {
    const owner = (f.owners && f.owners[0] && f.owners[0].emailAddress) || '(shared drive)';
    return [f.mimeType === FOLDER_MIME ? 'folder' : 'file', path(f), owner].join(' | ');
  });
  lines.unshift('TOTAL ' + items.length);
  writeReport_('inventory', lines);
}

// ------------------------------------------------------------------ 2. ownership

/** Lists everything under the active and restricted folders that the project account does not own. */
function auditOwnership() {
  const c = cfg_();
  const lines = [];
  [c.activeId, c.restrictedId].forEach(function (rootId) {
    listTree_(rootId).forEach(function (f) {
      const owner = f.owners && f.owners[0] && f.owners[0].emailAddress;
      if (owner && owner !== c.projectAccount) lines.push(owner + ' | ' + f.name + ' | ' + f.id);
    });
  });
  lines.unshift('REMAINING ' + lines.length);
  writeReport_('ownership-audit', lines);
  return lines.length - 1;
}

/**
 * Asks the project account to take ownership of the files the current user owns.
 * On personal Google accounts this creates a pending-owner request that the
 * project account accepts in Drive. Resumable: already-pending items are skipped.
 */
function requestOwnershipTransfer(opts) {
  const dryRun = !(opts && opts.dryRun === false);
  const c = cfg_();
  const me = Session.getActiveUser().getEmail();
  const out = [];
  listTree_(c.activeId).concat(listTree_(c.restrictedId)).forEach(function (f) {
    const owner = f.owners && f.owners[0] && f.owners[0].emailAddress;
    if (owner !== me || f.mimeType === FOLDER_MIME) return;
    const perms = listPermissions_(f.id);
    let target = perms.filter(function (p) { return p.emailAddress === c.projectAccount; })[0];
    if (target && target.pendingOwner) { out.push('already pending | ' + f.name); return; }
    if (dryRun) { out.push('WOULD request | ' + f.name); return; }
    if (!target) {
      target = Drive.Permissions.create({ type: 'user', role: 'writer', emailAddress: c.projectAccount },
        f.id, { sendNotificationEmail: false });
    }
    Drive.Permissions.update({ role: 'writer', pendingOwner: true }, f.id, target.id);
    out.push('requested | ' + f.name);
  });
  writeReport_('ownership-requests' + (dryRun ? '-dryrun' : ''), out);
}

// ------------------------------------------------------------------ 3. permissions

function roster_() {
  const values = SpreadsheetApp.openById(cfg_().rosterSheetId).getSheets()[0].getDataRange().getValues();
  const col = values[0].map(String).indexOf('email');
  if (col < 0) throw new Error('The roster needs a header named "email".');
  return values.slice(1).map(function (r) { return String(r[col]).trim().toLowerCase(); })
    .filter(function (e) { return /@/.test(e); });
}

/** Who can see what at the top folders: one line per folder and permission. */
function diagnosePermissions() {
  const c = cfg_();
  const lines = [];
  [['ROOT', c.rootId], ['ACTIVE', c.activeId], ['ARCHIVE', c.archiveId], ['RESTRICTED', c.restrictedId]]
    .forEach(function (pair) {
      listPermissions_(pair[1]).forEach(function (p) {
        lines.push(pair[0] + ' | ' + p.role + ' | ' + p.type + ' | ' + (p.emailAddress || p.domain || 'anyone'));
      });
    });
  writeReport_('permissions', lines);
}

/**
 * Members edit ACTIVE and read ARCHIVE. RESTRICTED is never touched.
 * No notification e-mails are sent. Re-running only adds what is missing.
 */
function applyPermissions(opts) {
  const dryRun = !(opts && opts.dryRun === false);
  const c = cfg_();
  const members = roster_();
  const out = [];
  // A higher role already covers a lower one, so it is never downgraded or duplicated.
  const RANK = { reader: 1, commenter: 2, writer: 3, fileOrganizer: 4, organizer: 5, owner: 6 };
  [[c.activeId, 'writer', 'ACTIVE'], [c.archiveId, 'reader', 'ARCHIVE']].forEach(function (t) {
    const existing = {};
    listPermissions_(t[0]).forEach(function (p) {
      if (p.emailAddress) existing[p.emailAddress.toLowerCase()] = p.role;
    });
    members.forEach(function (email) {
      if ((RANK[existing[email]] || 0) >= RANK[t[1]]) { out.push('ok        | ' + t[2] + ' | ' + email); return; }
      if (dryRun) { out.push('WOULD add | ' + t[2] + ' | ' + t[1] + ' | ' + email); return; }
      Drive.Permissions.create({ type: 'user', role: t[1], emailAddress: email }, t[0], { sendNotificationEmail: false });
      out.push('added     | ' + t[2] + ' | ' + t[1] + ' | ' + email);
    });
  });
  writeReport_('apply-permissions' + (dryRun ? '-dryrun' : ''), out);
}

// ------------------------------------------------------------------ 4. move and rename

/**
 * Moves items into the new structure and leaves a shortcut at the origin,
 * so old links and habits still lead somewhere.
 * plan: [[itemId, 'Destination/Sub folder', originFolderId], ...], paths relative to ACTIVE.
 * The origin is part of the plan, so a re-run after a timeout can still
 * add a missing shortcut for an item that was already moved.
 */
function moveWithTrail(plan, opts) {
  const dryRun = !(opts && opts.dryRun === false);
  const active = DriveApp.getFolderById(cfg_().activeId);
  const out = [];
  plan.forEach(function (step) {
    const id = step[0], route = step[1], originId = step[2];
    let item, isFolder = false;
    try { item = DriveApp.getFolderById(id); isFolder = true; } catch (e) { item = DriveApp.getFileById(id); }
    const origin = originId ? DriveApp.getFolderById(originId) : null;
    const dest = resolvePath_(active, route, dryRun);
    const parents = item.getParents();
    const current = parents.hasNext() ? parents.next() : null;
    const moved = dest && current && current.getId() === dest.getId();
    const needsShortcut = origin && !hasShortcutTo_(origin, id);
    if (moved && !needsShortcut) { out.push('done already | ' + item.getName()); return; }
    if (dryRun) {
      out.push((moved ? 'WOULD add shortcut | ' : 'WOULD move | ') + item.getName() + ' -> ' + route);
      return;
    }
    if (!moved) item.moveTo(dest);
    if (needsShortcut) DriveApp.createShortcut(id).moveTo(origin);
    out.push('moved | ' + (isFolder ? '[folder] ' : '') + item.getName() + ' -> ' + route +
      (needsShortcut ? ' | shortcut left at origin' : ''));
  });
  writeReport_('move' + (dryRun ? '-dryrun' : ''), out);
}

function hasShortcutTo_(folder, targetId) {
  const it = folder.getFilesByType(SHORTCUT_MIME);
  while (it.hasNext()) if (it.next().getTargetId() === targetId) return true;
  return false;
}

/** Finds or creates each folder along a path. In a dry run nothing is created. */
function resolvePath_(base, route, dryRun) {
  let folder = base;
  route.split('/').filter(String).forEach(function (name) {
    if (!folder) return;
    const it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : (dryRun ? null : folder.createFolder(name));
  });
  return folder;
}

/** plan: [[itemId, 'New name'], ...]. Skips items that already have the new name. */
function renameFromPlan(plan, opts) {
  const dryRun = !(opts && opts.dryRun === false);
  const out = [];
  plan.forEach(function (step) {
    const f = DriveApp.getFileById(step[0]); // works for folders too
    if (f.getName() === step[1]) { out.push('ok | ' + step[1]); return; }
    if (dryRun) { out.push('WOULD rename | ' + f.getName() + ' -> ' + step[1]); return; }
    const old = f.getName();
    f.setName(step[1]);
    out.push('renamed | ' + old + ' -> ' + step[1]);
  });
  writeReport_('rename' + (dryRun ? '-dryrun' : ''), out);
}

// ------------------------------------------------------------------ 5. folder map

/** Writes a "path -> id" map of every folder, so later scripts never hard-code IDs. */
function folderIdMap() {
  const c = cfg_();
  const lines = [];
  [['ACTIVE', c.activeId], ['ARCHIVE', c.archiveId]].forEach(function (pair) {
    const items = listTree_(pair[1], 'id,name,mimeType,parents');
    const byId = {};
    items.forEach(function (f) { byId[f.id] = f; });
    items.filter(function (f) { return f.mimeType === FOLDER_MIME; }).forEach(function (f) {
      const parts = [f.name];
      let p = (f.parents || [])[0];
      while (p && byId[p]) { parts.unshift(byId[p].name); p = (byId[p].parents || [])[0]; }
      lines.push(pair[0] + '/' + parts.join('/') + ' | ' + f.id);
    });
  });
  writeReport_('folder-id-map', lines.sort());
}
