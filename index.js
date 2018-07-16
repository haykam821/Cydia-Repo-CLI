#!/usr/bin/env node

const yargs = require("yargs");
const chalk = require("chalk");

const repoURLs = [
    "68292590801256448",
];

const path = require("path");
const fs = require("fs-extra");
const rq = require("request-promise");

const stringMatch = require("string-similarity");

const cachePath = path.resolve("./cache.json");

async function saveCache() {
    return await fs.writeJSON(cachePath, {
        lastUpdated: new Date(),
        data: await getCacheData(),
    });
}

async function initCache() {
    if (!await fs.exists(cachePath)) {
        await fs.writeJSON(cachePath, {
            lastUpdated: null,
            repos: [],
            packages: [],
            versions: [],
        });
    }
}

async function getCache() {
    await initCache();

    return await fs.readJSON(cachePath);
}

async function getCacheData() {
    const repos = [];
    const packages = [];
    const versions = [];

    await Promise.all(repoURLs.map(async repo => {
        const info = JSON.parse(await rq.get(`https://repo.dynastic.co/api/v0/repos/${repo}?packages`));

        info.versions.forEach(version => {
            packages.push(version.package);

            version.package = version.package.id; 
            versions.push(version);
        });

        info.versions = info.versions.map(version => version.id);
        repos.push(info);
    }));

    return {
        repos,
        packages,
        versions,
    };
}

yargs.command("cache", "Updates the cache of repos and packages.", {}, saveCache);
yargs.command("package <bundleID>", "Views a package on the repo.", builder => {
    builder.positional("search", {
        description: "The bundle ID or name of the package you are looking for.",
        type: "string",
    });
}, async argv => {
    const cache = await getCache();
    const data = cache.data;

    const match = stringMatch.findBestMatch(argv.bundleID, [
        ...data.packages.map(package => package.packageID),
        ...data.packages.map(package => package.name),
    ]).bestMatch.target;
    const package = data.packages.filter(package => package.name === match || package.packageID === match)[0];

    if (!match) {
        process.stderr.write(chalk.red("No packages found.\n"));
    } else {
        if (package.error) {
            process.stderr.write(chalk.red(package.error.message + "\n"));
        } else {
            process.stdout.write("\n" + [
                chalk.bold(package.name) + " by " + package.creator,
                chalk.green(package.price),
            ].join("\n") + "\n\n");
        }
    }
});

yargs.argv;