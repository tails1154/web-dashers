// Runs production physics without Phaser rendering; writes an SVG and JSON trace.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({
    window: { noParticles: true }, console, Math, Number, Date,
    Phaser: { Math: { Clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)) } },
    centerX: 0, playerSpeed: 11.540004, p: 1.916398, d: 0.9,
    slopeType: 'slope', solidType: 'solid', hazardType: 'hazard', coinType: 'coin',
    jumpRingType: 'ring', jumpPadType: 'pad', padType: 'pad', speedType: 'speed',
    g: 1, u: 1 / 60
});
const levelSource = fs.readFileSync(path.join(root, 'assets/scripts/core/level.js'), 'utf8');
for (const match of levelSource.matchAll(/const (\w+) = "([^"]+)";/g)) context[match[1]] = match[2];
vm.runInContext(levelSource.slice(0, levelSource.indexOf('const ldm_object')), context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/scripts/core/player.js'), 'utf8'), context);
const { Collider, PlayerObject, PlayerState } = vm.runInContext('({Collider, PlayerObject, PlayerState})', context);

function ramp(x, y, descending, inverted = false) {
    const c = new Collider('slope', x, y, 120, 60);
    c.slopeDir = descending ? -1 : 1;
    c.slopeFlipY = inverted;
    c.slopeAngleDeg = Math.atan(0.5) * 180 / Math.PI;
    const surfaceVertices = descending
        ? [{ x: x - 60, y: y + 30 }, { x: x + 60, y: y - 30 }]
        : [{ x: x - 60, y: y - 30 }, { x: x + 60, y: y + 30 }];
    const solidVertex = { x: descending ? x - 60 : x + 60, y: y - 30 };
    const reflectY = point => ({ x: point.x, y: inverted ? y - (point.y - y) : point.y });
    c.slopeSurfaceVertices = surfaceVertices.map(reflectY);
    c.slopeSolidVertex = reflectY(solidVertex);
    c.slopeSolidVertices = [...c.slopeSurfaceVertices, c.slopeSolidVertex];
    return c;
}

function simulate(profile, descending, jump, headBonk = false) {
    const slopes = headBonk
        ? [ramp(220, 150, descending, true)]
        : [ramp(180, descending ? 150 : 30, descending), ramp(300, 90, descending)];
    const state = new PlayerState();
    state.y = headBonk ? 85 : (descending ? 210 : 30);
    state.lastY = state.y;
    state.yVelocity = headBonk ? 18 : 0;
    state.isJumping = headBonk;
    state.canJump = false;
    const layer = { physicsProfile: profile, getNearbySectionObjects: () => slopes,
        getFloorY: () => 0, getCeilingY: () => null };
    const player = Object.create(PlayerObject.prototype);
    Object.assign(player, { p: state, _gameLayer: layer,
        _scene: { _editorPlaytestActive: true, game: { loop: { delta: 1000 / 60 } } },
        noclipStats: { totalFrames: 0, deathFrames: 0, accuracy: 100 },
        _slopeTime: 0, _slopeVelocity: 0, _slopeYVelocity: 0, _lastSlopeYVelocity: 0,
        _slopeJumpObj: null,
        _rotation: 0, _prevSlopeObj: null, _activeSlopeObj: null,
        stopRotation() {}, runRotateAction() {}, killPlayer() { state.isDead = true; },
        _tryVectorLedgeTurn() {} });
    const trace = [];
    let x = headBonk ? 120 : 90;
    for (let tick = 0; tick < 160 && !state.isDead; tick++) {
        state.lastY = state.y;
        state.upKeyDown = jump && tick >= 50 && tick < 54;
        player._scene._playerWorldX = x;
        player.updateJump(0.25 * 0.9);
        state.y += state.yVelocity * 0.25 * 0.9;
        player.checkCollisions(x, 1 / 240);
        trace.push({ tick, x, y: state.y, velocity: state.yVelocity,
            grounded: state.onGround, contact: slopes.indexOf(player._activeSlopeObj), dead: state.isDead,
            input: state.upKeyDown });
        x += 11.540004 * 0.25 * 0.9;
    }
    return { profile, descending, jump, headBonk, slopes, trace };
}

const runs = [];
for (const profile of ['legacy', 'native-slopes']) {
    for (const descending of [false, true]) for (const jump of [false, true]) {
        runs.push(simulate(profile, descending, jump));
    }
    runs.push(simulate(profile, false, false, true));
}
const colors = { legacy: '#e6ad4c', 'native-slopes': '#55dbe1' };
const panels = [
    { descending: false, jump: false, headBonk: false, label: 'Ascending connected ramps' },
    { descending: false, jump: true, headBonk: false, label: 'Ascending ramps + jump input' },
    { descending: true, jump: false, headBonk: false, label: 'Descending connected ramps' },
    { descending: true, jump: true, headBonk: false, label: 'Descending ramps + jump input' },
    { descending: false, jump: false, headBonk: true, label: 'Inverted ramp: head-bonk test' }
];
const svgHeight = 65 + Math.ceil(panels.length / 2) * 515;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${svgHeight}" viewBox="0 0 1100 ${svgHeight}"><rect width="1100" height="${svgHeight}" fill="#101827"/><g font-family="DejaVu Sans" fill="white"><text x="24" y="28" font-size="18">Production slope physics — orange: legacy, cyan: new; red X: death</text>`;
for (let panel = 0; panel < panels.length; panel++) {
    const { descending, jump, headBonk, label } = panels[panel];
    const ox = 30 + (panel % 2) * 540, oy = 65 + Math.floor(panel / 2) * 515;
    const sx = x => ox + x - 60, sy = y => oy + 420 - y;
    svg += `<text x="${ox}" y="${oy}" font-size="16">${label}</text>`;
    const selected = runs.filter(r => r.descending === descending && r.jump === jump && r.headBonk === headBonk);
    for (const c of selected[0].slopes) {
        svg += `<polygon points="${c.slopeSolidVertices.map(v => `${sx(v.x)},${sy(v.y)}`).join(' ')}" fill="#37465e" stroke="#93a4bc"/>`;
    }
    svg += `<path d="M ${sx(60)} ${sy(0)} H ${sx(490)}" stroke="#aaa"/>`;
    for (const run of selected) {
        svg += `<polyline points="${run.trace.map(t => `${sx(t.x)},${sy(t.y)}`).join(' ')}" fill="none" stroke="${colors[run.profile]}" stroke-width="2"/>`;
        for (const t of run.trace.filter((t, i) => i % 12 === 0 || t.input || t.dead)) {
            svg += `<rect x="${sx(t.x) - 30}" y="${sy(t.y) - 30}" width="60" height="60" fill="none" stroke="${colors[run.profile]}" opacity="0.3"/>`;
            if (t.dead) svg += `<text x="${sx(t.x) - 7}" y="${sy(t.y) + 6}" fill="#ff5555" font-size="24">X</text>`;
            if (t.input) svg += `<circle cx="${sx(t.x)}" cy="${sy(t.y)}" r="5" fill="#fff"/>`;
        }
    }
}
svg += '</g></svg>';

const findRun = (profile, descending, jump, headBonk = false) => runs.find(run =>
    run.profile === profile && run.descending === descending && run.jump === jump && run.headBonk === headBonk
);
const nativeAscendingJump = findRun('native-slopes', false, true);
const nativeDescendingJump = findRun('native-slopes', true, true);
const assert = (condition, message) => {
    if (!condition) throw new Error(`Slope simulator assertion failed: ${message}`);
};
for (const run of runs) {
    const label = run.headBonk ? 'head bonk' : `${run.descending ? 'descending' : 'ascending'} ${run.jump ? 'jump' : 'run'}`;
    assert(run.headBonk || run.trace.length === 160, `${run.profile} ${label} ended early`);
    assert(run.headBonk || !run.trace.some(sample => sample.dead), `${run.profile} ${label} died`);
}
assert(nativeAscendingJump.trace.some(sample => sample.tick >= 50 && sample.contact === -1),
    'an ascending native slope jump was re-grounded');
assert(nativeDescendingJump.trace.some(sample => sample.tick >= 50 && sample.contact === -1),
    'a descending native slope jump was re-grounded');
const nativeHeadBonk = findRun('native-slopes', false, false, true);
assert(nativeHeadBonk.trace.length > 0, 'the native head-bonk scenario produced no trace');
const output = path.resolve(process.argv[2] || '/tmp/webdashers-slope-simulation');
fs.writeFileSync(output + '.svg', svg);
fs.writeFileSync(output + '.json', JSON.stringify(runs, null, 2));
for (const r of runs) console.log(JSON.stringify({ profile: r.profile, descending: r.descending,
    jump: r.jump, headBonk: r.headBonk, samples: r.trace.length, died: r.trace.at(-1).dead,
    contacts: [...new Set(r.trace.map(t => t.contact))] }));
console.log(output + '.svg');
