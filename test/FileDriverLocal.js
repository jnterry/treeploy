/**
 * Test suite for FileLocalDriver
 */

"use strict";

require('./common.js');

const rewire = require('rewire');
const fs     = require('fs');
const execSync   = require('child_process').execSync;

const FileDriverLocal = rewire('../src/file_drivers/Local.ts');

let getStatPermissionString = FileDriverLocal.__get__("getStatPermissionString");

describe('getStatPermissionString', () => {

	let permissions = [
		'777',
		'755',
		'644',
		'664',
		'600',
	];

	for(let perm_str of permissions){
		it('0' + perm_str, () => {
			mockfs({
				'thing.txt' : mockfs.file({
					mode : parseInt(perm_str, 8),
				}),
			});

			let stat   = fs.statSync('thing.txt');
			let result = getStatPermissionString(stat);
			expect(result).is.deep.equal('0' + perm_str);

			mockfs.restore();
		});
	}
});

describe('setAttributes', () => {
	let fdriver = new FileDriverLocal.default.create({ path: '/', writes_enabled: true });

	beforeEach(() => {
		mockfs({
			'test.txt' : mockfs.file({
				content : "Hello world",
				uid     : 3000,
				gid     : 3000,
				mode    : parseInt('644', 8)
			})
		});
	});

	afterEach(() => {
		mockfs.restore();
	});

	it('Empty options object is no-op', () => {
		return fdriver
			.setAttributes('test.txt', {})
			.then(() => {
				let stats = fs.statSync('test.txt');
				expect(stats.uid).is.deep.equal(3000);
				expect(stats.gid).is.deep.equal(3000);
				expect(getStatPermissionString(stats)).is.deep.equal('0644');
			});
	});

	it('Can set owner individually', () => {
		return fdriver
			.setAttributes('test.txt', { owner: 1234 })
			.then(() => {
				let stats = fs.statSync('test.txt');
				expect(stats.uid).is.deep.equal(1234);
				expect(stats.gid).is.deep.equal(3000);
				expect(getStatPermissionString(stats)).is.deep.equal('0644');
			});
	});

	it('Can set group individually', () => {
		return fdriver
			.setAttributes('test.txt', { group: 4321 })
			.then(() => {
				let stats = fs.statSync('test.txt');
				expect(stats.uid).is.deep.equal(3000);
				expect(stats.gid).is.deep.equal(4321);
				expect(getStatPermissionString(stats)).is.deep.equal('0644');
			});
	});

	it('Can set mode individually', () => {
		return fdriver
			.setAttributes('test.txt', { mode: '0777' })
			.then(() => {
				let stats = fs.statSync('test.txt');
				expect(stats.uid).is.deep.equal(3000);
				expect(stats.gid).is.deep.equal(3000);
				expect(getStatPermissionString(stats)).is.deep.equal('0777');
			});
	});

	it('Can set multiple attributes simultaniously', () => {
		return fdriver
			.setAttributes('test.txt', { owner: 1111, group: 2222 })
			.then(() => {
				let stats = fs.statSync('test.txt');
				expect(stats.uid).is.deep.equal(1111);
				expect(stats.gid).is.deep.equal(2222);
				expect(getStatPermissionString(stats)).is.deep.equal('0644');
			});
	});

	it('Can set all attributes simultaniously', () => {
		return fdriver
			.setAttributes('test.txt', {
				owner: 3333,
				group: 4444,
				mode: '0666'
			})
			.then(() => {
				let stats = fs.statSync('test.txt');
				expect(stats.uid).is.deep.equal(3333);
				expect(stats.gid).is.deep.equal(4444);
				expect(getStatPermissionString(stats)).is.deep.equal('0666');
			});
	});

	it('Can set owner and group by string', () => {
		let username   = execSync('id -un').toString('utf8').trim();
		let group_name = execSync('id -gn').toString('utf8').trim();

		let uid = parseInt(execSync('id -u').toString('utf8').trim());
		let gid = parseInt(execSync('id -g').toString('utf8').trim());

		return fdriver.setAttributes('test.txt', {
			owner: username,
			group: group_name,
		}).then(() => {
			let stats = fs.statSync('test.txt');
			expect(stats.uid).is.deep.equal(uid);
			expect(stats.gid).is.deep.equal(gid);
		});
	});
});
