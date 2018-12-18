const parseArgs = require("minimist");
const { executeCommand, packageWasChanged, PACKAGES } = require("./util");

const deployPackage = async packageName => {
  if (!process.env.TRAVIS || packageWasChanged(packageName)) {
    await executeCommand(
      `node scripts/dockerScripts tag`,
      `./packages/${packageName}`
    );
    await executeCommand(
      `node scripts/dockerScripts publish`,
      `./packages/${packageName}`
    );
  } else {
    console.log(
      `Currently in CI and ${packageName} was not changed. Skipping deploy`
    );
  }
};

// Process all command line arguments
const processArgs = async args => {
  if (args.all) {
    // Builds docker images for all packages
    console.log("Deploying all packages");
    PACKAGES.forEach(pack => deployPackage(pack));
  } else {
    // Builds docker images for specified packages
    const packages = args._;

    // If no packages were specified, error out
    if (!packages.length) {
      console.log("No Packages Specified. Aborting");
      process.exit(1);
    }

    // if an invalid package is specified, error out
    packages.forEach(pack => {
      if (!PACKAGES.includes(pack)) {
        console.log(`${pack} is not a valid package. Aborting`);
        process.exit(1);
      }
    });

    // Build all specified packages
    console.log(`Deploying ${packages}`);
    packages.forEach(pack => deployPackage(pack));
  }
};

const args = parseArgs(process.argv.slice(2));
processArgs(args);
