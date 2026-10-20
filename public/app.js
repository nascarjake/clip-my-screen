const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  star:'<path d="m12 2 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2L1.6 9.5l7.2-1z"/>',
  bolt:'<path d="m13 2-9 11h7l-1 9 10-12h-7z"/>',
  camera:'<path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  record:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-3.2v-.6a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4v-3.2h.6a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h3.2v.6a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.6v3.2h-.6a1.7 1.7 0 0 0-1.6 1z"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  drive:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 13h18"/><path d="M17 16h.01"/>',
  spark:'<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/><path d="m20 17 .6 1.4L22 19l-1.4.6L20 21l-.6-1.4L18 19l1.4-.6z"/>',
  monitor:'<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8M12 18v4"/>',
  sound:'<path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1A5 5 0 0 0 12.1 3.8L10.9 5M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1l1.2-1.2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3"/>',
  scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8.5 21 21M14 10l7-7M8.5 15.5 12 12"/>'
};
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`; }
$$('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));
const state = { clips: [], status: null, page: 'home', filter: 'all', search: '', selected: null };
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function timeAgo(value) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)} hr ago`;
  return new Date(value).toLocaleDateString(undefined, { month:'short', day:'numeric' });
}
function duration(seconds) { return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }
function clipLength(seconds) { return seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`; }
function displayLabel(display) { return `Display ${display.index + 1}${display.main ? ' (Main)' : ''} · ${display.width} × ${display.height}`; }
function bytes(value) { return value >= 1024**3 ? `${(value/1024**3).toFixed(1)} GB` : value >= 1024**2 ? `${(value/1024**2).toFixed(1)} MB` : `${Math.round(value/1024)} KB`; }
async function api(url, options={}) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers||{}) } });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error || 'Request failed');
  return value;
}
function toast(message, type='success') {
  const item = document.createElement('div'); item.className = `toast ${type}`; item.textContent = message;
  $('#toast-stack').append(item); setTimeout(() => item.remove(), 4200);
}
let refreshPending;
async function refresh() {
  if (refreshPending) return refreshPending;
  refreshPending = refreshData();
  try { await refreshPending; } finally { refreshPending = null; }
}
async function refreshData() {
  try {
    const [status, clips] = await Promise.all([api('/api/status'), api('/api/clips')]);
    const clipsChanged = !state.status || JSON.stringify(clips) !== JSON.stringify(state.clips);
    state.status = status; state.clips = clips;
    renderStatus();
    if (clipsChanged) renderClips();
  } catch (error) { toast(error.message, 'error'); }
}
function renderStatus() {
  const status = state.status;
  if (!status) return;
  const windows = status.platform === 'win32';
  if (windows) {
    $$('kbd').forEach(key => {
      key.textContent = key.textContent.replaceAll('⌘ ⌥', 'Ctrl Alt').replaceAll('⌘ ⇧', 'Ctrl Shift');
    });
  }
  const seconds = status.settings.clipSeconds;
  $('#hero-length').textContent = clipLength(seconds);
  $('#quick-length').textContent = clipLength(seconds);
  $('#clip-length-label').textContent = '15-minute rolling window';
  const selectedDisplay = status.displays.find(display => display.index === status.settings.display);
  $('#capture-display-label').textContent = selectedDisplay ? displayLabel(selectedDisplay) : `Display ${status.settings.display + 1}`;
  $('#buffer-available').textContent = status.bufferAvailableSeconds >= 900 ? '15 min ready' : `${Math.floor(status.bufferAvailableSeconds / 60)} of 15 min ready`;
  $('#capture-resolution').textContent = status.ready ? `${status.width} × ${status.height} · ${status.settings.fps} FPS` : `${status.settings.quality}p · ${status.settings.fps} FPS`;
  $('#audio-label').textContent = status.settings.systemAudio ? (status.settings.microphone ? 'System + mic' : 'System audio') : (status.settings.microphone ? 'Microphone' : 'No audio');
  $('#capture-dot').style.background = status.ready ? '#58d49c' : '#eb9d64';
  $('#capture-label').textContent = status.paused ? 'CAPTURE PAUSED' : status.recording ? 'LONG RECORDING IN PROGRESS' : status.ready ? 'ALWAYS READY TO CLIP' : 'RECORDER NEEDS ATTENTION';
  $('#capture-headline').textContent = status.paused ? 'Your screen is not being recorded.' : status.recording ? 'Your session is recording.' : status.ready ? 'Your screen, on standby.' : 'Capture is unavailable.';
  $('#capture-description').textContent = status.paused ? 'Capture stays paused after reopening the app and at login. Choose Resume capture when you are ready to record.' : status.error || (status.recording ? 'Press stop when you are done. You can still save instant clips along the way.' : 'The last few moments are kept in a private rolling buffer until you save them.');
  $('#capture-toggle').textContent = status.paused ? 'Resume capture' : 'Pause capture';
  $('#capture-toggle').disabled = Boolean(status.recording);
  $$('#side-clip, #side-shot, #side-record, #quick-clip, #quick-shot, #quick-record, #library-clip, #hero-record, [data-grab-seconds]').forEach(button => { button.disabled = !status.ready; });
  $('#record-button-text').textContent = status.recording ? 'Stop recording' : 'Start recording';
  $('#hero-record').classList.toggle('recording', !!status.recording);
  $('#hero-clip').disabled = !status.ready;
  $('#top-time').textContent = new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  $('#nav-count').textContent = state.clips.length;
  $('#storage-copy').textContent = `${bytes(status.storageBytes)} used · saved on this ${windows ? 'PC' : 'Mac'}`;
  $('#storage-fill').style.width = `${Math.min(100, Math.max(4, status.storageBytes / (10*1024**3) * 100))}%`;
  $('#settings-data-path').textContent = `Captures are saved in ${status.dataDir}`;
  $('#tunnel-state').textContent = status.tunnelStatus === 'online' ? 'Online' : status.tunnelStatus === 'starting' ? 'Starting…' : status.tunnelStatus === 'error' ? 'Error' : 'Off';
  $('#tunnel-description').textContent = status.tunnelError || (status.tunnelStatus === 'online' ? `Temporary public address: ${status.tunnelUrl}` : status.tunnelAvailable ? 'Create a temporary free link for sharing beyond your Wi-Fi. The address changes when restarted.' : 'Install cloudflared with Homebrew to enable free public links: brew install cloudflared');
  $('#tunnel-button').textContent = status.tunnelStatus === 'online' ? 'Stop public link' : status.tunnelStatus === 'starting' ? 'Connecting…' : 'Start public link';
  $('#tunnel-button').disabled = !status.tunnelAvailable || status.tunnelStatus === 'starting';
}
function emptyState(isSearch=false) {
  const shortcut = state.status?.platform === 'win32' ? 'Ctrl Shift 8' : '⌘ ⇧ 8';
  return `<div class="empty-state"><div class="empty-art">${icon(isSearch?'search':'bolt')}</div><h3>${isSearch?'No matching captures':'Your next moment starts here'}</h3><p>${isSearch?'Try another search or filter.':`Press ${shortcut} to save your first clip. It will show up here.`}</p></div>`;
}
function card(clip) {
  const thumb = clip.thumb ? `<img src="/api/clips/${clip.id}/thumb" alt="" loading="lazy">` : `<span class="placeholder-icon">${icon('record')}</span>`;
  return `<button class="clip-card" data-clip-id="${clip.id}"><div class="clip-thumb">${thumb}<span class="clip-type">${escapeHtml(clip.type)}</span>${clip.duration ? `<span class="clip-duration">${duration(clip.duration)}</span>` : ''}</div><div class="clip-card-body"><div class="clip-card-title">${escapeHtml(clip.title)}</div><div class="clip-card-sub"><span>${timeAgo(clip.createdAt)} · ${bytes(clip.bytes)}</span>${clip.favorite ? '<span class="favorite-mark">★</span>' : ''}</div></div></button>`;
}
function renderClips() {
  $('#recent-count').textContent = state.clips.length ? `${state.clips.length} saved` : '';
  $('#recent-grid').innerHTML = state.clips.length ? state.clips.slice(0,3).map(card).join('') : emptyState();
  let clips = state.clips;
  const type = state.page === 'favorites' ? 'favorites' : state.filter;
  if (type === 'favorites') clips = clips.filter(clip => clip.favorite);
  else if (type !== 'all') clips = clips.filter(clip => clip.type === type);
  if (state.search) clips = clips.filter(clip => `${clip.title} ${clip.tags.join(' ')}`.toLowerCase().includes(state.search.toLowerCase()));
  $('#result-count').textContent = `${clips.length} capture${clips.length === 1 ? '' : 's'}`;
  $('#library-grid').innerHTML = clips.length ? clips.map(card).join('') : emptyState(Boolean(state.search || type !== 'all'));
}
function showPage(page) {
  state.page = page;
  $('#home-view').hidden = page !== 'home'; $('#library-view').hidden = page === 'home';
  $('#page-name').textContent = page === 'home' ? 'Home' : page === 'favorites' ? 'Favorites' : 'My clips';
  $('#library-heading').innerHTML = page === 'favorites' ? 'Favorites<span class="period">.</span>' : 'My clips<span class="period">.</span>';
  $('#library-subtitle').textContent = page === 'favorites' ? 'The moments you marked to keep close.' : 'Every moment you saved, all in one place.';
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  $('.filter-tabs').hidden = page === 'favorites';
  renderClips();
  window.scrollTo({ top:0, behavior:'smooth' });
}
function modal(id, open) { $(`#${id}`).hidden = !open; document.body.style.overflow = open ? 'hidden' : ''; }
function fillSettings() {
  const settings = state.status.settings;
  $('#setting-seconds').value = settings.clipSeconds; $('#setting-quality').value = settings.quality; $('#setting-fps').value = settings.fps;
  const displays = state.status.displays || [];
  const option = (label, value) => { const element = document.createElement('option'); element.textContent = label; element.value = value; return element; };
  $('#setting-display').replaceChildren(...displays.map(display => option(displayLabel(display), display.index)));
  if (!displays.some(display => display.index === settings.display)) $('#setting-display').append(option(`Display ${settings.display + 1} unavailable`, settings.display));
  $('#setting-display').value = settings.display; $('#setting-audio').checked = settings.systemAudio; $('#setting-mic').checked = settings.microphone;
  for (const selector of ['#setting-audio', '#setting-mic']) $(selector).disabled = state.status.platform === 'win32';
  $('#setting-lan').checked = settings.lanSharing; $('#setting-public-url').value = settings.publicBaseUrl;
}
async function saveSettings() {
  const input = { clipSeconds:Number($('#setting-seconds').value), quality:Number($('#setting-quality').value), fps:Number($('#setting-fps').value),
    display:Number($('#setting-display').value), systemAudio:$('#setting-audio').checked, microphone:$('#setting-mic').checked,
    lanSharing:$('#setting-lan').checked, publicBaseUrl:$('#setting-public-url').value.trim() };
  try { await api('/api/settings',{method:'PATCH',body:JSON.stringify(input)}); modal('settings-modal',false); toast('Settings saved'); await refresh(); }
  catch(error){ toast(error.message,'error'); }
}
async function waitJob(job, successMessage) {
  for (let attempt=0;attempt<1500;attempt++) {
    await new Promise(resolve=>setTimeout(resolve,1000));
    const current = await api(`/api/jobs/${job.id}`);
    if (current.status === 'done') { toast(successMessage); await refresh(); return current; }
    if (current.status === 'error') throw new Error(current.error);
  }
  throw new Error('Capture is taking longer than expected');
}
async function doAction(route, message, payload={}) {
  try { const job = await api(route,{method:'POST',body:JSON.stringify(payload)}); toast('Working on your capture…'); await waitJob(job,message); }
  catch(error){ toast(error.message,'error'); }
}
function openClip(id) {
  const clip = state.clips.find(item => item.id === id); if (!clip) return;
  state.selected = id;
  $('#detail-media').innerHTML = clip.type === 'screenshot' ? `<img src="/api/clips/${id}/file" alt="${escapeHtml(clip.title)}">` : `<video src="/api/clips/${id}/file" controls autoplay playsinline></video>`;
  $('#detail-kicker').textContent = clip.type;
  $('#detail-title').value = clip.title;
  $('#detail-info').textContent = `${new Date(clip.createdAt).toLocaleString()} · ${bytes(clip.bytes)}${clip.duration ? ` · ${duration(clip.duration)}` : ''}`;
  $('#detail-favorite').innerHTML = `${icon('star')} ${clip.favorite ? 'Favorited' : 'Favorite'}`;
  $('#detail-tags').value = clip.tags.join(', ');
  $('#trim-box').hidden = clip.type === 'screenshot';
  $('#trim-start').value = 0; $('#trim-end').value = clip.duration;
  $('#detail-location').textContent = state.status?.platform === 'win32' ? 'Saved on your PC' : 'Saved on your Mac';
  updateShareRow(clip);
  updateShareScope();
  modal('detail-modal',true);
}
function updateShareRow(clip) { $('#detail-link-row').hidden = !clip.shareUrl; $('#detail-link').value = clip.shareUrl || ''; $('#detail-share').innerHTML = `${icon('link')} ${clip.shareUrl ? 'Copy share link' : 'Create share link'}`; }
function updateShareScope() { $('#detail-share-scope').textContent = state.status?.tunnelStatus === 'online' || state.status?.settings.publicBaseUrl ? 'Public link: anyone with this private URL can view this capture.' : 'This link works on your local Wi-Fi. Start a public share session in Settings to share beyond it.'; }
async function mutateClip(input) {
  const clip = await api(`/api/clips/${state.selected}`,{method:'PATCH',body:JSON.stringify(input)});
  state.clips = state.clips.map(item => item.id === clip.id ? clip : item); renderClips(); return clip;
}
async function shareClip() {
  try {
    let clip = state.clips.find(item=>item.id===state.selected);
    if (!clip.shareUrl) {
      clip = await api(`/api/clips/${clip.id}/share`,{method:'POST',body:JSON.stringify({enabled:true})});
      state.clips = state.clips.map(item=>item.id===clip.id?clip:item);
    }
    updateShareRow(clip); updateShareScope();
    await navigator.clipboard.writeText(clip.shareUrl);
    toast('Share link copied');
  } catch(error) { toast(error.message,'error'); }
}
async function revokeShare() {
  try { const clip = await api(`/api/clips/${state.selected}/share`,{method:'POST',body:JSON.stringify({enabled:false})}); state.clips=state.clips.map(item=>item.id===clip.id?clip:item); updateShareRow(clip); toast('Share link revoked'); }
  catch(error){ toast(error.message,'error'); }
}
$$('[data-page]').forEach(button => button.addEventListener('click',()=>showPage(button.dataset.page)));
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{ state.filter=button.dataset.filter; $$('[data-filter]').forEach(item=>item.classList.toggle('active',item===button)); renderClips(); }));
$('#clip-search').addEventListener('input',event=>{ state.search=event.target.value; renderClips(); });
$('#view-all').addEventListener('click',()=>showPage('library'));
for (const selector of ['#hero-clip','#quick-clip','#side-clip','#library-clip']) $(selector).addEventListener('click',()=>doAction('/api/grab','Clip saved to your library'));
$$('[data-grab-seconds]').forEach(button => button.addEventListener('click', () => {
  const seconds = Number(button.dataset.grabSeconds);
  doAction('/api/grab', `${clipLength(seconds)} clip saved to your library`, { seconds });
}));
for (const selector of ['#quick-shot','#side-shot']) $(selector).addEventListener('click',()=>doAction('/api/screenshot','Screenshot saved'));
for (const selector of ['#hero-record','#quick-record','#side-record']) $(selector).addEventListener('click',()=>doAction('/api/recording',state.status?.recording?'Session saved':'Long recording started'));
for (const selector of ['#settings-open','#top-settings']) $(selector).addEventListener('click',()=>{
  try { if (state.status) fillSettings(); modal('settings-modal',true); }
  catch (error) { toast(error.message, 'error'); }
});
$('#settings-save').addEventListener('click',saveSettings);
$('#capture-toggle').addEventListener('click', async () => {
  try {
    await api('/api/capture', { method: 'POST', body: JSON.stringify({ enabled: Boolean(state.status?.paused) }) });
    await refresh();
  } catch (error) { toast(error.message, 'error'); }
});
$('#tunnel-button').addEventListener('click',async()=>{
  try {
    if (state.status?.tunnelStatus === 'online') { await api('/api/tunnel/stop',{method:'POST',body:'{}'}); toast('Public share session stopped'); await refresh(); return; }
    await api('/api/tunnel/start',{method:'POST',body:'{}'});
    toast('Starting public share session…');
    for (let attempt=0;attempt<30;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,1000)); await refresh();
      if (state.status?.tunnelStatus === 'online') { toast('Public link is ready'); updateShareScope(); return; }
      if (state.status?.tunnelStatus === 'error') throw new Error(state.status.tunnelError);
    }
    throw new Error('Public link did not start');
  } catch(error){ toast(error.message,'error'); }
});
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>modal(button.dataset.close,false)));
$$('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('click',event=>{if(event.target===backdrop)modal(backdrop.id,false)}));
document.addEventListener('keydown',event=>{if(event.key==='Escape')$$('.modal-backdrop').forEach(backdrop=>modal(backdrop.id,false))});
document.addEventListener('click',event=>{const card=event.target.closest('[data-clip-id]');if(card)openClip(card.dataset.clipId)});
$('#detail-title').addEventListener('change',async event=>{try{await mutateClip({title:event.target.value});toast('Title saved')}catch(error){toast(error.message,'error')}});
$('#detail-tags').addEventListener('change',async event=>{try{await mutateClip({tags:event.target.value.split(',')});toast('Tags saved')}catch(error){toast(error.message,'error')}});
$('#detail-favorite').addEventListener('click',async()=>{try{const clip=state.clips.find(item=>item.id===state.selected);const updated=await mutateClip({favorite:!clip.favorite});$('#detail-favorite').innerHTML=`${icon('star')} ${updated.favorite?'Favorited':'Favorite'}`;toast(updated.favorite?'Added to favorites':'Removed from favorites')}catch(error){toast(error.message,'error')}});
$('#detail-share').addEventListener('click',shareClip);
$('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#detail-link').value);toast('Share link copied')}catch(error){toast(error.message,'error')}});
$('#revoke-link').addEventListener('click',revokeShare);
$('#detail-download').addEventListener('click',()=>{const a=document.createElement('a');a.href=`/api/clips/${state.selected}/file`;a.download=state.clips.find(item=>item.id===state.selected)?.file||'capture';a.click()});
$('#detail-delete').addEventListener('click',async()=>{if(!confirm('Delete this capture from your computer?'))return;try{await api(`/api/clips/${state.selected}`,{method:'DELETE'});modal('detail-modal',false);toast('Capture deleted');await refresh()}catch(error){toast(error.message,'error')}});
$('#trim-submit').addEventListener('click',async()=>{try{const job=await api(`/api/clips/${state.selected}/trim`,{method:'POST',body:JSON.stringify({start:Number($('#trim-start').value),end:Number($('#trim-end').value)})});toast('Creating your trim…');await waitJob(job,'Trim saved as a new clip');modal('detail-modal',false)}catch(error){toast(error.message,'error')}});
await refresh();
setInterval(() => { if (!document.hidden) refresh(); },5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
