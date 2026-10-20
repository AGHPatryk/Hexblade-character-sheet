const mod = s => Math.floor((s - 10) / 2);
const fmt = n => (n >= 0 ? "+" : "") + n;
const $ = id => document.getElementById(id);
const ord = n => n + (["th", "st", "nd", "rd"][n] || "th");
const prof = L => 2 + Math.floor((L - 1) / 4);

// Spell slots per spell level for full casters, indexed by character level
const SLOTS = [null,[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
// Warlock Pact Magic: all slots are the same level (max 5th), and there are only a few
const pactSlots = L => {
  const lvl = Math.min(5, Math.ceil(L / 2)), a = Array(lvl).fill(0);
  a[lvl - 1] = L === 1 ? 1 : L < 11 ? 2 : L < 17 ? 3 : 4;
  return a;
};
// mode "prepared": ability mod + level. mode "known": fixed table by level.
const CASTERS = {
  wizard:   { ab: "int", cantrips: 3, mode: "prepared" },
  cleric:   { ab: "wis", cantrips: 3, mode: "prepared" },
  druid:    { ab: "wis", cantrips: 3, mode: "prepared" },
  sorcerer: { ab: "cha", cantrips: 4, mode: "known", table: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,15,15,15,16,16] },
  bard:     { ab: "cha", cantrips: 2, mode: "known", table: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22] },
  warlock:  { ab: "cha", cantrips: 2, mode: "known", pact: true, table: [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15] }
};

function casting(c) {
  const r = CASTERS[c.class.toLowerCase()];
  if (!r) return null;
  const L = c.level, m = mod(c.abilities[r.ab]), slots = r.pact ? pactSlots(L) : SLOTS[L];
  return {
    ab: r.ab, slots, maxLevel: slots.length, pact: !!r.pact,
    cantrips: r.cantrips + (L >= 4) + (L >= 10),
    spells: r.mode === "known" ? r.table[L - 1] : Math.max(1, m + L),
    label: r.mode === "known" ? "Spells known" : "Spells prepared",
    dc: 8 + prof(L) + m, atk: prof(L) + m
  };
}

async function loadAll() {
  const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const [c, spells] = await Promise.all([get("character.json"), get("spells.json")]);
  return { c, spells };
}

// Chosen spells live in the browser; character.json provides the starting selection.
// casts maps a spell name to the level it is cast at, when higher than its own level.
const pickKey = c => "spells:" + c.name;
function seedPicks(c) {
  const s = c.spellcasting || {};
  return { cantrips: [...(s.cantrips || [])], spells: [...(s.spells || [])], casts: { ...(s.casts || {}) } };
}
function getPicks(c) {
  try {
    const p = JSON.parse(localStorage.getItem(pickKey(c)));
    if (p) return { cantrips: p.cantrips || [], spells: p.spells || [], casts: p.casts || {} };
  } catch (e) {}
  return seedPicks(c);
}
function savePicks(c, p) { try { localStorage.setItem(pickKey(c), JSON.stringify(p)); } catch (e) {} }
function resetPicks(c) { try { localStorage.removeItem(pickKey(c)); } catch (e) {} }
const castLevel = (s, p, R) => s.level ? Math.min(Math.max(p.casts[s.name] || s.level, s.level), R.maxLevel) : 0;

const bylevel = (a, b) => a.level - b.level || a.name.localeCompare(b.name);
const levelName = n => n ? ord(n) + " level" : "Cantrips";

// Damage text. Cantrips grow with character level L; leveled spells grow with the level they are cast at.
function dmg(s, L, cast) {
  if (!s.damage) return "";
  if (!s.level) {
    const t = 1 + (L >= 5) + (L >= 11) + (L >= 17);
    return s.beams ? `${t} × ${s.damage}` : s.damage.replace(/^(\d+)d/, (m, n) => n * t + "d");
  }
  const extra = Math.floor(((cast || s.level) - s.level) / (s.every || 1));
  const parts = s.damage.split(" + ");
  if (s.up && extra > 0) {
    const n = parseInt(s.up), k = s.part || 0;
    parts[k] = parts[k].replace(/^(\d+)d/, (m, x) => (+x + n * extra) + "d");
  }
  const t = parts.join(" + ");
  return s.count ? `${s.count + (s.upCount || 0) * extra} × ${t.includes("+") ? "(" + t + ")" : t}` : t;
}

function spellHtml(s, L, cast) {
  cast = cast || s.level;
  const up = cast > s.level;
  const check = s.save ? s.save + " save" : s.attack ? s.attack + " spell attack" : "None";
  const rows = [
    ["Level", s.level ? ord(s.level) + "-level " + s.school + (up ? `, cast at ${ord(cast)} level` : "") : s.school + " cantrip"],
    ["Casting time", s.time], ["Range", s.range], ["Components", s.components],
    ["Duration", s.duration], ["Save or attack", check]
  ];
  return `<details class="spell"><summary><b>${s.name}${up ? ` <small>(${ord(cast)} level)</small>` : ""}</b><span>${dmg(s, L, cast) || "No damage"}</span><span>${s.type || ""}</span></summary>
    <p>${s.desc}</p>${s.higher ? `<p><em>At higher levels:</em> ${s.higher}</p>` : ""}
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></details>`;
}

// Saves character.json with the given spell picks merged in, ready to commit to the repo
function downloadCharacter(c, p) {
  const out = { ...c, spellcasting: { ...(c.spellcasting || {}), cantrips: p.cantrips, spells: p.spells, casts: p.casts } };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" }));
  a.download = "character.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
