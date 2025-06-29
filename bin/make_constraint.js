#!/usr/bin/env node

const { makeConstraint } = require("../lib/util");

main();

async function main() {
    const result = await makeConstraint();
    console.log(result);
}