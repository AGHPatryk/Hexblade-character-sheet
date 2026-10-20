let c, DB, R, pick;
loadAll()
  .then(d => { c = d.c; DB = d.spells; R = casting(c); if (!R) throw new Error("not a caster"); pick = getPicks(c); init(); })
  .catch(() => { $("sheet").innerHTML = "<p class='loading'>Could not load spells, or this class has no spellcasting. <a href='index.html'>Back to the sheet</a></p>"; });

function init() {
  document.title = "Choose spells: " + c.name;
  $("sheet").innerHTML = `
  <header>
    <h1>${c.name}: choose spells</h1>
    <div><a class="btn" href="index.html">Back to sheet</a>
      <p class="count"><span id="cc"></span> &nbsp; <span id="sc"></span></p>
      <p><small>Level ${c.level} ${c.class}: up to ${ord(R.maxLevel)}-level spells.</small></p></div>
  </header>
  <div class="filters">
    <input id="q" type="search" placeholder="Search spells" aria-label="Search spells">
    <select id="lv" aria-label="Filter by level"><option value="all">All levels</option>
      ${[...Array(R.maxLevel + 1).keys()].map(i => `<option value="${i}">${levelName(i)}</option>`).join("")}</select>
    <button class="ghost" id="reset">Reset to character.json</button>
  </div>
  <div id="list"></div>`;
  $("q").oninput = $("lv").onchange = list;
  $("reset").onclick = () => { resetPicks(c); pick = getPicks(c); list(); };
  $("list").onchange = e => {
    const i = e.target, a = i.dataset.l > 0 ? pick.spells : pick.cantrips;
    if (i.checked) a.push(i.dataset.n); else a.splice(a.indexOf(i.dataset.n), 1);
    savePicks(c, pick); sync();
  };
  list();
}

function list() {
  const cls = c.class.toLowerCase(), q = $("q").value.toLowerCase(), lv = $("lv").value;
  const rows = DB.filter(s => s.classes.includes(cls) && s.level <= R.maxLevel
    && (lv === "all" || s.level == lv) && s.name.toLowerCase().includes(q)).sort(bylevel);
  let last = -1, h = "";
  rows.forEach(s => {
    if (s.level !== last) { last = s.level; h += `<h2>${levelName(s.level)}</h2>`; }
    const on = (s.level ? pick.spells : pick.cantrips).includes(s.name);
    h += `<div class="pick"><input type="checkbox" data-n="${s.name}" data-l="${s.level}" ${on ? "checked" : ""} aria-label="Select ${s.name}">${spellHtml(s, c.level)}</div>`;
  });
  $("list").innerHTML = h || "<p>No spells match.</p>";
  sync();
}

function sync() {
  const full = [pick.cantrips.length >= R.cantrips, pick.spells.length >= R.spells];
  document.querySelectorAll("#list input").forEach(i => { i.disabled = !i.checked && full[i.dataset.l > 0 ? 1 : 0]; });
  $("cc").textContent = `Cantrips ${pick.cantrips.length}/${R.cantrips}`;
  $("sc").textContent = `${R.label} ${pick.spells.length}/${R.spells}`;
}
