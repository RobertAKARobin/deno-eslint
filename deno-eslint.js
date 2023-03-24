#!/usr/bin/env node

const fs = require(`fs`);
const pathUtil = require(`path`);
const sys = require(`child_process`);
const ts = require(`typescript`);

(async function (){
	const args = {
		denoConfig: `deno.json`,
		denoVersion: null,
		projectRoot: `../../`,
		targetfilePaths: `serve.ts`,
		tsConfigTemplatePath: null,
	};

	const denoTypesPath = `deno.types.d.ts`;

	const denoVersion = args.denoVersion || // TODO check Deno exists
		sys.execSync(
			`deno eval 'console.log(Deno.version.deno)'`,
			{ encoding: `utf-8` },
		);
	fs.writeFileSync(denoTypesPath, await ( // TODO reuse existing file
		await fetch(
			`https://github.com/denoland/deno/releases/download/v${denoVersion}/lib.deno.d.ts`
		)
	).text());

	const denoConfig = JSON.parse(fs.readFileSync(args.denoConfigPath));
	const denoImportmap = JSON.parse(fs.readFileSync(denoConfig.importMap));
	const denoVendorDirPath = denoConfig.importMap.match(/\/(.*?)\//)[1]; // TODO if vendor dir not specified, output here (--output)
	const tsConfigTemplate = JSON.parse(fs.readFileSync(args.tsConfigTemplatePath));
	const tsConfig = {
		...(tsConfigTemplate || {}),
		compilerOptions: {
			...(tsConfigTemplate.compilerOptions || {}),
			allowImportingTsExtensions: true,
			baseUrl: `.`, // TODO relative to importing package
			noEmit: true,
			paths: {
				...(tsConfigTemplate.compilerOptions.paths || {}),
			}
		},
		files: {
			...(tsConfigTemplate.compilerOptions.files || {}),
			denoTypesPath, // TODO relative to importing package
		},
	};

	for (const [denoImportPath_remote, denoImportPath_local] of Object.entries(denoImportmap)) {
		tsConfig.compilerOptions.paths[denoImportPath_remote] = [
			`${denoVendorDirPath}${denoImportPath_local}`
		];
	}
	fs.writeTextFileSync(tsConfig, args.projectRoot); // TODO target

})();
