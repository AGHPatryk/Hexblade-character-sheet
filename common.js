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
  const [c, spells, invs] = await Promise.all([get("character.json"), get("spells.json"), get("invocations.json").catch(() => [])]);
  return { c, spells, invs };
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
    return s.beams ? `${t} × ${s.damage}` : s.damage.replace(/(\d+)d/g, (m, n) => n * t + "d");
  }
  const extra = Math.floor(((cast || s.level) - s.level) / (s.every || 1));
  const parts = s.damage.split(" + ");
  if (s.up && extra > 0) {
    // "up" is extra dice per step ("1d6") or a flat amount ("5"); part picks which term grows
    const dice = s.up.includes("d"), n = parseInt(s.up);
    parts.forEach((p, k) => {
      if (s.part !== "all" && k !== (s.part || 0)) return;
      parts[k] = dice ? p.replace(/^(\d+)d/, (m, x) => (+x + n * extra) + "d") : p.replace(/^\d+$/, x => +x + n * extra);
    });
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

// Saves character.json with the given picks merged in, ready to commit to the repo
function downloadCharacter(c, p, inv = invLimit(c) ? getInv(c) : null) {
  const out = { ...c, spellcasting: { ...(c.spellcasting || {}), cantrips: p.cantrips, spells: p.spells, casts: p.casts } };
  if (inv) out.invocations = inv;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" }));
  a.download = "character.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- Warlock Eldritch Invocations ----
const INV_COUNT = [0,1,3,3,3,5,5,6,6,7,7,7,8,8,8,9,9,9,10,10,10]; // known, by Warlock level
const invLimit = c => c.class.toLowerCase() === "warlock" ? INV_COUNT[c.level] : 0;
const invKey = c => "inv:" + c.name;
function seedInv(c) { const s = c.invocations || {}; return { picks: [...(s.picks || [])], notes: { ...(s.notes || {}) } }; }
function getInv(c) {
  try { const p = JSON.parse(localStorage.getItem(invKey(c))); if (p) return { picks: p.picks || [], notes: p.notes || {} }; } catch (e) {}
  return seedInv(c);
}
function saveInv(c, p) { try { localStorage.setItem(invKey(c), JSON.stringify(p)); } catch (e) {} }

// What an invocation still needs: level, other invocations, known cantrips or spells
function invProblems(v, c, inv, sp, DB) {
  const out = [], known = sp.cantrips.map(n => DB.find(s => s.name === n)).filter(Boolean);
  if (v.level && c.level < v.level) out.push(`Level ${v.level}+ Warlock`);
  (v.requires || []).forEach(r => { if (!inv.picks.includes(r)) out.push(r); });
  if (v.cantrip === "damage" && !known.some(s => s.damage)) out.push("a damaging Warlock cantrip");
  if (v.cantrip === "attack" && !known.some(s => s.damage && s.attack)) out.push("a damaging cantrip that uses an attack roll");
  if (v.cantrip && !["damage", "attack"].includes(v.cantrip) && !sp.cantrips.includes(v.cantrip)) out.push(v.cantrip + " cantrip");
  if (v.spell && !sp.spells.includes(v.spell)) out.push(v.spell + " spell");
  return out;
}
function prereqText(v) {
  const t = [];
  if (v.level) t.push(`Level ${v.level}+`);
  if (v.requires) t.push(...v.requires);
  if (v.cantrip === "damage") t.push("damaging cantrip");
  else if (v.cantrip === "attack") t.push("attack-roll cantrip");
  else if (v.cantrip) t.push(v.cantrip + " cantrip");
  if (v.spell) t.push(v.spell + " spell");
  return t.join(", ");
}
function invHtml(v, note) {
  return `<details class="spell"><summary><b>${v.name}${note ? ` <small>(${note})</small>` : ""}</b><span>${prereqText(v) || "No prerequisite"}</span><span>${v.source}</span></summary>
    <p>${v.desc}</p>${v.repeatable ? "<p><em>Repeatable</em> with a different choice each time.</p>" : ""}</details>`;
}
