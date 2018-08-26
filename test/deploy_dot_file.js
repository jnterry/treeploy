/**
 * Test suite for testing the deployment of .dot files
 */

const expect     = require('chai').expect;
const mockfs     = require('mock-fs');
const fs         = require('fs');

const file_utils = require('../src/file_utils.js');
const treeploy   = require('../src/index.js');

it('Single template, single model', () => {
	mockfs({
		source : {
			'hello.txt.dot': 'Hello {{= it.name }}!'
		},
	});

	return treeploy('source', 'target', {
		dot_models: {
			it: {
				name: 'Bob Smith'
			},
		},
	}).then(() => {
		expect(fs.existsSync  ('target/hello.txt.dot')         ).is.false;
		expect(fs.existsSync  ('target/hello.txt'    )         ).is.true;
		expect(fs.statSync    ('target/hello.txt'    ).isFile()).is.true;

		let content = fs.readFileSync('target/hello.txt').toString('utf8');
		expect(content).is.deep.equal('Hello Bob Smith!');
	}).finally(() => {
		mockfs.restore();
	});
});

it('Multiple templates, single model', () => {
	mockfs({
		source : {
			'hello.txt.dot': 'Hello {{= it.name }}!',
			dir : {
				'bye.dot': 'Bye {{= it.name }} :('
			},

		},
	});

	return treeploy('source', 'target', {
		dot_models: {
			it: {
				name: 'Bob Smith'
			},
		},
	}).then(() => {
		expect(fs.existsSync  ('target/hello.txt.dot')         ).is.false;
		expect(fs.existsSync  ('target/hello.txt'    )         ).is.true;
		expect(fs.statSync    ('target/hello.txt'    ).isFile()).is.true;
		let content = fs.readFileSync('target/hello.txt').toString('utf8');
		expect(content).is.deep.equal('Hello Bob Smith!');

		expect(fs.existsSync  ('target/dir/bye.dot'  )         ).is.false;
		expect(fs.existsSync  ('target/dir/bye'      )         ).is.true;
		expect(fs.statSync    ('target/dir/bye'      ).isFile()).is.true;
		content = fs.readFileSync('target/dir/bye').toString('utf8');
		expect(content).is.deep.equal('Bye Bob Smith :(');
	}).finally(() => {
		mockfs.restore();
	});
});

it('File named .dot is not processed', () => {
	mockfs({
		source : {
			'.dot': 'Hello {{= it.name }}!',
		},
	});

	return treeploy('source', 'target', {
		dot_models: {
			it: {
				name: 'Bob Smith'
			},
		},
	}).then(() => {
		expect(fs.existsSync  ('target/.dot')         ).is.true;
		expect(fs.statSync    ('target/.dot').isFile()).is.true;
		let content = fs.readFileSync('target/.dot').toString('utf8');
		expect(content).is.deep.equal('Hello {{= it.name }}!');
	}).finally(() => {
		mockfs.restore();
	});
});
