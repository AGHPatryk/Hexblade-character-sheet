const mod = s => Math.floor((s - 10) / 2);
const fmt = n => (n >= 0 ? "+" : "") + n;
const $ = id => document.getElementById(id);
const ord = n => n + (["th", "st", "nd", "rd"][n] || "th");
const prof = L => 2 + Math.floor((L - 1) / 4);

// Spell slots per spell level for full casters, indexed by character level
const SLOTS = [null,[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
// mode "prepared": ability mod + level. mode "known": fixed table by level.
const CASTERS = {
  wizard:   { ab: "int", cantrips: 3, mode: "prepared" },
  cleric:   { ab: "wis", cantrips: 3, mode: "prepared" },
  druid:    { ab: "wis", cantrips: 3, mode: "prepared" },
  sorcerer: { ab: "cha", cantrips: 4, mode: "known", table: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,15,15,15,16,16] },
  bard:     { ab: "cha", cantrips: 2, mode: "known", table: [4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22] }
};

function casting(c) {
  const r = CASTERS[c.class.toLowerCase()];
  if (!r) return null;
  const L = c.level, m = mod(c.abilities[r.ab]);
  return {
    ab: r.ab, slots: SLOTS[L], maxLevel: SLOTS[L].length,
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

// Chosen spells live in the browser; character.json provides the starting selection
const pickKey = c => "spells:" + c.name;
function getPicks(c) {
  try { const p = JSON.parse(localStorage.getItem(pickKey(c))); if (p) return p; } catch (e) {}
  const s = c.spellcasting || {};
  return { cantrips: [...(s.cantrips || [])], spells: [...(s.spells || [])] };
}
function savePicks(c, p) { try { localStorage.setItem(pickKey(c), JSON.stringify(p)); } catch (e) {} }
function resetPicks(c) { try { localStorage.removeItem(pickKey(c)); } catch (e) {} }

const bylevel = (a, b) => a.level - b.level || a.name.localeCompare(b.name);
const levelName = n => n ? ord(n) + " level" : "Cantrips";

// Cantrip damage grows at character levels 5, 11 and 17
function dmg(s, L) {
  if (!s.damage) return "";
  if (s.level) return s.damage;
  const tier = 1 + (L >= 5) + (L >= 11) + (L >= 17);
  return s.damage.replace(/^(\d+)d/, (m, n) => n * tier + "d");
}

function spellHtml(s, L) {
  const check = s.save ? s.save + " save" : s.attack ? s.attack + " spell attack" : "None";
  const rows = [
    ["Level", s.level ? ord(s.level) + "-level " + s.school : s.school + " cantrip"],
    ["Casting time", s.time], ["Range", s.range], ["Components", s.components],
    ["Duration", s.duration], ["Save or attack", check]
  ];
  return `<details class="spell"><summary><b>${s.name}</b><span>${dmg(s, L) || "No damage"}</span><span>${s.type || ""}</span></summary>
    <p>${s.desc}</p>${s.higher ? `<p><em>At higher levels:</em> ${s.higher}</p>` : ""}
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></details>`;
}
