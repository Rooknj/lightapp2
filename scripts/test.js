"use strict";

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "test";
process.env.NODE_ENV = "test";

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const jest = require("jest");
let argv = process.argv.slice(2);

// Add the src/ argument to the beginning of the array
// Makes jest only run the unit tests inside of the src/ folder
argv.unshift("src/");

// Watch unless on CI or in coverage mode
if (argv.indexOf("--no-watch") >= 0) {
  process.env.CI = "true";
  argv.splice(argv.indexOf("--no-watch"), 1); // Remove no-watch option from argv so jest doesnt screw up
}

// Watch unless on CI or in coverage mode
if (!process.env.CI && argv.indexOf("--coverage") < 0) {
  argv.push("--watch");
}

jest.run(argv);
