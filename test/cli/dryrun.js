/**
 * Tests dryrun flags and its synonyms are properly parsed by command line
 *
 * While this is fairly basic functionality its quite important (!!!) these
 * are detected, and we should never change the CLI interface such that theseuno
 * tests need to change, as scripts/human muscle memory  may be relying on
 * these flags
 */

require('../common.js');

const rewire = require('rewire');

const TreeployCli = rewire('../../src/cli.ts');

let parseOpts = TreeployCli.__get__("parseOptionalArguments");

describe('Basic usage', () => {
	it('--dryrun', () => {
		let opts = parseOpts(['--dryrun']);
		expect(opts.dryrun   ).is.true;
		expect(opts.verbosity).is.deep.equal(2);
	});

	it('-n', () => {
		let opts = parseOpts(['-n']);
		expect(opts.dryrun   ).is.true;
		expect(opts.verbosity).is.deep.equal(2);
	});

	it('-nv', () => {
		let opts = parseOpts(['-nv']);
		expect(opts.dryrun   ).is.true;
		expect(opts.verbosity).is.deep.equal(3);
	});

	it('-vn', () => {
		let opts = parseOpts(['-vn']);
		expect(opts.dryrun   ).is.true;
		expect(opts.verbosity).is.deep.equal(3);
	});

	it('--noop', () => {
		let opts = parseOpts(['--noop']);
		expect(opts.dryrun   ).is.true;
		expect(opts.verbosity).is.deep.equal(2);
	});

	it('--no-action', () => {
		let opts = parseOpts(['--no-action']);
		expect(opts.dryrun   ).is.true;
		expect(opts.verbosity).is.deep.equal(2);
	});
});

it('Invalid look-alikes', () => {
	// Here we want to test that invalid flags that look similar
	// cause errors, since if someone accidently types these flags
	// instead of the real ones, we don't want to proceed with the
	// program

	expect(() => parseOpts(['--noaction'])).to.throw;
	expect(() => parseOpts(['--dry-run' ])).to.throw;
	expect(() => parseOpts(['--n'       ])).to.throw;
	expect(() => parseOpts(['-noop'     ])).to.throw;
	expect(() => parseOpts(['-dryrun'   ])).to.throw;
	expect(() => parseOpts(['-no-action'])).to.throw;
});
