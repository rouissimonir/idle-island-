import { formatSimReport, runSimulation } from '../src/sim/index.ts';

const result = runSimulation({ days: 14, seed: 42 });
console.log(formatSimReport(result));
