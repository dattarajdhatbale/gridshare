"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lmpFor = lmpFor;
exports.simulateMetersForTick = simulateMetersForTick;
const model_1 = require("./model");
function hash(x) {
    const s = Math.sin(x) * 10000;
    return s - Math.floor(s);
}
function lmpFor(supply, demand, pFit = model_1.PFIT, pGrid = model_1.PGRID) {
    if (supply === 0 && demand === 0)
        return (pFit + pGrid) / 2;
    return Math.max(pFit, Math.min(pGrid, (supply * pFit + demand * pGrid) / (supply + demand)));
}
function simulateMetersForTick(tick, dbMeters) {
    const hour = (9 + tick / 4) % 24;
    const daylight = Math.max(0, Math.min(1, Math.sin(((hour - 6) / 12) * Math.PI)));
    return dbMeters.map((m, i) => {
        const r1 = hash(tick * 13 + i * 37);
        const r2 = hash(tick * 17 + i * 43);
        const r3 = hash(tick * 23 + i * 47);
        // Generation (kW)
        const cloud = m.role === 'consumer' ? 0 : 0.72 + r1 * 0.33; // 0.72 to 1.05
        const genKW = m.role === 'consumer' ? 0 : m.pv * daylight * cloud;
        const generation = genKW;
        // Load (kW)
        const loadKW = Math.max(0.25, m.baseLoad * (0.82 + r2 * 0.36)); // 0.82 to 1.18
        const load = loadKW;
        const net = generation - load;
        const exportKWh = Math.max(0, net) * 0.25;
        const importKWh = Math.max(0, -net) * 0.25;
        const voltage = 230.5 + (r3 * 3.0 - 1.5) - exportKWh * 0.8;
        const pf = Math.max(0.88, Math.min(1.0, 0.93 + r1 * 0.065));
        const current = (loadKW || 0.1) * 1000 / (Math.max(voltage, 1) * pf);
        return {
            id: m.id,
            name: m.name,
            role: m.role,
            pv: m.pv,
            baseLoad: m.baseLoad,
            generation,
            load,
            exportKWh,
            importKWh,
            net,
            voltage,
            current,
            powerFactor: pf,
            status: net > 0 ? 'surplus' : 'deficit',
            distance: m.distance,
            displayName: m.displayName,
            earned: m.earned,
        };
    });
}
