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


it('Single template, multi-model', () => {
	mockfs({
		source : {
			'test.json.dot': `
{
	"web": {
		"domain": "{{= web.domain }}",
		"port": {{= web.port }}
	},
	"db": {
		"user": "user_name",
		"password": "{{= secrets.db_password }}"
	}
}`
		},
	});

	return treeploy('source', 'target', {
		dot_models: {
			web: {
				domain: 'test.example.com',
				port: 80
			},
			secrets: { db_password: 'password1234' }
		},
	}).then(() => {
		expect(fs.existsSync  ('target/test.json')         ).is.true;
		expect(fs.statSync    ('target/test.json').isFile()).is.true;

		let data = JSON.parse(fs.readFileSync('target/test.json'));

		expect(data).is.deep.equal({
			web: {
				domain: "test.example.com",
				port: 80
			},
			db: {
				user: "user_name",
				password: "password1234",
			},
		});
	}).finally(() => {
		mockfs.restore();
	});
});
