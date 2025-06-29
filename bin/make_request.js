#!/usr/bin/env node

const { makeRequest } = require("../lib/util");

main();

async function main() {
    const result = await makeRequest();
    console.log(result);
}