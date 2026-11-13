// DOM menus. One root, screens swapped by innerHTML. Keyboard + pointer. Pure view: calls back into the game.
import { LEVELS } from './levels.js';
import { SKINS, TRAILS, levelFromXp, totalStars, meets, reqText } from './progression.js';
import { dailySeed } from './rng.js';

const star = (on) => `<span class="star ${on ? 'on' : ''}">★</span>`;
export class Menu {
  constructor(root, game) { this.root = root; this.game = game; this.stack = []; root.addEventListener('click', (e) => this.onClick(e)); }
  get p() { return this.game.profile; }
  show(screen, data) { this.stack.push([screen, data]); this.render(screen, data); this.root.classList.remove('hidden'); this.game.demo(screen === 'customize'); }
  back() { this.stack.pop(); const top = this.stack[this.stack.length - 1]; if (top) { this.render(...top); this.game.demo(top[0] === 'customize'); } else this.show('main'); }
  hide() { this.stack = []; this.root.classList.add('hidden'); this.root.innerHTML = ''; this.game.demo(false); }
  get visible() { return !this.root.classList.contains('hidden'); }
  xpBar() { const { lvl, into, need } = levelFromXp(this.p.xp); return `<div class="xp"><div class="xpl">LVL ${lvl}</div><div class="xpbar"><div class="xpfill" style="width:${Math.min(100, into / need * 100)}%"></div></div><div class="xpn">${into} / ${need}</div><div class="xps">★ ${totalStars(this.p)}</div></div>`; }
  render(screen, data) {
    const r = this.root; r.dataset.screen = screen;
    if (screen === 'main') {
      const d = this.p.daily.date === dailySeed() ? this.p.daily.best : 0;
      r.innerHTML = `<div class="logo"><h1>SWINGBY</h1><div class="tag">HOLD TO ORBIT · RELEASE TO FLY</div></div>
      ${this.xpBar()}
      <div class="btns">
        <button data-a="levels" class="big">PLAY <span class="sm">${this.levelsDone()} / ${LEVELS.length} levels</span></button>
        <button data-a="endless">ENDLESS <span class="sm">best ${this.p.endless.best}</span></button>
        <button data-a="daily">DAILY ${dailySeed()} <span class="sm">${d ? 'best ' + d : 'not played'}</span></button>
        <button data-a="customize">CUSTOMIZE</button>
        <button data-a="settings">SETTINGS</button>
      </div>`;
    } else if (screen === 'levels') {
      r.innerHTML = `<div class="hdr"><button data-a="back">‹</button><h2>LEVELS</h2>${this.xpBar()}</div><div class="grid">` + LEVELS.map((L) => {
        const st = this.p.levels[L.id] || {}; const locked = !this.unlocked(L);
        return `<button class="lv ${locked ? 'locked' : ''} ${st.completed ? 'done' : ''}" data-a="level" data-id="${L.id}" ${locked ? 'disabled' : ''}>
          <div class="n">${String(L.id).padStart(2, '0')}</div><div class="nm">${L.name}</div>
          <div class="stars">${star(st.stars >= 1)}${star(st.stars >= 2)}${star(st.stars >= 3)}</div>
          <div class="meta">${locked ? '' : (st.bestScore ? st.bestScore : '')}</div></button>`; }).join('') + `</div>`;
    } else if (screen === 'customize') {
      const item = (it, kind) => { const un = this.p.unlocked.includes(it.id); const eq = this.p.equipped[kind] === it.id;
        const sw = kind === 'skin' ? `<span class="sw" style="background:#${it.emissive.toString(16).padStart(6, '0')};box-shadow:0 0 14px #${it.trail.toString(16).padStart(6, '0')}"></span>` : `<span class="sw tr" style="height:${4 + it.width * 24}px;width:${20 + it.len / 4}px"></span>`;
        return `<button class="it ${un ? '' : 'locked'} ${eq ? 'eq' : ''}" data-a="equip" data-kind="${kind}" data-id="${it.id}" ${un ? '' : 'disabled'}>${sw}<div class="nm">${it.name}</div><div class="meta">${un ? (eq ? '●' : '') : reqText(it.req)}</div></button>`; };
      r.innerHTML = `<div class="panel"><div class="hdr"><button data-a="back">‹</button><h2>CUSTOMIZE</h2></div>
        <h3>COMET</h3><div class="grid small">${SKINS.map(s => item(s, 'skin')).join('')}</div>
        <h3>TRAIL</h3><div class="grid small">${TRAILS.map(t => item(t, 'trail')).join('')}</div></div><div class="preview"></div>`;
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
    } else if (screen === 'dead') {
      const d = data;
      r.innerHTML = `<div class="tapzone" data-a="${d.mode === 'endless' ? 'endless' : 'retry'}"><div class="logo"><h1 class="${d.newBest ? 'win' : ''}">${d.score}</h1><div class="tag">${d.newBest ? 'NEW BEST · ' : 'BEST ' + d.best + ' · '}TAP TO RETRY</div></div><div class="xpmini">+${d.xp} XP</div>
        ${d.unlocks.length ? `<div class="unl">NEW: ${d.unlocks.map(u => u.name).join(' · ')}</div>` : ''}</div>
        <div class="btns row2 corner"><button data-a="main">MENU</button></div>`;
    }
  }
  levelsDone() { return LEVELS.filter(L => this.p.levels[L.id]?.completed).length; }
  unlocked(L) { return L.id === 1 || !!this.p.levels[L.id - 1]?.completed; }
  onClick(e) {
    const b = e.target.closest('button,.tapzone'); if (!b || b.disabled) return; const a = b.dataset.a; const g = this.game;
    if (a === 'back') this.back(); else if (a === 'main') { this.stack = []; this.show('main'); }
    else if (a === 'levels' || a === 'customize' || a === 'settings') this.show(a);
    else if (a === 'endless') g.play('endless'); else if (a === 'daily') g.play('daily'); else if (a === 'retry') g.retry();
    else if (a === 'level') g.play('level', Number(b.dataset.id));
    else if (a === 'equip') { this.p.equipped[b.dataset.kind] = b.dataset.id; g.saveNow(); g.applyCosmetics(); this.render('customize'); }
    else if (a === 'toggle') { const k = b.dataset.k; this.p.settings[k] = !this.p.settings[k]; g.saveNow(); g.applySettings(); this.render('settings'); }
    else if (a === 'reset') { if (confirm('Reset all progress, XP and unlocks?')) { g.resetProfile(); this.stack = []; this.show('main'); } }
  }
}
