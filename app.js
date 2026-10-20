const ABIL = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const SKILLS = [["Acrobatics","dex"],["Animal Handling","wis"],["Arcana","int"],["Athletics","str"],["Deception","cha"],["History","int"],["Insight","wis"],["Intimidation","cha"],["Investigation","int"],["Medicine","wis"],["Nature","int"],["Perception","wis"],["Performance","cha"],["Persuasion","cha"],["Religion","int"],["Sleight of Hand","dex"],["Stealth","dex"],["Survival","wis"]];
const mod = s => Math.floor((s - 10) / 2);
const fmt = n => (n >= 0 ? "+" : "") + n;
const $ = id => document.getElementById(id);
let c, hp, key;

fetch("character.json")
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => { c = d; start(); })
  .catch(() => { $("sheet").innerHTML = "<p class='loading'>Could not load character.json. Serve the folder over http (GitHub Pages or <code>python -m http.server</code>) rather than opening the file directly.</p>"; });

function start() {
  key = "hp:" + c.name;
  try { hp = JSON.parse(localStorage.getItem(key)); } catch (e) {}
  if (!hp || typeof hp.cur !== "number") hp = { cur: c.maxHp, temp: 0 };
  document.title = c.name + " – Character Sheet";
  render();
  updateHp();
}

function render() {
  const pb = 2 + Math.floor((c.level - 1) / 4);
  const m = a => mod(c.abilities[a]);
  const pip = on => `<span class="pip">${on ? "●" : "○"}</span>`;
  const skill = ([n, a]) => {
    const exp = (c.expertise || []).includes(n), prof = c.skills.includes(n);
    return { n, a, v: m(a) + (prof ? pb : 0) + (exp ? pb : 0), prof };
  };
  const skills = SKILLS.map(skill);
  const perception = skills.find(s => s.n === "Perception").v;
  const list = arr => "<ul>" + arr.map(x => `<li>${x}</li>`).join("") + "</ul>";

  $("sheet").innerHTML = `
  <header>
    <h1>${c.name}</h1>
    <div class="meta">
      <div><span class="lbl">Class &amp; level</span>${c.class} ${c.level}${c.subclass ? " (" + c.subclass + ")" : ""}</div>
      <div><span class="lbl">Background</span>${c.background}</div>
      <div><span class="lbl">Race</span>${c.race}</div>
      <div><span class="lbl">Alignment</span>${c.alignment}</div>
      <div><span class="lbl">Experience</span>${c.xp}</div>
      <div><span class="lbl">Proficiency bonus</span>${fmt(pb)}</div>
    </div>
  </header>
  <main>
    <section>
      <div class="abil">${Object.keys(ABIL).map(a => `
        <div class="ab"><span class="lbl">${ABIL[a]}</span><div class="mod">${fmt(m(a))}</div><div class="score">${c.abilities[a]}</div></div>`).join("")}
      </div>
      <div class="panel" style="margin-top:1.4rem"><h2>Saving throws</h2>
        ${Object.keys(ABIL).map(a => { const p = c.saves.includes(a);
          return `<div class="row"><span>${pip(p)}${ABIL[a]}</span><b>${fmt(m(a) + (p ? pb : 0))}</b></div>`; }).join("")}
      </div>
      <div class="panel"><h2>Skills</h2>
        ${skills.map(s => `<div class="row"><span>${pip(s.prof)}${s.n} <small>(${s.a})</small></span><b>${fmt(s.v)}</b></div>`).join("")}
      </div>
    </section>
    <section>
      <div class="stats">
        <div class="stat"><span class="lbl">Armor class</span><b>${c.ac}</b></div>
        <div class="stat"><span class="lbl">Initiative</span><b>${fmt(m("dex"))}</b></div>
        <div class="stat"><span class="lbl">Speed</span><b>${c.speed} ft</b></div>
      </div>
      <div class="panel" style="margin-top:.8rem">
        <div class="hp-top"><h2 style="flex:1">Hit points</h2></div>
        <div class="hp-main">
          <div><span class="lbl">Current</span><input id="cur" type="number" inputmode="numeric" aria-label="Current hit points"></div>
          <div><span class="lbl">Maximum</span><div class="max">${c.maxHp}</div></div>
          <div><span class="lbl">Temporary</span><input id="temp" type="number" inputmode="numeric" min="0" aria-label="Temporary hit points"></div>
        </div>
        <div class="bar" aria-hidden="true"><i id="fill"></i></div>
        <div class="ctl">
          <input id="amt" type="number" inputmode="numeric" min="0" placeholder="Amount" aria-label="Amount">
          <button class="dmg" id="dmg">Damage</button>
          <button class="heal" id="heal">Heal</button>
          <button id="addTemp">Set temp HP</button>
          <button class="ghost" id="rest">Long rest</button>
        </div>
        <p style="margin-top:.5rem"><span class="lbl" style="display:inline">Hit dice</span> ${c.level}${c.hitDie}</p>
      </div>
      <div class="panel"><h2>Attacks</h2>
        ${c.attacks.map(a => { const bonus = m(a.ability) + (a.proficient ? pb : 0);
          return `<div class="atk"><span>${a.name}</span><b>${fmt(bonus)}</b><span>${a.damage}${m(a.ability) ? fmt(m(a.ability)) : ""} ${a.type}</span></div>`; }).join("")}
      </div>
      <div class="panel"><div class="row"><span>Passive Wisdom (Perception)</span><b>${10 + perception}</b></div></div>
    </section>
    <section>
      <div class="panel"><h2>Personality</h2><p>${c.personality}</p></div>
      <div class="panel"><h2>Equipment</h2>${list(c.equipment)}</div>
      <div class="panel"><h2>Features &amp; traits</h2>${list(c.features)}</div>
    </section>
  </main>`;

  const amount = () => Math.max(0, parseInt($("amt").value) || 0);
  $("dmg").onclick = () => {
    let a = amount(), soak = Math.min(hp.temp, a);
    hp.temp -= soak; hp.cur -= a - soak; done();
  };
  $("heal").onclick = () => { hp.cur += amount(); done(); };
  $("addTemp").onclick = () => { hp.temp = Math.max(hp.temp, amount()); done(); };
  $("rest").onclick = () => { hp = { cur: c.maxHp, temp: 0 }; done(); };
  $("cur").onchange = e => { hp.cur = parseInt(e.target.value) || 0; done(); };
  $("temp").onchange = e => { hp.temp = parseInt(e.target.value) || 0; done(); };
  $("amt").onkeydown = e => { if (e.key === "Enter") $("dmg").click(); };
}

function done() { $("amt").value = ""; updateHp(); }

function updateHp() {
  hp.cur = Math.min(Math.max(hp.cur, 0), c.maxHp);
  hp.temp = Math.max(hp.temp, 0);
  $("cur").value = hp.cur;
  $("temp").value = hp.temp;
  const pct = hp.cur / c.maxHp * 100, f = $("fill");
  f.style.width = pct + "%";
  f.style.background = pct > 50 ? "#3e7d32" : pct > 25 ? "#c08a1a" : "#a12222";
  try { localStorage.setItem(key, JSON.stringify(hp)); } catch (e) {}
}
