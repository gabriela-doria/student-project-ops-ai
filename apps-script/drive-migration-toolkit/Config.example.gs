/**
 * One-time setup. Copy this file into your Apps Script project,
 * replace the placeholders, run setUpProperties() once, then DELETE
 * this file (or clear the values) so no ID or e-mail stays in the code.
 */
function setUpProperties() {
  PropertiesService.getScriptProperties().setProperties({
    ROOT_FOLDER_ID: 'YOUR_ROOT_FOLDER_ID',
    ACTIVE_FOLDER_ID: 'YOUR_ACTIVE_FOLDER_ID',
    ARCHIVE_FOLDER_ID: 'YOUR_ARCHIVE_FOLDER_ID',
    RESTRICTED_FOLDER_ID: 'YOUR_RESTRICTED_FOLDER_ID',
    PROJECT_ACCOUNT_EMAIL: 'project-account@example.org',
    ROSTER_SHEET_ID: 'YOUR_ROSTER_SHEET_ID',
    LOG_FOLDER_ID: 'YOUR_LOG_FOLDER_ID'
  });
}
