/* MyDock remote data adapter: Google Apps Script JSONP reads + POST writes. */
const API_URL = window.MYDOCK_CONFIG && window.MYDOCK_CONFIG.API_URL;
function apiReady() {
  if (!API_URL || API_URL.includes('PASTE_YOUR')) throw new Error('Configure API_URL in config.js with your Apps Script deployment URL.');
}
function apiGet(action, params = {}) {
  apiReady();
  return new Promise((resolve, reject) => {
    const callback = '__mydock_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('API request timed out. Check deployment access and URL.')), 20000);
    function finish(err, value) {
      clearTimeout(timer); delete window[callback]; script.remove();
      err ? reject(err) : resolve(value);
    }
    window[callback] = data => data && data.ok ? finish(null, data.data) : finish(new Error(data && data.error || 'API request failed.'));
    script.onerror = () => finish(new Error('Could not reach MyDock API. Check API_URL and deployment access.'));
    const query = new URLSearchParams({ action, callback });
    Object.entries(params).forEach(([k,v]) => query.set(k, String(v)));
    script.src = API_URL + (API_URL.includes('?') ? '&' : '?') + query.toString();
    document.head.appendChild(script);
  });
}
async function apiPost(action, payload = {}) {
  apiReady();
  // text/plain avoids a CORS preflight. The response is opaque cross-origin,
  // so the UI confirms writes by re-reading the affected collection.
  await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...payload }) });
  return true;
}
const getTasks = () => apiGet('list', { type: 'tasks' });
const addTask = async data => { await apiPost('add', { type: 'tasks', data }); return true; };
const updateTask = async (id, updates) => { await apiPost('update', { type: 'tasks', id, updates }); return true; };
const deleteTask = async id => { await apiPost('delete', { type: 'tasks', id }); return true; };
const getQuickLinks = () => apiGet('list', { type: 'links' });
const addQuickLink = async data => { await apiPost('add', { type: 'links', data }); return true; };
const updateQuickLink = async (id, updates) => { await apiPost('update', { type: 'links', id, updates }); return true; };
const deleteQuickLink = async id => { await apiPost('delete', { type: 'links', id }); return true; };
const getNotes = () => apiGet('list', { type: 'notes' });
const addNote = async data => { await apiPost('add', { type: 'notes', data }); return true; };
const updateNote = async (id, updates) => { await apiPost('update', { type: 'notes', id, updates }); return true; };
const deleteNote = async id => { await apiPost('delete', { type: 'notes', id }); return true; };
const exportAll = () => apiGet('export');
const importAll = data => apiPost('import', { data });
