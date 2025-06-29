#!/usr/bin/env node

const { makeSotw } = require("../lib/util");

main();

async function main() {
    const result = await makeSotw();
    console.log(result);
}