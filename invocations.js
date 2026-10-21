let c, DB, INV, sp, pick, dirty = false;
loadAll()
  .then(d => { c = d.c; DB = d.spells; INV = d.invs; if (!invLimit(c) || !INV.length) throw new Error("none"); sp = getPicks(c); pick = getInv(c); init(); })
  .catch(() => { $("sheet").innerHTML = "<p class='loading'>Could not load invocations, or this class has none. <a href='index.html'>Back to the sheet</a></p>"; });

const byName = n => INV.find(v => v.name === n);
const needers = n => pick.picks.filter(p => (byName(p).requires || []).includes(n));
const cantripChoices = v => sp.cantrips.map(n => DB.find(s => s.name === n)).filter(s => s && s.damage
  && (v.cantrip !== "attack" || s.attack) && (!v.farRange || !/^(Self|Touch)/.test(s.range))).map(s => s.name);

function init() {
  document.title = "Choose invocations: " + c.name;
  $("sheet").innerHTML = `
  <header>
    <h1>${c.name}: eldritch invocations</h1>
    <p>Level ${c.level} Warlock: ${invLimit(c)} invocations known. Tick your invocations, then press Save.</p>
  </header>
  <div class="savebar">
    <div><span class="count" id="cc"></span><div class="hint" id="hint"></div></div>
    <div class="ctl"><button class="heal" id="save">Save invocations</button><a class="btn ghost" href="index.html">Cancel</a><button class="ghost" id="reset">Reset</button><button class="ghost" id="dl">Download character.json</button></div>
  </div>
  <div class="filters"><input id="q" type="search" placeholder="Search invocations" aria-label="Search invocations"></div>
  <div id="list"></div>`;
  $("q").oninput = list;
  $("save").onclick = () => { saveInv(c, pick); dirty = false; location.href = "index.html"; };
  $("dl").onclick = () => downloadCharacter(c, sp, pick);
  $("reset").onclick = () => { pick = seedInv(c); dirty = true; list(); };
  $("list").onchange = e => {
    const i = e.target;
    if (i.dataset.c) { pick.notes[i.dataset.c] = i.value; dirty = true; sync(); return; }
    const n = i.dataset.n, v = byName(n);
    if (i.checked) { pick.picks.push(n); if (v.choose === "cantrip") pick.notes[n] = cantripChoices(v)[0] || ""; }
    else { pick.picks.splice(pick.picks.indexOf(n), 1); delete pick.notes[n]; }
    dirty = true; list();
  };
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  list();
}

function row(v) {
  const on = pick.picks.includes(v.name), bad = invProblems(v, c, pick, sp, DB), by = on ? needers(v.name) : [];
  const dis = on ? by.length > 0 : bad.length > 0 || pick.picks.length >= invLimit(c);
  const note = !on && bad.length ? "Requires " + bad.join(", ") : on && bad.length ? "Prerequisite no longer met: " + bad.join(", ") : by.length ? "Needed by " + by.join(", ") : "";
  let ctl = "";
  if (on && v.choose === "cantrip") ctl = `<label class="cast">Applies to <select data-c="${v.name}">${cantripChoices(v).map(o => `<option ${pick.notes[v.name] === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
  else if (on && v.choose === "feat") ctl = `<label class="cast">Feat <input data-c="${v.name}" value="${pick.notes[v.name] || ""}" placeholder="Origin feat"></label>`;
  return `<div class="pick${!on && bad.length ? " dim" : ""}"><input type="checkbox" data-n="${v.name}" ${on ? "checked" : ""} ${dis ? "disabled" : ""} aria-label="Select ${v.name}">${invHtml(v, "")}${ctl}${note ? `<div class="invnote">${note}</div>` : ""}</div>`;
}

function list() {
  const open = [...document.querySelectorAll("#list details[open] b")].map(b => b.textContent);
  const q = $("q").value.toLowerCase();
  const rows = INV.filter(v => v.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  $("list").innerHTML = rows.map(row).join("") || "<p>No invocations match.</p>";
  document.querySelectorAll("#list details").forEach(d => { if (open.includes(d.querySelector("b").textContent)) d.open = true; });
  sync();
}

function sync() {
  const n = pick.picks.length, lim = invLimit(c);
  $("cc").textContent = `Invocations ${n}/${lim}`;
  $("hint").textContent = n >= lim ? "Limit reached. Untick an invocation to swap it for another." : "";
  $("save").textContent = dirty ? "Save changes" : "Save invocations";
}
