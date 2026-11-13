// DOM menus. One root, screens swapped by innerHTML. Keyboard + pointer. Pure view: calls back into the game.
import { LEVELS, WORLDS, levelsOf } from './levels.js';
import { SKINS, TRAILS, SHOP, levelFromXp, totalStars, meets, reqText } from './progression.js';
import { dailySeed } from './rng.js';

const star = (on) => `<span class="star ${on ? 'on' : ''}">★</span>`;
export class Menu {
  constructor(root, game) { this.root = root; this.game = game; this.stack = []; root.addEventListener('click', (e) => this.onClick(e)); }
  get p() { return this.game.profile; }
  show(screen, data) { this.stack.push([screen, data]); this.render(screen, data); this.root.classList.remove('hidden'); this.game.demo(screen === 'customize'); }
  back() { this.stack.pop(); const top = this.stack[this.stack.length - 1]; if (top) { this.render(...top); this.game.demo(top[0] === 'customize'); } else this.show('main'); }
  hide() { this.stack = []; this.root.classList.add('hidden'); this.root.innerHTML = ''; this.game.demo(false); }
  get visible() { return !this.root.classList.contains('hidden'); }
  xpBar() { const { lvl, into, need } = levelFromXp(this.p.xp); return `<div class="xp"><div class="xpl">LVL ${lvl}</div><div class="xpbar"><div class="xpfill" style="width:${Math.min(100, into / need * 100)}%"></div></div><div class="xpn">${into} / ${need}</div><div class="xps">★ ${totalStars(this.p)}</div><div class="coins">◉ ${this.p.coins}</div></div>`; }
  render(screen, data) {
    const r = this.root; r.dataset.screen = screen;
    if (screen === 'main') {
      const d = this.p.daily.date === dailySeed() ? this.p.daily.best : 0;
      r.innerHTML = `<div class="logo"><h1>SWINGBY</h1><div class="tag">HOLD TO ORBIT · RELEASE TO FLY</div></div>
      ${this.xpBar()}
      <div class="btns">
        <button data-a="worlds" class="big">PLAY <span class="sm">${this.levelsDone()} / ${LEVELS.length}</span></button>
        <button data-a="endless">ENDLESS <span class="sm">best ${this.p.endless.best}</span></button>
        <button data-a="daily">DAILY ${dailySeed()} <span class="sm">${d ? 'best ' + d : 'not played'}</span></button>
        <button data-a="customize">CUSTOMIZE</button>
        <button data-a="shop">SHOP <span class="sm">◉ ${this.p.coins}</span></button>
        <button data-a="settings">SETTINGS</button>
      </div>`;
    } else if (screen === 'worlds') {
      r.innerHTML = `<div class="hdr"><button data-a="back">‹</button><h2>WORLDS</h2>${this.xpBar()}</div><div class="grid worlds">` + WORLDS.map((W) => {
        const ls = levelsOf(W.id); const done = ls.filter(l => this.p.levels[l.id]?.completed).length; const stars = ls.reduce((a, l) => a + (this.p.levels[l.id]?.stars || 0), 0);
        const locked = !this.worldUnlocked(W); const col = `hsl(${W.hue * 360} 80% 65%)`;
        return `<button class="wd ${locked ? 'locked' : ''}" data-a="levels" data-world="${W.id}" ${locked ? 'disabled' : ''} style="--wc:${col}"><div class="n">${W.id}</div><div class="nm">${W.name}</div><div class="meta">${locked ? 'beat the previous boss' : W.blurb}</div><div class="meta">${done}/${ls.length} · ★ ${stars}/${ls.length * 3}</div></button>`; }).join('') + `</div>`;
    } else if (screen === 'levels') {
      const W = WORLDS[(data?.world || 1) - 1]; const col = `hsl(${W.hue * 360} 80% 65%)`;
      r.innerHTML = `<div class="hdr"><button data-a="back">‹</button><h2 style="color:${col}">${W.name}</h2>${this.xpBar()}</div><div class="grid" style="--wc:${col}">` + levelsOf(W.id).map((L) => {
        const st = this.p.levels[L.id] || {}; const locked = !this.unlocked(L);
        const tags = [L.boss ? 'BOSS' : '', L.mods.gravity ? (L.mods.gravity > 0 ? 'WIND →' : '← WIND') : '', L.mods.spikes ? 'SPIKES' : '', L.mods.portals ? 'PORTALS' : '', L.mods.wrap ? 'NO WALLS' : '', L.mods.moving ? 'DRIFT' : ''].filter(Boolean).join(' · ');
        return `<button class="lv ${locked ? 'locked' : ''} ${st.completed ? 'done' : ''} ${L.boss ? 'boss' : ''}" data-a="level" data-id="${L.id}" ${locked ? 'disabled' : ''}>
          <div class="n">${String(L.id).padStart(2, '0')}</div><div class="nm">${L.name}</div><div class="tags">${tags}</div>
          <div class="stars">${star(st.stars >= 1)}${star(st.stars >= 2)}${star(st.stars >= 3)}</div>
          <div class="meta">${locked ? '' : (st.bestScore ? st.bestScore : '')}</div></button>`; }).join('') + `</div>`;
    } else if (screen === 'customize') {
      const item = (it, kind) => { const un = this.p.unlocked.includes(it.id); const eq = this.p.equipped[kind] === it.id;
        const sw = kind === 'skin' ? `<span class="sw" style="background:#${it.emissive.toString(16).padStart(6, '0')};box-shadow:0 0 14px #${it.trail.toString(16).padStart(6, '0')}"></span>` : `<span class="sw tr" style="height:${4 + it.width * 24}px;width:${20 + it.len / 4}px"></span>`;
        return `<button class="it ${un ? '' : 'locked'} ${eq ? 'eq' : ''}" data-a="equip" data-kind="${kind}" data-id="${it.id}" ${un ? '' : 'disabled'}>${sw}<div class="nm">${it.name}</div><div class="meta">${un ? (eq ? '●' : '') : reqText(it.req)}</div></button>`; };
      r.innerHTML = `<div class="panel"><div class="hdr"><button data-a="back">‹</button><h2>CUSTOMIZE</h2></div>
        <h3>COMET</h3><div class="grid small">${SKINS.map(s => item(s, 'skin')).join('')}</div>
        <h3>TRAIL</h3><div class="grid small">${TRAILS.map(t => item(t, 'trail')).join('')}</div></div><div class="preview"></div>`;
    } else if (screen === 'shop') {
      const row = (it) => {
        if (it.kind === 'item') { const have = this.p.items[it.id] || 0; const can = this.p.coins >= it.price && have < it.max;
          return `<button class="it ${can ? '' : 'locked'}" data-a="buy" data-id="${it.id}" ${can ? '' : 'disabled'}><div class="nm">${it.name} <span class="sm">×${have}</span></div><div class="meta">${it.desc}</div><div class="price">◉ ${it.price}</div></button>`; }
        const def = (it.kind === 'skin' ? SKINS : TRAILS).find(d => d.id === it.id); const owned = this.p.unlocked.includes(it.id); const can = !owned && this.p.coins >= it.price;
        const sw = it.kind === 'skin' ? `<span class="sw" style="background:#${def.emissive.toString(16).padStart(6, '0')}"></span>` : `<span class="sw tr"></span>`;
        return `<button class="it ${can ? '' : 'locked'} ${owned ? 'eq' : ''}" data-a="buy" data-id="${it.id}" ${can ? '' : 'disabled'}>${sw}<div class="nm">${def.name}</div><div class="meta">${it.kind}</div><div class="price">${owned ? 'OWNED' : '◉ ' + it.price}</div></button>`; };
      r.innerHTML = `<div class="hdr"><button data-a="back">‹</button><h2>SHOP</h2>${this.xpBar()}</div>
        <h3>BOOSTS · used automatically on your next run</h3><div class="grid small">${SHOP.filter(i => i.kind === 'item').map(row).join('')}</div>
        <h3>COSMETICS</h3><div class="grid small">${SHOP.filter(i => i.kind !== 'item').map(row).join('')}</div>`;
    } else if (screen === 'settings') {
      const s = this.p.settings; const tog = (k, label) => `<button class="tg ${s[k] ? 'on' : ''}" data-a="toggle" data-k="${k}">${label}<span class="sm">${s[k] ? 'ON' : 'OFF'}</span></button>`;
      r.innerHTML = `<div class="hdr"><button data-a="back">‹</button><h2>SETTINGS</h2></div><div class="btns">
        ${tog('shake', 'SCREEN SHAKE')}${tog('flash', 'FLASHES')}${tog('reduceMotion', 'REDUCE MOTION')}${tog('mute', 'MUTE')}
        <button data-a="reset" class="danger">RESET PROFILE</button></div>
        `;
    } else if (screen === 'results') {
      const d = data; const L = d.level; const st = this.p.levels[L.id];
      r.innerHTML = `<div class="logo"><h1 class="win">${d.won ? 'CLEAR' : 'LOST'}</h1><div class="tag">${L.id}. ${L.name}${d.won ? '' : ' · ' + d.cause}</div></div>
        <div class="stars big">${star(d.stars >= 1)}${star(d.stars >= 2)}${star(d.stars >= 3)}</div>
        <div class="goals"><div class="${d.won ? 'ok' : ''}">reach the gate</div><div class="${d.sparkOk ? 'ok' : ''}">sparks ${d.sparks} / ${d.sparkNeed}</div><div class="${d.periOk ? 'ok' : ''}">perihelia ${d.peris} / ${L.periGoal}</div></div>
        <div class="row"><div><div class="k">SCORE</div><div class="v">${d.score}</div></div><div><div class="k">BEST</div><div class="v">${st?.bestScore || 0}</div></div><div><div class="k">XP</div><div class="v">+${d.xp}</div></div></div>
        ${this.xpBar()}
        ${d.unlocks.length ? `<div class="unl">UNLOCKED: ${d.unlocks.map(u => u.name).join(' · ')}</div>` : ''}
        <div class="btns row2">${d.won && LEVELS[L.id] ? `<button data-a="level" data-id="${L.id + 1}" class="big">NEXT ›</button>` : ''}<button data-a="level" data-id="${L.id}">RETRY</button><button data-a="main">MENU</button></div>`;
    } else if (screen === 'pause') {
      r.innerHTML = `<div class="tapzone" data-a="resume"><div class="logo"><h1>SWINGBY</h1><div class="tag">TAP TO RESUME</div></div></div><div class="btns row2 corner"><button data-a="retry">RETRY</button><button data-a="main">MENU</button></div>`;
    } else if (screen === 'dead') {
      const d = data;
      r.innerHTML = `<div class="tapzone" data-a="${d.mode === 'endless' ? 'endless' : 'retry'}"><div class="logo"><h1 class="${d.newBest ? 'win' : ''}">${d.score}</h1><div class="tag">${d.newBest ? 'NEW BEST · ' : 'BEST ' + d.best + ' · '}TAP TO RETRY</div></div><div class="xpmini">+${d.xp} XP · +${d.coins} ◉</div>
        ${d.unlocks.length ? `<div class="unl">NEW: ${d.unlocks.map(u => u.name).join(' · ')}</div>` : ''}</div>
        <div class="btns row2 corner"><button data-a="main">MENU</button></div>`;
    }
  }
  levelsDone() { return LEVELS.filter(L => this.p.levels[L.id]?.completed).length; }
  worldUnlocked(W) { if (W.id === 1) return true; const prevBoss = levelsOf(W.id - 1).find(l => l.boss); return !!this.p.levels[prevBoss.id]?.completed; }
  unlocked(L) { if (!this.worldUnlocked(WORLDS[L.world - 1])) return false; const ls = levelsOf(L.world); const i = ls.indexOf(L); return i === 0 || !!this.p.levels[ls[i - 1].id]?.completed; }
  onClick(e) {
    const b = e.target.closest('button,.tapzone'); if (!b || b.disabled) return; const a = b.dataset.a; const g = this.game;
    if (a === 'resume') g.resume(); else if (a === 'back') this.back(); else if (a === 'main') { this.stack = []; g.abandon(); this.show('main'); }
    else if (a === 'levels') this.show('levels', { world: Number(b.dataset.world) });
    else if (a === 'worlds' || a === 'customize' || a === 'settings' || a === 'shop') this.show(a);
    else if (a === 'buy') { g.buy(b.dataset.id); this.render('shop'); }
    else if (a === 'endless') g.play('endless'); else if (a === 'daily') g.play('daily'); else if (a === 'retry') g.retry();
    else if (a === 'level') g.play('level', Number(b.dataset.id));
    else if (a === 'equip') { this.p.equipped[b.dataset.kind] = b.dataset.id; g.saveNow(); g.applyCosmetics(); this.render('customize'); }
    else if (a === 'toggle') { const k = b.dataset.k; this.p.settings[k] = !this.p.settings[k]; g.saveNow(); g.applySettings(); this.render('settings'); }
    else if (a === 'reset') { if (confirm('Reset all progress, XP and unlocks?')) { g.resetProfile(); this.stack = []; this.show('main'); } }
  }
}
