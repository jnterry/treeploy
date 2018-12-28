/**
 * Test suite for testing the deployment of .dot files
 */

require('../common.js');

afterEach(() => {
	mockfs.restore();
});

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
		expectNone('target/hello.txt.dot');
		expectFile('target/hello.txt', { content: 'Hello Bob Smith!' });
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
		expectNone('target/hello.txt.dot');
		expectFile('target/hello.txt', { content: 'Hello Bob Smith!' });

		expectNone('target/dir/bye.dot');
		expectFile('target/dir/bye', { content: 'Bye Bob Smith :(' });
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
		expectFile('target/.dot', { content: 'Hello {{= it.name }}!' });
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
		expectFile('target/test.json', {
			content: {
				web: {
					domain: "test.example.com",
					port: 80
				},
				db: {
					user: "user_name",
					password: "password1234",
				},
			}
		});
	});
});

it('Require with no models', () => {
	mockfs({
		source : {
			'test.txt.dot': `{{ let path = require('path'); }}{{= path.dirname('/test/dir/file.txt') }}`
		},
	});

	return treeploy('source', 'target', {
	}).then(() => {
		expectFile('target/test.txt', {
			content: '/test/dir'
		});
	});
});

it('Require with models', () => {
	mockfs({
		source : {
			'test.txt.dot': `{{ let path = require('path'); }}{{= path.dirname(dirs.thing) }}`
		}
	});

	return treeploy('source', 'target', {
		dot_models : {
			dirs : { thing : '/hello/world/file.txt' }
		}
	}).then(() => {
		expectFile('target/test.txt', {
			content: '/hello/world'
		});
	});
});

it('Missing module fails', () => {
	mockfs({
		source : {
			'test.txt.dot': `{{= path.dirname('/hello/world/file.txt') }}`
		}
	});

	return expect(treeploy('source', 'target', {
		dot_models : {
			dirs : { thing : '/hello/world/file.txt' }
		}
	})).to.be.rejected;
});
