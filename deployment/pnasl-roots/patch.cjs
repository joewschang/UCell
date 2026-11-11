const fs = require('node:fs');
const file = process.argv[2];
const service = fs.readFileSync(file, 'utf8');
const guard = 'if (q && !/^[A-Za-z0-9]{1,24}$/.test(q))';
if (service.split(guard).length !== 2) throw Error('Expected the production ball number validator');
const replacement = [
    "q = q?.trim().toUpperCase();",
    "        if (q && !/^[A-Z0-9][A-Z0-9-]{0,23}$/.test(q))",
].join('\n');
fs.writeFileSync(file, service.replace(guard, () => replacement));
