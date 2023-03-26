import * as pathUtil from "https://deno.land/std@0.181.0/path/mod.ts";

//#region Utilities

export type Args = Record<string, string>;

export type ArgsDefaults<ArgsInput extends Args> = Array<ArgDefault<ArgsInput>>;

export type ArgDefault<
	Args extends Record<string, unknown>,
	Key = keyof Args,
	DefaultValue = Key extends keyof Args ? Args[Key] : never
> = [Key,
	| DefaultValue
	| ((args: Args) => DefaultValue)
];

export function toArgs<InputArgs extends Args>(
	argsInputs: Array<string>,
	argsDefaults: ArgsDefaults<InputArgs>
): InputArgs {
	const argsNamed = {} as InputArgs;
	const argsPositional: Array<string> = [];
	for (const argsInput of argsInputs) {
		const [argName, argValue] = argsInput.split(`=`);
		if (typeof argValue === `undefined`) {
			argsPositional.push(argName);
		} else {
			argsNamed[argName as keyof InputArgs] = argValue as InputArgs[keyof InputArgs];
		}
	}
	for (const [argName, argDefault] of argsDefaults) {
		if (argName in argsNamed) {
			continue;
		}
		argsNamed[argName] = typeof argDefault === `function`
			? argDefault(argsNamed)
			: argDefault;
	}
	return argsNamed;
}

export type Constructor<Type> = {
	new(...args: Array<unknown>): Type;
};

export function dedupe<Value>(input: Array<Value>) {
	const set = new Set(input);
	return [...set.values()];
}

export function ifError<Value, ValueIfError>(
	callback: () => Value,
	onError: ValueIfError | ((error: unknown) => ValueIfError)
) {
	try {
		return callback();
	} catch (error: unknown) {
		if (onError instanceof Function) {
			return onError(error);
		}
		return onError;
	}
}

export function fatal(message: string) {
	console.error(`ERROR: ${message}`);
	Deno.exit(1);
}

export function fileExistsSync(filename: string): boolean {
	try {
		Deno.statSync(filename);
		return true;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return false;
		}
		throw error;
	}
}

//#endregion

//#region Main

type DenoEslintArgs = {
	denoConfigPath: string;
	denoTypesInputPath: string;
	denoTypesOutputPath: string;
	denoTypesUrl: string;
	denoVersion: string;
	outputDirPath: string;
	projectRoot: string;
	tsConfigInputPath: string;
	tsConfigOutputPath: string;
}

const args = toArgs<DenoEslintArgs>(Deno.args, [
	[`outputDirPath`, () => pathUtil.dirname(pathUtil.fromFileUrl(import.meta.url))],
	[`projectRoot`, (args) => args.outputDirPath],
	[`denoConfigPath`, `./deno.json`], // TODO add jsonc
	[`denoVersion`, () => Deno.version.deno],
	[`denoTypesOutputPath`, `./deno.types.d.ts`],
	[`denoTypesInputPath`, (args) => args.denoTypesOutputPath],
	[`denoTypesUrl`, (args) => `https://github.com/denoland/deno/releases/download/v${args.denoVersion}/lib.deno.d.ts`],
	[`tsConfigInputPath`, `./tsconfig.json`],
	[`tsConfigOutputPath`, (args) => args.tsConfigInputPath],
]);

if (!fileExistsSync(pathUtil.join(args.outputDirPath, args.denoTypesInputPath))) {
	const denoTypesUrl = args.denoTypesUrl;
	console.info(`Downloading Deno types from ${denoTypesUrl}...`);
	Deno.writeTextFileSync(
		pathUtil.join(args.outputDirPath, args.denoTypesOutputPath),
		await (await fetch(denoTypesUrl)).text(),
	);
}

type DenoConfig = {
	importMap: string;
}

type DenoImportMap = {
	imports: Record<string, string>;
}

const denoConfig: DenoConfig = ifError(
	() => JSON.parse(
		Deno.readTextFileSync(
			pathUtil.join(args.projectRoot, args.denoConfigPath)
		),
	),
	{},
);

// TODO run `deno vendor` if not already run?
// TODO load from global Deno cache instead of requiring `deno vendor`?

const denoImports: Record<string, Array<string>> = {};

if (denoConfig.importMap) {
	const denoImportMap: DenoImportMap = ifError(
		() => JSON.parse(
			Deno.readTextFileSync(
				pathUtil.join(args.projectRoot, denoConfig.importMap)
			),
		),
		{},
	);
	if (denoImportMap.imports) {
		const denoVendorDirPath = denoConfig.importMap.match(/(.*?)\//g)?.[1] || `.`;
		for (const [importPath_remote, importPath_local] of Object.entries(denoImportMap.imports)) {
			denoImports[`${importPath_remote}*`] = [
				pathUtil.join(denoVendorDirPath, importPath_local) + `*`
			];
		}
	}
}

const tsConfigDefaults = {
	compilerOptions: {
		allowImportingTsExtensions: true,
		baseUrl: `.`,
		module: `ESNext`,
		moduleResolution: `bundler`,
		noEmit: true,
		paths: {} as Record<string, Array<string>>,
		target: `ESNext`,
	},
	files: [] as Array<string>,
};

type TsConfig = typeof tsConfigDefaults;

const tsConfigInput: TsConfig = ifError(
	() => JSON.parse(
		Deno.readTextFileSync(
			pathUtil.join(args.projectRoot, args.tsConfigInputPath)
		),
	),
	{},
);

const tsConfig: TsConfig = {
	...(tsConfigInput || {}),
	compilerOptions: {
		...tsConfigDefaults.compilerOptions,
		...(tsConfigInput.compilerOptions || {}),
		paths: {
			...(tsConfigInput.compilerOptions?.paths || {}),
			...denoImports,
		},
	},
	files: dedupe([
		...(tsConfigInput.files || []),
		args.denoTypesOutputPath,
	]),
};

Deno.writeTextFileSync(
	pathUtil.join(args.projectRoot, args.tsConfigOutputPath),
	JSON.stringify(tsConfig, null, `\t`),
);

//#endregion
