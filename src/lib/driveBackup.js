// Weekly backup to a Google Apps Script endpoint the user deploys themselves.
//
// Its own module rather than App.jsx so AppSettingsView — which offers the setup and the
// manual "back up now" button — can be imported by a test. Nothing here touches Firebase.
//
// DRIVE_SCRIPT is the Apps Script source the user pastes into script.google.com. The
// `function doGet` inside it is that script's code, not this file's.
export const getISOWeekFilename = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `AnimalHealthPK_Backup_${d.getFullYear()}-W${String(wk).padStart(2,'0')}.json`;
};

export const uploadToDrive = async (scriptUrl, backupObj, folderId) => {
  const filename = getISOWeekFilename();
  const res = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ filename, folderId: folderId || '', keepCount: 4, content: JSON.stringify(backupObj) }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Script error ${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(data.error);
};

export const DRIVE_SCRIPT = `function doPost(e) {
  try {
    if (!e || !e.postData) throw new Error('No POST data received');
    var payload = JSON.parse(e.postData.contents);
    var folder = payload.folderId
      ? DriveApp.getFolderById(payload.folderId)
      : DriveApp.getRootFolder();

    // Overwrite same-week file if it exists
    var existing = folder.getFilesByName(payload.filename);
    while (existing.hasNext()) existing.next().setTrashed(true);
    folder.createFile(payload.filename, payload.content, MimeType.PLAIN_TEXT);

    // Keep only the most recent N backups (oldest go to trash)
    var keep = payload.keepCount || 4;
    var files = [];
    var iter = folder.searchFiles('title contains "AnimalHealthPK_Backup_"');
    while (iter.hasNext()) files.push(iter.next());
    files.sort(function(a, b) { return a.getDateCreated() - b.getDateCreated(); });
    while (files.length > keep) files.shift().setTrashed(true);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, backupsKept: Math.min(files.length, keep) }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export const getDriveScript = () => DRIVE_SCRIPT;
