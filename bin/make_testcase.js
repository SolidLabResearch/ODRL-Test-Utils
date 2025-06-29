#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { makeTestCase } = require("../lib/util");

const files = process.argv.splice(2);

if (files.length != 1) {
    console.error("usage: make_testcase.js policy");
    process.exit(1);   
}

main(files[0]);

async function main(policyFile) {
    const result = await makeTestCase(policyFile);
    console.log(result);
}