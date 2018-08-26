/**
 * Test suite for when treeploy is called on a single input file, rather
 * than an input directory
 */

"use strict";

const expect     = require('chai').expect;
const mockfs     = require('mock-fs');
const fs         = require('fs');

const file_utils = require('../src/file_utils.js');
const treeploy   = require('../src/index.js');


it('Standard File', () => {
	mockfs({
		'test.txt' : mockfs.file({
			content : 'Hello world!',
			uid     : 1122,
			gid     : 2211,
			mode    : parseInt('765', 8),
		})
	});

	return treeploy('test.txt', 'out.txt').then(() => {
		expect(fs.existsSync  ('out.txt')         ).is.true;
		expect(fs.statSync    ('out.txt').isFile()).is.true;

		let content = fs.readFileSync('target/hello.txt').toString('utf8');
		expect(content).is.deep.equal('Hello world!');

		let stats = fs.statFileSync('out.txt');
		expect(stats.uid).is.deep.equal(1122);
		expect(stats.fid).is.deep.equal(2211);
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0765');

	}).finally(() => {
		mockfs.restore();
	});
});

it('tree.yaml', () => {
	mockfs({
		'tree.yaml' : '- test.txt\n- dir/',
	});

	return treeploy('tree.yaml', 'output').then(() => {
		expect(fs.existsSync  ('tree.yaml'       )              ).is.true;
		expect(fs.existsSync  ('output/'         )              ).is.true;
		expect(fs.statSync    ('output/'         ).isDirectory()).is.true;
		expect(fs.existsSync  ('output/tree.yaml')              ).is.false;
		expect(fs.existsSync  ('output/test.txt' )              ).is.true;
		expect(fs.statSync    ('output/test.txt' ).isFile()     ).is.true;
		expect(fs.existsSync  ('output/dir'      )              ).is.true;
		expect(fs.statSync    ('output/dir'      ).isDirectory()).is.true;
	}).finally(() => {
		mockfs.restore();
	});
});

it('Dot Template', () => {
	mockfs({
		'a.dot' : 'Hi {{= it.name }}',
	});

	return treeploy('tree.yaml', 'output', {
		dot_models: {
			it: { name: 'bob' }
		}
	}).then(() => {
		expect(fs.existsSync  ('a.dot')              ).is.true;
		expect(fs.statSync    ('a.dot').isFile()     ).is.true;
		expect(fs.readFileSync('a.dot').toString()).is.deep.equal('Hi {{= it.name }}');
		expect(fs.existsSync  ('a'    )              ).is.true;
		expect(fs.statSync    ('a'    ).isFile()     ).is.true;
		expect(fs.readFileSync('a'    ).toString()).is.deep.equal('Hi bob');


	}).finally(() => {
		mockfs.restore();
	});
});
