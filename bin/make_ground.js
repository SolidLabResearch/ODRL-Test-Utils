#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { makeGround } = require("../lib/util");

if (process.argv.length === 2) {
    console.error("usage: make_ground.js file [x]");
    console.error(`
use 'x' to overwrite an existing file
`);
    process.exit(1);   
}

const file = process.argv[2];
let stdout = true;

if (process.argv.length === 4 && process.argv[3] === 'x') {
    stdout = false;
}

main(file,stdout);

async function main(file,stdout) {
    const result = await makeGround(file);
    if (stdout) {
        console.log(result);
    }
    else {
        console.log(`updated ${file}`);
        fs.writeFileSync(file,result);
    }
}