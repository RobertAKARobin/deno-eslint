#!/usr/bin/env node

const pathUtil = require(`path`);
const sys = require(`child_process`);

const path = pathUtil.join(__dirname, `deno-eslint.ts`);
sys.spawn(
	`deno run -A ${path}`,
	[
		`projectRoot=${process.env.INIT_CWD}`,
		...process.argv.slice(2),
	],
	{
		shell: true,
		stdio: `inherit`
	}
);
