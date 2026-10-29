# Drive migration toolkit

Functions used to move a project from scattered personal folders to one structure owned by a project account.

| Function | What it does | Changes anything? |
|---|---|---|
| `inventory(folderId)` | Path, type and owner of every item under a legacy folder | No |
| `auditOwnership()` | Items under the active and restricted areas not owned by the project account | No |
| `requestOwnershipTransfer({dryRun})` | Asks the project account to take ownership of your files (pending-owner request) | Only with `dryRun: false` |
| `diagnosePermissions()` | Who has which role on the top folders | No |
| `applyPermissions({dryRun})` | Members edit *active*, read *archive*; *restricted* is never touched; no e-mails | Only with `dryRun: false` |
| `moveWithTrail(plan, {dryRun})` | Moves items and leaves a shortcut at the origin | Only with `dryRun: false` |
| `renameFromPlan(plan, {dryRun})` | Applies the naming convention from a list | Only with `dryRun: false` |
| `folderIdMap()` | Writes a "path → ID" map so later scripts never hard-code IDs | No |

Every run writes a timestamped report to the log folder.

## Setup

1. Create an Apps Script project, add the files and enable the **Drive API** advanced service (v3).
2. Paste `Config.example.gs`, fill in your own values, run `setUpProperties()` once, then delete that file.
3. Run each step as a dry run, read the report, then run it again with `{ dryRun: false }`.
