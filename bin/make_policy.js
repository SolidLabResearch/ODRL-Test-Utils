#!/usr/bin/env node
// Usage: $0 [constraint]

const { makePolicy } = require("../lib/util");
const SOURCE = "https://github.com/SolidLabResearch/ODRL-Test-Conflicts/";

main();

async function main() {
    const options = {
        'source': SOURCE
    };

    const result = await makePolicy(options);
    console.log(result);
}