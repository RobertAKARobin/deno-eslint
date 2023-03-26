module.exports = {
	extends: [
		`eslint:recommended`,
		`plugin:@typescript-eslint/eslint-recommended`,
		`plugin:@typescript-eslint/recommended`
	],
	ignorePatterns: [
		`**/*.js`,
	],
	overrides: [
		{
			// extends: [
			// 	`plugin:@typescript-eslint/recommended-requiring-type-checking`
			// ],
			files: [`*.ts`],
			parser: `@typescript-eslint/parser`,
			parserOptions: {
				project: [`./tsconfig.json`],
			},
		},
	],
};
