/**
 * Test suite for functions defined in file_utils.js
 */

"use strict";

const expect     = require('chai').expect;
const mockfs     = require('mock-fs');
const fs         = require('fs');

const file_utils = require('../src/file_utils.js');

function getStatPermissionString(stats){
	return '0' + (stats.mode & parseInt('777', 8)).toString(8);
}

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
		expect(getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set owner individually', () => {

		file_utils.applyFilePermissions('test.txt', { owner: 1234 });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(1234);
		expect(stats.gid).is.deep.equal(3000);
		expect(getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set group individually', () => {

		file_utils.applyFilePermissions('test.txt', { group: 4321 });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(3000);
		expect(stats.gid).is.deep.equal(4321);
		expect(getStatPermissionString(stats)).is.deep.equal('0644');
	});

	it('Can set mode individually', () => {

		file_utils.applyFilePermissions('test.txt', { mode: '0777' });

		let stats = fs.statSync('test.txt');
		expect(stats.uid).is.deep.equal(3000);
		expect(stats.gid).is.deep.equal(3000);
		expect(getStatPermissionString(stats)).is.deep.equal('0777');
	});

});
