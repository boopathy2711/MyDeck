/* MyDock UI – navigation, pages, forms. All data goes through storage.js */
(() => {
const S = { tasks: [], links: [], notes: [], page: 'dashboard', tq: '', tf: 'all', tp: '', tc: '', ts: '', tsort: 'due', lq: '', lc: '', lsort: 'fav', nq: '', nc: '', hq: '', hr: '' };
const TASK_CATS = ['Development', 'Learning', 'Meetings', 'Documentation', 'Personal', 'Other'];
const LINK_CATS = ['Development', 'Project Management', 'Office Portals', 'Documentation', 'Learning', 'Other'];
const NOTE_CATS = ['Technical', 'Meeting', 'Learning', 'General'];
const PRI = ['High', 'Medium', 'Low'], STAT = ['Pending', 'In Progress', 'Completed'];
const PAGES = {
  dashboard: { t: 'Dashboard', ic: 'dash', a: 'Add Task', act: 'addTask' },
  tasks: { t: 'My Tasks', ic: 'tasks', d: 'Plan and track your daily work.', a: 'Add New Task', act: 'addTask' },
  links: { t: 'Quick Links', ic: 'link', d: 'One place for the websites you use every day.', a: 'Add Link', act: 'addLink' },
  notes: { t: 'My Notes', ic: 'note', d: 'Capture information that does not need to be a task.', a: 'New Note', act: 'addNote' },
  history: { t: 'Completed History', ic: 'hist', d: 'Review the work you have finished.' },
  settings: { t: 'Settings', ic: 'set', d: 'Appearance, preferences and local data.' }
};
const prefs = () => { try { return JSON.parse(localStorage.getItem('mydock_prefs')) || {}; } catch { return {}; } };
const setPref = (k, v) => localStorage.setItem('mydock_prefs', JSON.stringify({ ...prefs(), [k]: v }));
const slug = s => s.replace(/\s/g, '');
const opts = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('');
const filt = (arr, sel, ph) => `<select data-f="${ph.k}" aria-label="${ph.l}"><option value="">${ph.l}</option>${opts(arr, sel)}</select>`;

/* ---------- data ---------- */
async function load() { [S.tasks, S.links, S.notes] = await Promise.all([getTasks(), getQuickLinks(), getNotes()]); }
async function mutate(fn, msg) { await fn(); await load(); render(); if (msg) toast(msg); }
async function seed() {
  if (localStorage.getItem('mydock_seeded')) return;
  localStorage.setItem('mydock_seeded', '1');
  if ((await getTasks()).length || (await getQuickLinks()).length) return;
  const t = ymd();
  await addTask({ title: 'Welcome to MyDock – edit or delete me', description: 'Sample task. Add your own with the button above.', dueDate: t, dueTime: '17:00', priority: 'Medium', category: 'Other', status: 'Pending', completedAt: '' });
  await addQuickLink({ name: 'Google', url: 'https://www.google.com', category: 'Other', icon: 'globe', favorite: true });
  await addQuickLink({ name: 'MDN Web Docs', url: 'https://developer.mozilla.org', category: 'Documentation', icon: 'book', favorite: true });
  await addNote({ title: 'Sample note', content: 'Notes are plain text. Edit or delete this one any time.', category: 'General' });
}

/* ---------- task helpers ---------- */
const done = t => t.status === 'Completed';
const dueAt = t => t.dueDate ? new Date(t.dueDate + 'T' + (t.dueTime || '23:59')) : null;
const isOver = t => !done(t) && dueAt(t) && dueAt(t) < new Date();
const isToday = t => t.dueDate === ymd();
function visibleTasks() {
  const q = S.tq.toLowerCase(), today = ymd();
  const quick = { all: () => true, today: t => isToday(t), upcoming: t => t.dueDate > today && !done(t), overdue: isOver, pending: t => t.status === 'Pending', progress: t => t.status === 'In Progress', completed: done }[S.tf];
  const rank = { High: 0, Medium: 1, Low: 2 };
  return S.tasks.filter(t => quick(t) && (!S.tp || t.priority === S.tp) && (!S.tc || t.category === S.tc) && (!S.ts || t.status === S.ts) &&
    (!q || (t.title + ' ' + t.description).toLowerCase().includes(q)))
    .sort({ due: (a, b) => (a.dueDate ? dueAt(a) : 8e15) - (b.dueDate ? dueAt(b) : 8e15), priority: (a, b) => rank[a.priority] - rank[b.priority], recent: (a, b) => b.createdAt.localeCompare(a.createdAt) }[S.tsort]);
}
function taskRow(t, compact) {
  const od = isOver(t), st = od ? 'Overdue' : t.status;
  return `<li class="task ${done(t) ? 'done' : ''}"><input type="checkbox" class="chk" data-act="toggle" data-id="${t.id}" ${done(t) ? 'checked' : ''} aria-label="Mark '${esc(t.title)}' complete">
  <div class="grow"><div class="t-title">${esc(t.title)}</div>${!compact && t.description ? `<div class="sm muted clamp">${esc(t.description)}</div>` : ''}
  <div class="meta"><span class="chip p-${t.priority}">${t.priority}</span>${compact ? '' : `<span class="chip">${esc(t.category)}</span>`}
  ${t.dueDate ? `<span class="${od ? 'over' : ''}">${icon('clock', 13)} ${compact ? '' : fmtDate(t.dueDate) + ' '}${t.dueTime || ''}</span>` : ''}<span class="chip s-${slug(st)}">${st}</span></div></div>
  ${compact ? '' : `<div class="acts"><button data-act="editTask" data-id="${t.id}" aria-label="Edit">${icon('edit', 16)}</button><button class="del" data-act="delTask" data-id="${t.id}" aria-label="Delete">${icon('trash', 16)}</button></div>`}</li>`;
}
const empty = (ic, title, text, btn, act) => `<div class="empty"><div class="eic">${icon(ic, 28)}</div><h3>${title}</h3><p>${text}</p>${btn ? `<button class="btn primary" data-act="${act}">${icon('plus', 16)} ${btn}</button>` : ''}</div>`;

/* ---------- pages ---------- */
function dashboard() {
  const open = S.tasks.filter(t => !done(t)), today = S.tasks.filter(t => isToday(t) && (!done(t) || t.completedAt?.slice(0, 10) === ymd()));
  const cards = [['Pending Tasks', open.length, 'tasks', 'var(--primary)'], ['Due Today', open.filter(isToday).length, 'clock', 'var(--warn)'], ['Overdue Tasks', open.filter(isOver).length, 'alert', 'var(--bad)'], ['Completed Tasks', S.tasks.filter(done).length, 'check', 'var(--ok)']];
  const favs = S.links.filter(l => l.favorite), recent = [...S.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  return `<div class="grid stats">${cards.map(c => `<div class="card stat" style="--c:${c[3]}"><div class="bub">${icon(c[2], 22)}</div><div><b>${c[1]}</b><div class="muted sm">${c[0]}</div></div></div>`).join('')}</div>
  <div class="grid dash"><div class="card"><div class="card-h"><h2>Today's Tasks</h2><button class="link-btn" data-go="tasks">View All Tasks</button></div>
  ${today.length ? `<ul class="list">${today.map(t => taskRow(t, true)).join('')}</ul>` : empty('tasks', 'Nothing due today', 'Enjoy the calm, or plan ahead.', 'Add Task', 'addTask')}</div>
  <div class="stack"><div class="card"><div class="card-h"><h2>Quick Access</h2><button class="link-btn" data-go="links">Manage Links</button></div>
  ${favs.length ? `<div class="grid links" style="grid-template-columns:1fr">${favs.map(l => linkCard(l, true)).join('')}</div>` : empty('star', 'No favorite links', 'Mark links as favorites to pin them here.', 'Add Link', 'addLink')}</div>
  <div class="card"><div class="card-h"><h2>Recent Notes</h2><button class="link-btn" data-go="notes">View All Notes</button></div>
  ${recent.length ? recent.map(n => `<button class="mini" data-act="editNote" data-id="${n.id}"><b>${esc(n.title)}</b><span class="muted sm clamp">${esc(n.content) || 'No content'}</span><span class="muted sm">Updated ${fmtDate(n.updatedAt)}</span></button>`).join('') : '<p class="muted">No notes yet.</p>'}</div></div></div>`;
}
function tasksPage() {
  const tabs = [['all', 'All Tasks'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['overdue', 'Overdue'], ['pending', 'Pending'], ['progress', 'In Progress'], ['completed', 'Completed']];
  const list = visibleTasks();
  let body;
  if (!S.tasks.length) body = empty('tasks', 'No tasks yet', 'Capture your first task – only a title is needed.', 'Create Your First Task', 'addTask');
  else if (S.tq && !list.length) body = empty('search', 'No search results', 'Try a different keyword.');
  else if (!list.length) body = empty('check', S.tf === 'today' ? 'No tasks due today' : S.tf === 'overdue' ? 'No overdue tasks' : 'No matching tasks', 'Nothing to show for this filter.');
  else body = `<ul class="list">${list.map(t => taskRow(t)).join('')}</ul>`;
  return `<div class="tabs">${tabs.map(t => `<button class="tab ${S.tf === t[0] ? 'on' : ''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>
  <div class="toolbar"><input class="s" type="search" data-f="tq" placeholder="Search tasks…" value="${esc(S.tq)}" aria-label="Search tasks">
  ${filt(PRI, S.tp, { k: 'tp', l: 'All priorities' })}${filt(TASK_CATS, S.tc, { k: 'tc', l: 'All categories' })}${filt(STAT, S.ts, { k: 'ts', l: 'All statuses' })}
  <select data-f="tsort" aria-label="Sort"><option value="due" ${S.tsort === 'due' ? 'selected' : ''}>Sort: Due date</option><option value="priority" ${S.tsort === 'priority' ? 'selected' : ''}>Sort: Priority</option><option value="recent" ${S.tsort === 'recent' ? 'selected' : ''}>Sort: Recently created</option></select></div>${body}`;
}
function linkCard(l, small) {
  const inner = `<a class="lmain" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="lic">${icon(l.icon, 20)}</span><span><b>${esc(l.name)}</b><br><span class="chip">${esc(l.category)}</span></span></a>`;
  if (small) return `<div class="lcard sm">${inner}</div>`;
  return `<div class="lcard">${inner}<div class="acts"><button class="fav ${l.favorite ? 'on' : ''}" data-act="favLink" data-id="${l.id}" aria-label="Toggle favorite" aria-pressed="${!!l.favorite}">${icon('star', 16)}</button><button data-act="editLink" data-id="${l.id}" aria-label="Edit">${icon('edit', 16)}</button><button class="del" data-act="delLink" data-id="${l.id}" aria-label="Delete">${icon('trash', 16)}</button></div></div>`;
}
function linksPage() {
  const q = S.lq.toLowerCase();
  const list = S.links.filter(l => (!S.lc || l.category === S.lc) && (!q || (l.name + l.url).toLowerCase().includes(q)))
    .sort({ fav: (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), recent: (a, b) => b.createdAt.localeCompare(a.createdAt), cat: (a, b) => a.category.localeCompare(b.category) }[S.lsort]);
  return `<div class="toolbar"><input class="s" type="search" data-f="lq" placeholder="Search links…" value="${esc(S.lq)}" aria-label="Search links">${filt(LINK_CATS, S.lc, { k: 'lc', l: 'All categories' })}
  <select data-f="lsort" aria-label="Sort"><option value="fav" ${S.lsort === 'fav' ? 'selected' : ''}>Favorites first</option><option value="name" ${S.lsort === 'name' ? 'selected' : ''}>Name A–Z</option><option value="cat" ${S.lsort === 'cat' ? 'selected' : ''}>Category</option><option value="recent" ${S.lsort === 'recent' ? 'selected' : ''}>Recently added</option></select></div>
  ${list.length ? `<div class="grid links">${list.map(l => linkCard(l)).join('')}</div>` : S.links.length ? empty('search', 'No links found', 'Try another search or category.') : empty('link', 'No quick links yet', 'Add the websites and portals you open every day.', 'Add Your First Link', 'addLink')}`;
}
function notesPage() {
  const q = S.nq.toLowerCase();
  const list = S.notes.filter(n => (!S.nc || n.category === S.nc) && (!q || (n.title + n.content).toLowerCase().includes(q))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `<div class="toolbar"><input class="s" type="search" data-f="nq" placeholder="Search notes…" value="${esc(S.nq)}" aria-label="Search notes">${filt(NOTE_CATS, S.nc, { k: 'nc', l: 'All categories' })}</div>
  ${list.length ? `<div class="grid notes">${list.map(n => `<button class="card note" data-act="editNote" data-id="${n.id}"><div class="card-h" style="margin:0"><h3>${esc(n.title)}</h3><span class="chip">${esc(n.category)}</span></div><p>${esc(n.content) || 'No content'}</p><span class="muted sm">Updated ${fmtDate(n.updatedAt)}</span></button>`).join('')}</div>`
    : S.notes.length ? empty('search', 'No notes found', 'Try another search or category.') : empty('note', 'No notes yet', 'Jot down commands, meeting points or reminders.', 'Create a Note', 'addNote')}`;
}
function historyPage() {
  const q = S.hq.toLowerCase(), days = { today: 0, week: 7, month: 30 }[S.hr], cut = days === undefined ? null : new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const list = S.tasks.filter(done).filter(t => (!q || (t.title + t.description).toLowerCase().includes(q)) && (!cut || (days === 0 ? t.completedAt?.slice(0, 10) === ymd() : t.completedAt?.slice(0, 10) >= cut))).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  return `<div class="toolbar"><input class="s" type="search" data-f="hq" placeholder="Search completed tasks…" value="${esc(S.hq)}" aria-label="Search history">
  <select data-f="hr" aria-label="Completion date"><option value="">Any completion date</option><option value="today" ${S.hr === 'today' ? 'selected' : ''}>Today</option><option value="week" ${S.hr === 'week' ? 'selected' : ''}>Last 7 days</option><option value="month" ${S.hr === 'month' ? 'selected' : ''}>Last 30 days</option></select></div>
  ${list.length ? `<ul class="list">${list.map(t => `<li class="task"><span style="color:var(--ok);margin-top:2px">${icon('check', 20)}</span><div class="grow"><div class="t-title">${esc(t.title)}</div><div class="meta"><span class="chip">${esc(t.category)}</span><span class="chip p-${t.priority}">${t.priority}</span><span>Due: ${t.dueDate ? fmtDate(t.dueDate) : '—'}</span><span>Completed: ${fmtDate(t.completedAt)}</span></div></div>
  <div class="acts"><button data-act="restore" data-id="${t.id}" aria-label="Restore to pending" title="Restore">${icon('undo', 16)}</button><button class="del" data-act="delTask" data-id="${t.id}" aria-label="Delete permanently">${icon('trash', 16)}</button></div></li>`).join('')}</ul>`
    : empty('hist', S.hq || S.hr ? 'No matching records' : 'No completed tasks yet', 'Finished tasks will appear here.')}`;
}
function settingsPage() {
  const th = document.documentElement.dataset.theme, p = prefs();
  return `<div class="card"><h2>Appearance</h2><div class="srow"><span>Theme</span><div class="seg"><button class="${th === 'light' ? 'on' : ''}" data-act="setTheme" data-id="light">Light</button><button class="${th === 'dark' ? 'on' : ''}" data-act="setTheme" data-id="dark">Dark</button></div></div></div>
  <div class="card" style="margin-top:18px"><h2>Preferences</h2><div class="srow"><span>Default task priority</span><select data-pref="defPri" aria-label="Default priority">${opts(PRI, p.defPri || 'Medium')}</select></div>
  <div class="srow"><span>Start with sidebar collapsed</span><input type="checkbox" class="chk" data-pref="collapsed" ${p.collapsed ? 'checked' : ''} aria-label="Collapse sidebar by default"></div></div>
  <div class="card" style="margin-top:18px"><h2>Data management</h2><p class="muted sm">Tasks, links and notes are stored in your connected Google Spreadsheet.</p>
  <div class="srow"><span>Export all data as JSON</span><button class="btn ghost" data-act="export">${icon('download', 16)} Export</button></div>
  <div class="srow"><span>Import from a previous export</span><button class="btn ghost" data-act="import">${icon('upload', 16)} Import</button><input type="file" id="file" accept="application/json,.json" hidden></div></div>`;
}

/* ---------- render / nav ---------- */
function render() {
  const m = PAGES[S.page], d = new Date(), h = d.getHours();
  const greet = S.page === 'dashboard' ? `Good ${h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'}!` : m.t;
  const sub = S.page === 'dashboard' ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · Here is your day at a glance.' : m.d;
  $('#pageHead').innerHTML = `<div><h1>${greet}</h1><p>${sub}</p></div>${m.a ? `<button class="btn primary" data-act="${m.act}">${icon('plus', 18)} ${m.a}</button>` : ''}`;
  $('#view').innerHTML = { dashboard, tasks: tasksPage, links: linksPage, notes: notesPage, history: historyPage, settings: settingsPage }[S.page]();
  document.title = m.t + ' · MyDock';
  document.querySelectorAll('.nav-item[data-page]').forEach(a => { a.classList.toggle('active', a.dataset.page === S.page); a.setAttribute('aria-current', a.dataset.page === S.page ? 'page' : 'false'); });
}
function go(p) { if (!PAGES[p]) p = 'dashboard'; S.page = p; document.body.classList.remove('menu-open'); if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p); render(); scrollTo(0, 0); }
function buildNav() {
  $('#nav').innerHTML = ['dashboard', 'tasks', 'links', 'notes', 'history'].map(k => `<a href="#${k}" class="nav-item" data-page="${k}" data-tip="${PAGES[k].t}">${icon(PAGES[k].ic, 20)}<span class="lbl">${PAGES[k].t}</span></a>`).join('');
  $('#sideBottom').innerHTML = `<a href="#settings" class="nav-item" data-page="settings" data-tip="Settings">${icon('set', 20)}<span class="lbl">Settings</span></a>
  <button class="nav-item" data-act="theme" data-tip="Toggle theme" id="sideTheme"></button>
  <button class="nav-item" data-act="collapse" data-tip="Collapse" id="collapseBtn">${icon('chev', 20)}<span class="lbl">Collapse</span></button><div class="ver">MyDock v1.0 · prototype</div>`;
}
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('#themeBtn').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#sideTheme').innerHTML = icon(dark ? 'sun' : 'moon', 20) + `<span class="lbl">${dark ? 'Light' : 'Dark'} mode</span>`;
}
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem('mydock_theme', t); syncTheme(); if (S.page === 'settings') render(); }

/* ---------- modal helpers ---------- */
const modal = $('#modal');
const fld = (l, name, html, req) => `<div class="f"><label for="f_${name}">${l}${req ? ' <span class="req">*</span>' : ''}</label>${html}</div>`;
function openForm(title, html, onSave, extra = '') {
  modal.innerHTML = `<form id="mf" novalidate><h2>${title}</h2>${html}<p class="err" id="ferr" role="alert"></p><div class="row end">${extra}<button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Save</button></div></form>`;
  modal.showModal(); modal.querySelector('input,textarea')?.focus();
  $('#mf').onsubmit = async e => {
    e.preventDefault();
    const err = await onSave(Object.fromEntries(new FormData(e.target)));
    if (err) $('#ferr').textContent = err; else modal.close();
  };
}
function confirmBox(msg, fn, label = 'Delete') {
  modal.innerHTML = `<h2>Are you sure?</h2><p style="margin-bottom:18px">${msg}</p><div class="row end"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" id="cok">${label}</button></div>`;
  modal.showModal(); $('#cok').onclick = async () => { modal.close(); await fn(); };
}
const taskForm = t => {
  const v = t || { priority: prefs().defPri || 'Medium', category: 'Other', status: 'Pending' };
  const sel = (n, a, s) => `<select id="f_${n}" name="${n}">${opts(a, s)}</select>`;
  return fld('Task title', 'title', `<input id="f_title" name="title" maxlength="140" value="${esc(v.title)}" placeholder="What needs doing?">`, 1) +
    fld('Description', 'description', `<textarea id="f_description" name="description" rows="3">${esc(v.description)}</textarea>`) +
    `<div class="fr">${fld('Due date', 'dueDate', `<input type="date" id="f_dueDate" name="dueDate" value="${v.dueDate || ''}">`)}${fld('Due time', 'dueTime', `<input type="time" id="f_dueTime" name="dueTime" value="${v.dueTime || ''}">`)}</div>` +
    `<div class="fr">${fld('Priority', 'priority', sel('priority', PRI, v.priority))}${fld('Category', 'category', sel('category', TASK_CATS, v.category))}</div>${fld('Status', 'status', sel('status', STAT, v.status))}`;
};
const taskData = d => ({ title: d.title.trim(), description: d.description.trim(), dueDate: d.dueDate, dueTime: d.dueDate ? d.dueTime : '', priority: d.priority, category: d.category, status: d.status, completedAt: d.status === 'Completed' ? new Date().toISOString() : '' });

/* ---------- actions ---------- */
const find = (c, id) => S[c].find(x => x.id === id);
const acts = {
  addTask: () => openForm('Add New Task', taskForm(), async d => {
    if (!d.title.trim()) return 'Please enter a task title.';
    await mutate(() => addTask(taskData(d)), 'Task created successfully');
  }),
  editTask: id => { const t = find('tasks', id); openForm('Edit Task', taskForm(t), async d => {
    if (!d.title.trim()) return 'Please enter a task title.';
    const u = taskData(d); if (done(t) && u.status === 'Completed') u.completedAt = t.completedAt;
    await mutate(() => updateTask(id, u), 'Task updated');
  }); },
  toggle: id => { const t = find('tasks', id); mutate(() => updateTask(id, done(t) ? { status: 'Pending', completedAt: '' } : { status: 'Completed', completedAt: new Date().toISOString() }), done(t) ? 'Task reopened' : 'Task completed'); },
  restore: id => mutate(() => updateTask(id, { status: 'Pending', completedAt: '' }), 'Task restored to Pending'),
  delTask: id => confirmBox('This task will be permanently deleted. This cannot be undone.', () => mutate(() => deleteTask(id), 'Task deleted')),
  addLink: () => openForm('Add Link', linkForm(), saveLink()),
  editLink: id => openForm('Edit Link', linkForm(find('links', id)), saveLink(id)),
  favLink: id => { const l = find('links', id); mutate(() => updateQuickLink(id, { favorite: !l.favorite }), l.favorite ? 'Removed from favorites' : 'Added to favorites'); },
  delLink: id => confirmBox('This link will be permanently deleted.', () => mutate(() => deleteQuickLink(id), 'Link deleted')),
  addNote: () => openForm('New Note', noteForm(), saveNote()),
  editNote: id => openForm('Edit Note', noteForm(find('notes', id)), saveNote(id), `<button type="button" class="btn ghost" style="margin-right:auto;color:var(--bad)" data-act="delNote" data-id="${id}">${icon('trash', 16)} Delete</button>`),
  delNote: id => { modal.close(); confirmBox('This note will be permanently deleted.', () => mutate(() => deleteNote(id), 'Note deleted')); },
  close: () => modal.close(),
  theme: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
  setTheme: (id) => setTheme(id),
  collapse: () => { document.body.classList.toggle('collapsed'); setPref('collapsed', document.body.classList.contains('collapsed')); },
  openMenu: () => document.body.classList.add('menu-open'),
  export: async () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' }));
    a.download = `mydock-backup-${ymd()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Data exported');
  },
  import: () => $('#file').click()
};
const linkForm = l => { const v = l || { category: 'Other', icon: 'globe' };
  return fld('Website name', 'name', `<input id="f_name" name="name" maxlength="60" value="${esc(v.name)}">`, 1) + fld('Website URL', 'url', `<input id="f_url" name="url" type="url" placeholder="https://example.com" value="${esc(v.url)}">`, 1) +
    `<div class="fr">${fld('Category', 'category', `<select id="f_category" name="category">${opts(LINK_CATS, v.category)}</select>`)}${fld('Icon', 'icon', `<select id="f_icon" name="icon">${opts(LINK_ICONS, v.icon)}</select>`)}</div>
    <label class="sw"><input type="checkbox" class="chk" name="favorite" ${v.favorite ? 'checked' : ''}> Show in Favorites</label><br>`; };
const saveLink = id => async d => {
  d.name = d.name.trim(); d.url = d.url.trim();
  if (!d.name) return 'Please enter a website name.';
  if (d.url && !/^[a-z][a-z0-9+.-]*:/i.test(d.url)) d.url = 'https://' + d.url;
  if (!validUrl(d.url)) return 'Enter a valid http:// or https:// URL, e.g. https://example.com';
  const rec = { name: d.name, url: d.url, category: d.category, icon: d.icon, favorite: d.favorite === 'on' };
  await mutate(() => id ? updateQuickLink(id, rec) : addQuickLink(rec), id ? 'Link updated' : 'Link added');
};
const noteForm = n => { const v = n || { category: 'General' };
  return fld('Title', 'title', `<input id="f_title" name="title" maxlength="120" value="${esc(v.title)}">`, 1) + fld('Category', 'category', `<select id="f_category" name="category">${opts(NOTE_CATS, v.category)}</select>`) +
    fld('Content', 'content', `<textarea id="f_content" name="content" rows="8">${esc(v.content)}</textarea>`); };
const saveNote = id => async d => {
  if (!d.title.trim()) return 'Please enter a note title.';
  const rec = { title: d.title.trim(), content: d.content, category: d.category };
  await mutate(() => id ? updateNote(id, rec) : addNote(rec), id ? 'Note updated' : 'Note created');
};

/* ---------- global search ---------- */
function globalSearch(q) {
  const box = $('#gres'); q = q.trim().toLowerCase();
  if (!q) { box.hidden = true; return; }
  const has = (...f) => f.join(' ').toLowerCase().includes(q);
  const groups = [['Tasks', S.tasks.filter(t => has(t.title, t.description)).slice(0, 5).map(t => ({ ic: 'tasks', t: t.title, go: 'editTask', id: t.id, page: 'tasks' }))],
    ['Quick Links', S.links.filter(l => has(l.name, l.url)).slice(0, 5).map(l => ({ ic: l.icon, t: l.name, page: 'links', q: l.name }))],
    ['Notes', S.notes.filter(n => has(n.title, n.content)).slice(0, 5).map(n => ({ ic: 'note', t: n.title, go: 'editNote', id: n.id, page: 'notes' }))]].filter(g => g[1].length);
  box.hidden = false;
  box.innerHTML = groups.length ? groups.map(g => `<h4>${g[0]}</h4>${g[1].map(r => `<button data-r='${esc(JSON.stringify(r))}'>${icon(r.ic, 16)}<span>${esc(r.t)}</span></button>`).join('')}`).join('') : '<p class="muted" style="padding:10px">No results found.</p>';
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const r = e.target.closest('[data-r]');
  if (r) { const o = JSON.parse(r.dataset.r); $('#gres').hidden = true; $('#gs').value = ''; if (o.q) S.lq = o.q; go(o.page); if (o.go) acts[o.go](o.id); return; }
  if (!e.target.closest('.gsearch')) $('#gres').hidden = true;
  if (e.target === modal) modal.close();
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
  const tab = e.target.closest('[data-tab]'); if (tab) { S.tf = tab.dataset.tab; return render(); }
  const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) acts[b.dataset.act](b.dataset.id, b);
  if (e.target.closest('.nav-item[data-page]')) document.body.classList.remove('menu-open');
});
document.addEventListener('input', e => {
  const k = e.target.dataset.f;
  if (k && e.target.type === 'search') { S[k] = e.target.value; clearTimeout(S._t); S._t = setTimeout(() => { render(); const i = document.querySelector(`[data-f="${k}"]`); i?.focus(); i?.setSelectionRange(1e4, 1e4); }, 180); }
});
document.addEventListener('change', async e => {
  const t = e.target, k = t.dataset.f;
  if (k && t.tagName === 'SELECT') { S[k] = t.value; render(); }
  if (t.dataset.pref) { setPref(t.dataset.pref, t.type === 'checkbox' ? t.checked : t.value); toast('Preference saved'); }
  if (t.id === 'file' && t.files[0]) {
    try {
      const d = JSON.parse(await t.files[0].text());
      const okArr = (a, f) => Array.isArray(a) && a.every(x => x && typeof x.id === 'string' && typeof x[f] === 'string');
      if (!okArr(d.tasks, 'title') || !okArr(d.links, 'name') || !okArr(d.notes, 'title')) throw 0;
      confirmBox(`This will replace ALL current data with ${d.tasks.length} tasks, ${d.links.length} links and ${d.notes.length} notes.`, async () => { await importAll(d); await load(); render(); toast('Data imported successfully'); }, 'Replace data');
    } catch { toast('Invalid file – import cancelled', 'err'); }
    t.value = '';
  }
});
$('#gs').addEventListener('input', e => globalSearch(e.target.value));
$('#gs').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; $('#gres').hidden = true; } });
$('#backdrop').addEventListener('click', () => document.body.classList.remove('menu-open'));
addEventListener('hashchange', () => go(location.hash.slice(1)));

/* ---------- init ---------- */
(async () => {
  hydrateIcons(); buildNav(); syncTheme();
  if (prefs().collapsed) document.body.classList.add('collapsed');
  try { await load(); go(location.hash.slice(1) || 'dashboard'); }
  catch (err) { toast(err.message || 'Could not load MyDock data', 'err'); console.error(err); }
})();
})();
