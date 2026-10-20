let c, DB, R, pick, dirty = false;
loadAll()
  .then(d => { c = d.c; DB = d.spells; R = casting(c); if (!R) throw new Error("not a caster"); pick = getPicks(c); init(); })
  .catch(() => { $("sheet").innerHTML = "<p class='loading'>Could not load spells, or this class has no spellcasting. <a href='index.html'>Back to the sheet</a></p>"; });

const castOf = s => castLevel(s, pick, R);

function init() {
  document.title = "Choose spells: " + c.name;
  $("sheet").innerHTML = `
  <header>
    <h1>${c.name}: choose spells</h1>
    <p>Level ${c.level} ${c.class}: spells up to ${ord(R.maxLevel)} level. Tick your spells, pick a higher cast level if you want one, then press Save.</p>
  </header>
  <div class="savebar">
    <div><span class="count" id="cc"></span> &nbsp; <span class="count" id="sc"></span><div class="hint" id="hint"></div></div>
    <div class="ctl"><button class="heal" id="save">Save spells</button><a class="btn ghost" href="index.html">Cancel</a><button class="ghost" id="reset">Reset</button><button class="ghost" id="dl">Download character.json</button></div>
  </div>
  <div class="filters">
    <input id="q" type="search" placeholder="Search spells" aria-label="Search spells">
    <select id="lv" aria-label="Filter by level"><option value="all">All levels</option>
      ${[...Array(R.maxLevel + 1).keys()].map(i => `<option value="${i}">${levelName(i)}</option>`).join("")}</select>
  </div>
  <div id="list"></div>`;
  $("q").oninput = $("lv").onchange = list;
  $("save").onclick = () => { savePicks(c, pick); dirty = false; location.href = "index.html"; };
  $("dl").onclick = () => downloadCharacter(c, pick);
  $("reset").onclick = () => { pick = seedPicks(c); dirty = true; list(); };
  $("list").onchange = e => {
    const i = e.target, n = i.dataset.n || i.dataset.c, s = DB.find(x => x.name === n);
    if (i.dataset.c) {
      if (+i.value > s.level) pick.casts[n] = +i.value; else delete pick.casts[n];
    } else {
      const a = s.level ? pick.spells : pick.cantrips;
      if (i.checked) a.push(n); else { a.splice(a.indexOf(n), 1); delete pick.casts[n]; }
    }
    dirty = true; refresh(i.closest(".pick"), s); sync();
  };
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  list();
}

function row(s) {
  const on = (s.level ? pick.spells : pick.cantrips).includes(s.name), cast = castOf(s);
  let opts = "";
  if (s.level && R.maxLevel > s.level) {
    for (let l = s.level; l <= R.maxLevel; l++) opts += `<option value="${l}" ${l === cast ? "selected" : ""}>${ord(l)} level</option>`;
    opts = `<label class="cast">Cast at <select data-c="${s.name}" ${on ? "" : "disabled"}>${opts}</select></label>`;
  }
  return `<div class="pick"><input type="checkbox" data-n="${s.name}" ${on ? "checked" : ""} data-l="${s.level}" aria-label="Select ${s.name}">${spellHtml(s, c.level, cast)}${opts}</div>`;
}

// Redraw one row's details (damage changes with the cast level) without closing it
function refresh(r, s) {
  const d = r.querySelector("details"), open = d.open;
  d.outerHTML = spellHtml(s, c.level, castOf(s));
  if (open) r.querySelector("details").open = true;
  const sel = r.querySelector("select");
  if (sel) { sel.disabled = !r.querySelector("input").checked; sel.value = castOf(s); }
}

function list() {
  const cls = c.class.toLowerCase(), q = $("q").value.toLowerCase(), lv = $("lv").value;
  const rows = DB.filter(s => s.classes.includes(cls) && s.level <= R.maxLevel
    && (lv === "all" || s.level == lv) && s.name.toLowerCase().includes(q)).sort(bylevel);
  let last = -1, h = "";
  rows.forEach(s => {
    if (s.level !== last) { last = s.level; h += `<h2>${levelName(s.level)}</h2>`; }
    h += row(s);
  });
  $("list").innerHTML = h || "<p>No spells match.</p>";
  sync();
}

function sync() {
  const full = [pick.cantrips.length >= R.cantrips, pick.spells.length >= R.spells];
  document.querySelectorAll("#list input").forEach(i => { i.disabled = !i.checked && full[i.dataset.l > 0 ? 1 : 0]; });
  $("cc").textContent = `Cantrips ${pick.cantrips.length}/${R.cantrips}`;
  $("sc").textContent = `${R.label} ${pick.spells.length}/${R.spells}`;
  const f = [full[0] && "Cantrip", full[1] && "Spell"].filter(Boolean);
  $("hint").textContent = f.length ? `${f.join(" and ")} limit reached. Untick a spell to swap it for another.` : "";
  $("save").textContent = dirty ? "Save changes" : "Save spells";
}
