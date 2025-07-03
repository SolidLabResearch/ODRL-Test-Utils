#!/usr/bin/env node
const { program } = require('commander');
const { makePolicy,makeRequest,makeSotw, makeTestcase, makeGround } = require("../lib/util");
const SOURCE = "https://github.com/SolidLabResearch/ODRL-Test-Suite/";
const fs = require('fs');

program
  .name('odrl_test_utils')
  .description('Utils to generate ODRL test cases');

program
  .command('sample')
  .option('--source <source>','Location of Git repo',SOURCE)
  .option('--type <type>','Create (permission|prohibition|duty) example','permission')
  .option('--action', 'Add an action report')
  .option('--constraint', 'Add a constraint report')
  .option('--party', 'Add a party report')
  .option('--target', 'Add a target report')
  .argument('<what>','policy|request|sotw|testcase')
  .action( (what, options) => {
      switch (what) {
          case 'policy':
            console.log(makePolicy(options));
            break;
          case 'request':
            console.log(makeRequest(options));
            break;
          case 'sotw':
            console.log(makeSotw());
            break;
          case 'testcase':
            console.log(makeTestcase(options));
            break;
          default:
            console.error('need policy|request|sotw|testcase');
            break;
      }
  });

program
  .command('ground')
  .option('-x','overwrite files',false)
  .argument('<file...>')
  .action( async (files,options) => {
    for (let i = 0 ; i < files.length ; i++) {
      const file = files[i];
      const result = await makeGround(file);

      if (!result) {
        console.error(`${file} : no output - skipped`);
        continue;
      }    

      if (options.x) {
        console.log(`updated ${file}`);
        fs.writeFileSync(file,result);
      }
      else {
        console.log(result);
      }
    }
  });

program.parse();