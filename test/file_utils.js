/**
 * Test suite for functions defined in file_utils.js
 */

"use strict";

const expect     = require('chai').expect;
const mockfs     = require('mock-fs');
const fs         = require('fs');

const file_utils = require('../src/file_utils.js');

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
			let result = file_utils.getStatPermissionString(stat);
			expect(result).is.deep.equal('0' + perm_str);

			mockfs.restore();
		});
	}
});

describe('applyFilePermissions', () => {
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

		file_utils.applyFilePermissions('test.txt', {});

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(3000);
		expect(stats.gid).is.deep.equal(3000);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set owner individually', () => {

		file_utils.applyFilePermissions('test.txt', { owner: 1234 });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(1234);
		expect(stats.gid).is.deep.equal(3000);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set group individually', () => {

		file_utils.applyFilePermissions('test.txt', { group: 4321 });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(3000);
		expect(stats.gid).is.deep.equal(4321);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set mode individually', () => {
		file_utils.applyFilePermissions('test.txt', { mode: '0777' });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(3000);
		expect(stats.gid).is.deep.equal(3000);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0777');
	});

	it('Can set multiple attributes simultaniously', () => {
		file_utils.applyFilePermissions('test.txt', { owner: 1111, group: 2222 });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(1111);
		expect(stats.gid).is.deep.equal(2222);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set all attributes simultaniously', () => {
		file_utils.applyFilePermissions('test.txt', {
			owner: 3333,
			group: 4444,
			mode: '0666'
		});

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(3333);
		expect(stats.gid).is.deep.equal(4444);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0666');
	});
});

describe('syncFileMetaData', () => {
	it('Sync file with file', () => {
		mockfs({
			'source.txt' : mockfs.file({
				uid  : 1234,
				gid  : 4321,
				mode : parseInt(755, 8),
			}),
			'target.txt' : mockfs.file({
				uid  : 3000,
				gid  : 3000,
				mode : parseInt('644', 8),
			}),
		});

		file_utils.syncFileMetaData('source.txt', 'target.txt');

		let stats = fs.statSync('target.txt');
		expect(stats.uid).is.deep.equal(1234);
		expect(stats.gid).is.deep.equal(4321);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0755');

		mockfs.restore();
	});
});
