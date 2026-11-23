/** MyDock API — Google Apps Script backend. One spreadsheet / one worksheet. */
const SPREADSHEET_ID = '1wJL8Y526QIIdOaHZJy5lyOWzbXvHxPNBpJP1OJrGDGA';
const SHEET_NAME = 'MyDockData';
const HEADERS = ['record_type','id','title','description','dueDate','dueTime','priority','category','status','completedAt','url','icon','logoUrl','favorite','content','sortOrder','settingKey','settingValue','createdAt','updatedAt'];
const RECORD_TYPES = ['tasks','links','notes'];
const FIELDS = ['id','title','description','dueDate','dueTime','priority','category','status','completedAt','url','icon','logoUrl','favorite','content','sortOrder','createdAt','updatedAt'];

// GET is read-only and JSONP-enabled for a separately hosted browser frontend.
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.action) return json_({ok:true, message:'MyDock API is running.'});
  try {
    let data;
    if (p.action === 'list') { assertType_(p.type); data = rows_().filter(r => r[0] === p.type).map(rowToRecord_); }
    else if (p.action === 'export') data = exportAllData_();
    else throw new Error('Unsupported GET action.');
    const result = JSON.stringify({ok:true,data});
    if (p.callback && /^[\w.$]+$/.test(p.callback)) return ContentService.createTextOutput(p.callback + '(' + result + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(result).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const failure = {ok:false,error:String(err.message || err)};
    if (p.callback && /^[\w.$]+$/.test(p.callback)) return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(failure) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return json_(failure);
  }
}
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    let data;
    if (body.action === 'add') data = addRecord_(body.type, body.data);
    else if (body.action === 'update') data = updateRecord_(body.type, body.id, body.updates);
    else if (body.action === 'delete') data = deleteRecord_(body.type, body.id);
    else if (body.action === 'import') data = replaceAllData_(body.data);
    else throw new Error('Unsupported POST action.');
    return json_({ok:true,data});
  } catch (err) { return json_({ok:false,error:String(err.message || err)}); }
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  else {
    const h = sh.getRange(1,1,1,HEADERS.length).getValues()[0];
    if (!HEADERS.every((x,i) => h[i] === x)) throw new Error('MyDockData headers do not match.');
  }
  return sh;
}
function setupMyDock() { const sh=getSheet_(); sh.setFrozenRows(1); sh.getRange(1,1,1,HEADERS.length).setFontWeight('bold').setBackground('#1742F5').setFontColor('#fff'); sh.autoResizeColumns(1,HEADERS.length); return 'MyDock setup complete.'; }
function rows_() { const sh=getSheet_(); return sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,HEADERS.length).getValues(); }
function rowToRecord_(r) { const o={}; FIELDS.forEach(k=>{const v=r[HEADERS.indexOf(k)];if(v!==''&&v!==null&&v!==undefined)o[k]=v;}); if(r[0]==='links'){o.name=o.title||'';delete o.title;} if(o.favorite!==undefined)o.favorite=o.favorite===true||String(o.favorite).toLowerCase()==='true'; if(o.sortOrder!==undefined)o.sortOrder=Number(o.sortOrder); return o; }
function toRow_(type,o) { const obj={record_type:type}; FIELDS.forEach(k=>obj[k]=o[k]===undefined||o[k]===null?'':o[k]); if(type==='links')obj.title=o.name||o.title||''; return HEADERS.map(h=>{const v=obj[h]===undefined?'':obj[h];return typeof v==='string'&&/^[=+@]/.test(v)?"'"+v:v;}); }
function assertType_(t) { if(RECORD_TYPES.indexOf(t)<0)throw new Error('Unsupported record type.'); }
function validate_(type,d) { if(!d||typeof d!=='object')throw new Error('Invalid record.'); if(type==='tasks'&& !String(d.title||'').trim())throw new Error('Task title is required.'); if(type==='links'){if(!String(d.name||'').trim())throw new Error('Website name is required.');if(!/^https?:\/\/\S+$/i.test(String(d.url||'')))throw new Error('URL must start with http:// or https://.');} if(type==='notes'&&!String(d.title||'').trim())throw new Error('Note title is required.'); }
function addRecord_(type,d) { assertType_(type);validate_(type,d);const lock=LockService.getScriptLock();lock.waitLock(10000);try{const now=new Date().toISOString();const r=Object.assign({},d,{id:Utilities.getUuid(),createdAt:now,updatedAt:now});getSheet_().appendRow(toRow_(type,r));return r;}finally{lock.releaseLock();} }
function updateRecord_(type,id,u) { assertType_(type);if(!id||!u||typeof u!=='object')throw new Error('Invalid update.');const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=getSheet_(),rs=rows_(),i=rs.findIndex(r=>r[0]===type&&String(r[1])===String(id));if(i<0)throw new Error('Record not found.');const old=rowToRecord_(rs[i]),next=Object.assign({},old,u,{id:old.id,createdAt:old.createdAt,updatedAt:new Date().toISOString()});validate_(type,next);sh.getRange(i+2,1,1,HEADERS.length).setValues([toRow_(type,next)]);return next;}finally{lock.releaseLock();} }
function deleteRecord_(type,id) { assertType_(type);const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=getSheet_(),rs=rows_(),i=rs.findIndex(r=>r[0]===type&&String(r[1])===String(id));if(i<0)return false;sh.deleteRow(i+2);return true;}finally{lock.releaseLock();} }
function exportAllData_() { const rs=rows_();return {app:'MyDock',version:2,exportedAt:new Date().toISOString(),tasks:rs.filter(r=>r[0]==='tasks').map(rowToRecord_),links:rs.filter(r=>r[0]==='links').map(rowToRecord_),notes:rs.filter(r=>r[0]==='notes').map(rowToRecord_),settings:{}}; }
function replaceAllData_(d) { if(!d||!['tasks','links','notes'].every(k=>Array.isArray(d[k])))throw new Error('Invalid backup file.');['tasks','links','notes'].forEach(t=>d[t].forEach(x=>validate_(t,x)));const lock=LockService.getScriptLock();lock.waitLock(10000);try{const sh=getSheet_();if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,HEADERS.length).clearContent();const all=[];['tasks','links','notes'].forEach(t=>d[t].forEach(x=>all.push(toRow_(t,x))));if(all.length)sh.getRange(2,1,all.length,HEADERS.length).setValues(all);return true;}finally{lock.releaseLock();} }
