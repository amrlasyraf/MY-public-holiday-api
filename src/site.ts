export const siteHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Check Malaysian public holidays by state and date, with links to official sources.">
  <title>Malaysia Public Holidays</title>
  <style>
    :root{--ink:#242b34;--muted:#626974;--line:#d9dde1;--blue:#224c80;--paper:#fff;--wash:#f4f6f8}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--blue);text-underline-offset:3px}a:hover{color:#102f54}button,input,select{font:inherit}button,a,input,select{touch-action:manipulation}:focus-visible{outline:3px solid #bc7225;outline-offset:3px}.wrap{max-width:1100px;margin:auto;padding:0 30px}.skip{position:absolute;left:20px;top:-80px;background:white;padding:10px;z-index:2}.skip:focus{top:10px}
    header{border-top:4px solid var(--blue);border-bottom:1px solid var(--line)}.nav{min-height:82px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:17px;color:var(--ink);font-weight:650;text-decoration:none}.brand small{display:block;font-size:12px;font-weight:400;color:var(--muted)}nav{display:flex;gap:25px;font-size:13px}nav a{color:var(--ink);text-decoration:none}nav a:hover{text-decoration:underline}
    .intro{padding:38px 0 24px}.eyebrow{margin:0 0 6px;color:var(--muted);font-size:12px;letter-spacing:.09em;text-transform:uppercase}h1,h2,h3,p{margin-top:0}h1{font:normal clamp(29px,4vw,40px)/1.2 Georgia,serif;margin-bottom:10px;letter-spacing:-.025em}.intro p:last-child{margin:0;color:var(--muted)}h2{font-size:19px;line-height:1.4;font-weight:650}h3{font-size:15px;font-weight:650}
    .checker{border-top:2px solid var(--ink);background:var(--wash);padding:22px 24px;margin-bottom:34px}.checker form{display:grid;grid-template-columns:1.4fr 1fr auto;gap:18px;align-items:end}label{display:block;font-size:12px;font-weight:650;margin-bottom:5px}input,select{width:100%;min-width:0;border:1px solid #adb5bf;border-radius:3px;padding:9px 11px;min-height:44px;background:white;color:var(--ink)}button{cursor:pointer;border:1px solid var(--blue);background:var(--blue);color:white;border-radius:3px;min-height:44px;padding:9px 22px}button:hover{background:#173b68}button:disabled{opacity:.6;cursor:wait}.answer{padding-top:20px;margin-top:20px;border-top:1px solid var(--line)}.answer h2{font:normal 25px/1.3 Georgia,serif;margin-bottom:6px}.answer p{margin-bottom:4px}.note{font-size:12px;color:var(--muted)}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 255px;gap:48px;padding-bottom:48px}.section-top{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--ink);padding-bottom:12px}.section-top h2{margin:0}.year-field{display:flex;align-items:center;gap:10px}.year-field label{margin:0}.year-field select{width:94px;min-height:36px;padding:4px 8px}.list-meta{display:flex;justify-content:space-between;gap:12px;margin:10px 0 22px;font-size:12px;color:var(--muted)}.month{margin:25px 0 0;color:var(--muted);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--line);padding-bottom:7px}.holiday{display:grid;grid-template-columns:58px 1fr;gap:18px;padding:14px 0;border-bottom:1px solid #e9ecef}.date{font-variant-numeric:tabular-nums;font-size:20px;line-height:1.3}.date small{display:block;font-size:11px;color:var(--muted);margin-top:4px}.holiday h3{margin:0 0 2px;font-size:14px}.holiday p{margin:0;font-size:12px;color:var(--muted)}.record-note{margin-top:4px!important;display:flex;gap:10px;flex-wrap:wrap}.provisional{color:#845816}.cancelled{text-decoration:line-through}.next{border-left:3px solid var(--blue);padding-left:16px;margin:0 0 30px}.next h2{font-size:12px;color:var(--muted);font-weight:400;margin-bottom:8px}.next strong{font:normal 23px/1.3 Georgia,serif;display:block;margin-bottom:7px}.next p{font-size:13px;margin:0}.aside-section{border-top:1px solid var(--line);padding-top:20px;margin-top:24px}.aside-section h2{font-size:14px;margin-bottom:10px}.aside-section p,.aside-section li{font-size:12px;color:var(--muted)}.aside-section ul{padding-left:17px}.change{margin-bottom:16px}.change time{display:block;font-size:11px;color:var(--muted)}.change p{margin:4px 0}.aside-section a{font-size:12px}
    .developer{border-top:1px solid var(--ink);padding:27px 0 42px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.developer p{color:var(--muted);font-size:13px}.developer h2{margin-bottom:8px}pre{background:var(--wash);border:1px solid var(--line);padding:16px;margin:0;overflow:auto;font-size:12px;line-height:1.7}code{font-family:Consolas,monospace}.api-links{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;margin-top:14px}footer{border-top:1px solid var(--line);padding:22px 0 30px;font-size:11px;color:var(--muted)}.foot{display:flex;justify-content:space-between;gap:20px}.error{color:#9c2929}
    @media(max-width:760px){.wrap{padding:0 20px}.nav{padding-top:16px;padding-bottom:16px;align-items:flex-start;flex-direction:column;gap:12px}nav{gap:23px}.intro{padding-top:28px}.checker{padding:18px}.checker form{grid-template-columns:1fr 1fr;gap:12px}.state-field{grid-column:1/-1}.checker button{padding:9px 12px}.layout{grid-template-columns:1fr;gap:28px}.developer{grid-template-columns:1fr;gap:12px}.foot{flex-direction:column;gap:5px}.list-meta{flex-wrap:wrap}.section-top h2{font-size:17px}.next{margin-bottom:22px}}
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header><div class="wrap nav"><a class="brand" href="/">Malaysia Public Holidays<small>Cuti umum · A community reference</small></a><nav aria-label="Main navigation"><a href="#explorer">Calendar</a><a href="#api">For developers</a><a href="https://github.com/amrlasyraf/MY-public-holiday-api">GitHub ↗</a></nav></div></header>
  <main class="wrap" id="main">
    <section class="intro"><p class="eyebrow">13 states · 3 federal territories</p><h1>Is it a public holiday?</h1><p>Check a date, or browse the holidays in your state.</p></section>
    <section class="checker" aria-label="Check a holiday">
      <form id="check-form"><div class="state-field"><label for="state">State or federal territory</label><select id="state" disabled><option value="selangor">Loading states…</option></select></div><div><label for="check-date">Date</label><input id="check-date" type="date" required></div><button id="check-button" type="submit" disabled>Check date</button></form>
      <div class="answer" id="answer" aria-live="polite"><p>Loading the calendar…</p></div>
      <p class="note">Declared holiday dates only. Replacement days and employer-specific days off are not included.</p>
    </section>
    <div class="layout">
      <section id="explorer" aria-label="Holiday calendar"><div class="section-top"><h2 id="result-title">Public holidays</h2><div class="year-field"><label for="year">Year</label><select id="year"><option>2026</option><option>2027</option></select></div></div><div class="list-meta"><span id="result-count">Loading…</span><a id="calendar-link" href="/v1/calendars/selangor.ics?year=2026">Download calendar (.ics)</a></div><div id="holiday-list" aria-live="polite">Loading holidays…</div></section>
      <aside>
        <section class="next" id="next-holiday" aria-live="polite"><h2>Next holiday · from today</h2><p>Loading…</p></section>
        <section class="aside-section"><h2>Recent updates</h2><div id="changes">Loading published updates…</div><a href="/v1/changes">View change history ↗</a></section>
        <section class="aside-section" id="sources"><h2>Where the dates come from</h2><p>Official federal and state schedules published by BKPP, Jabatan Perdana Menteri. Each holiday links to its source page.</p><p>Dates marked “Subject to change” remain provisional in the source schedule.</p><a href="/v1/sources">Source register ↗</a></section>
        <section class="aside-section"><h2>Spotted a missing holiday?</h2><p>Special declarations need a source and a review before they appear here.</p><a href="https://github.com/amrlasyraf/MY-public-holiday-api/issues">Report a correction on GitHub ↗</a></section>
      </aside>
    </div>
    <section class="developer" id="api"><div><h2>For developers</h2><p>The same records are available as JSON, with state filters, official source links, and a history of published changes. Free to use; no API key required.</p><div class="api-links"><a href="/openapi.json">OpenAPI specification</a><a href="/v1/status">Monitor status</a><a href="https://github.com/amrlasyraf/MY-public-holiday-api#readme">Documentation ↗</a></div></div><div><pre><code id="api-example">GET /v1/holidays?year=2026&amp;state=selangor</code></pre><p class="note">Use the calendar URL with “Subscribe by URL” in your calendar app to receive updates. Importing a downloaded file creates a one-time copy.</p></div></section>
  </main>
  <footer><div class="wrap foot"><span>An independent, open-source project. Not an official government website.</span><span>MIT licensed software · Informational use</span></div></footer>
  <noscript><p class="wrap">Enable JavaScript to use the checker, or <a href="/v1/holidays?year=2026">read the holiday records as JSON</a>.</p></noscript>
  <script>
    const $ = id => document.getElementById(id);
    const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const format = (value, options) => new Intl.DateTimeFormat('en-MY',{...options,timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
    const dateLabel = date => format(date,{day:'numeric',month:'long',year:'numeric'});
    let calendarRequest = 0, checkRequest = 0, nextRequest = 0;
    let states = [];
    $('check-date').value = today;
    if (['2026','2027'].includes(today.slice(0,4))) $('year').value = today.slice(0,4);
    async function json(path) {
      const response = await fetch(path);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load the records. Please try again.');
      return body;
    }
    function sourceLink(h) {
      if (!h.source || !h.source.url || !h.source.url.startsWith('https://')) return '';
      return '<a href="'+esc(h.source.url)+'#page='+Number(h.sourcePage)+'" target="_blank" rel="noopener noreferrer">Source · p. '+Number(h.sourcePage)+' ↗</a>';
    }
    async function checkDate() {
      const request = ++checkRequest;
      const date = $('check-date').value, state = $('state').value;
      if (!date) return;
      $('answer').innerHTML = '<p>Checking date…</p>';
      try {
        const body = await json('/v1/holidays/check?date='+encodeURIComponent(date)+'&state='+encodeURIComponent(state));
        if (request !== checkRequest) return;
        const active = body.holidays.filter(h => h.status !== 'cancelled');
        const tentative = active.length && active.every(h => h.status === 'provisional' || h.status === 'announced');
        const heading = active.length ? (tentative ? 'A holiday is listed, subject to confirmation.' : 'Yes, a public holiday is listed.') : 'No declared holiday is listed.';
        $('answer').innerHTML = '<h2>'+heading+'</h2><p>'+esc(dateLabel(date))+' · '+esc(body.jurisdiction.name)+'</p>'+active.map(h => '<p><strong>'+esc(h.nameMs)+'</strong> <span class="note">'+esc(h.nameEn)+'</span> '+sourceLink(h)+'</p>').join('');
      } catch (error) { if (request === checkRequest) $('answer').innerHTML = '<h2>Unable to confirm this date.</h2><p class="error">'+esc(error.message)+'</p>'; }
    }
    async function loadCalendar() {
      const request = ++calendarRequest;
      const year = $('year').value, state = $('state').value;
      $('holiday-list').textContent = 'Loading holidays…';
      $('result-count').textContent = '';
      $('result-title').textContent = (states.find(s => s.slug === state)?.name || 'Public')+' holidays';
      $('calendar-link').href = '/v1/calendars/'+encodeURIComponent(state)+'.ics?year='+year;
      $('api-example').textContent = 'GET /v1/holidays?year='+year+'&state='+state;
      try {
        const body = await json('/v1/holidays?year='+year+'&state='+encodeURIComponent(state));
        if (request !== calendarRequest) return;
        $('result-count').textContent = body.data.length+' declared records · '+year;
        let month = '';
        $('holiday-list').innerHTML = body.data.map(h => {
          const key = h.date.slice(0,7);
          const heading = key !== month ? '<h3 class="month">'+esc(format(h.date,{month:'long'}))+'</h3>' : '';
          month = key;
          const status = h.status === 'provisional' ? '<span class="provisional">Subject to change</span>' : h.status === 'announced' ? 'Announced' : h.status === 'cancelled' ? 'Cancelled' : '';
          return heading+'<article class="holiday"><time class="date" datetime="'+esc(h.date)+'">'+Number(h.date.slice(8))+'<small>'+esc(format(h.date,{weekday:'short'}))+'</small></time><div><h3 class="'+(h.status === 'cancelled' ? 'cancelled' : '')+'">'+esc(h.nameMs)+'</h3><p>'+esc(h.nameEn)+'</p><p class="record-note">'+sourceLink(h)+status+'</p></div></article>';
        }).join('') || '<p>No records available.</p>';
      } catch (error) { if (request === calendarRequest) $('holiday-list').innerHTML = '<p class="error">'+esc(error.message)+'</p>'; }
    }
    async function loadNext() {
      const request = ++nextRequest, state = $('state').value;
      $('next-holiday').innerHTML = '<h2>Next holiday · from today</h2><p>Loading…</p>';
      try {
        const years = ['2026','2027'].filter(year => year >= today.slice(0,4));
        const datasets = await Promise.all(years.map(year => json('/v1/holidays?year='+year+'&state='+encodeURIComponent(state))));
        if (request !== nextRequest) return;
        const upcoming = datasets.flatMap(d => d.data).filter(h => h.date >= today && h.status !== 'cancelled').sort((a,b) => a.date.localeCompare(b.date));
        const next = upcoming[0];
        $('next-holiday').innerHTML = '<h2>Next holiday · from today</h2>'+(next ? '<strong>'+esc(dateLabel(next.date))+'</strong>'+upcoming.filter(h => h.date === next.date).map(h => '<p>'+esc(h.nameMs)+(h.status === 'provisional' ? ' <span class="provisional">(subject to change)</span>' : '')+'</p>').join('') : '<p>No upcoming dates in the published calendars.</p>');
      } catch { if (request === nextRequest) $('next-holiday').innerHTML = '<h2>Next holiday</h2><p>Could not load upcoming dates.</p>'; }
    }
    async function loadChanges() {
      try {
        const body = await json('/v1/changes');
        $('changes').innerHTML = body.data.slice(0,3).map(change => '<div class="change"><time>'+esc(dateLabel(change.occurredAt.slice(0,10)))+'</time><p>'+esc(change.summary)+'</p></div>').join('') || '<p>No published changes yet.</p>';
      } catch { $('changes').textContent = 'Could not load published updates.'; }
    }
    async function setup() {
      const body = await json('/v1/jurisdictions');
      states = body.data;
      $('state').innerHTML = states.map(s => '<option value="'+esc(s.slug)+'"'+(s.slug === 'selangor' ? ' selected' : '')+'>'+esc(s.name)+'</option>').join('');
      $('state').disabled = false; $('check-button').disabled = false;
      await Promise.all([checkDate(),loadCalendar(),loadNext()]);
    }
    $('check-form').addEventListener('submit', event => { event.preventDefault(); checkDate(); });
    $('state').addEventListener('change', () => { checkDate(); loadCalendar(); loadNext(); });
    $('year').addEventListener('change', loadCalendar);
    setup().catch(() => { $('answer').innerHTML = '<p class="error">Could not load states. Please reload to try again.</p>'; $('holiday-list').textContent = 'Calendar unavailable.'; $('next-holiday').textContent = 'Upcoming dates unavailable.'; });
    loadChanges();
  </script>
</body>
</html>`;
