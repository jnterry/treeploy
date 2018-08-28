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
		expect(fs.existsSync  ('target/.dot')         ).is.true;
		expect(fs.statSync    ('target/.dot').isFile()).is.true;
		let content = fs.readFileSync('target/.dot').toString('utf8');
		expect(content).is.deep.equal('Hello {{= it.name }}!');
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
