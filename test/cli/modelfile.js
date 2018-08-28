/**
 * Tests the --modelfile CLI flag
 */

"use strict";

require('../common.js');

let dot_template_dump_data = `{
"data": {{= JSON.stringify(data, null, '  ') }}
}`;

afterEach(() => {
	mockfs.restore();
});

function runTestExpectError(name, modelfile_name, modelfile_content, args){
	it(name, () => {
		mockfs({
			'model.json.dot' : dot_template_dump_data,
			[modelfile_name] : modelfile_content
		});

		return treeploy_cli(['model.json.dot', 'model.json'].concat(args))
			.then((exit_code) => {
				expect(exit_code).is.not.deep.equal(0);
				expectNone('model.json');
			});
	});
}

function runTestExpectSuccess(name, modelfile_name, modelfile_content, args, expected_model){
	it(name, () => {
		mockfs({
			'model.json.dot' : dot_template_dump_data,
			[modelfile_name] : modelfile_content
		});

		return treeploy_cli(['model.json.dot', 'model.json'].concat(args))
			.then((exit_code) => {
				expect(exit_code).is.deep.equal(0);
				expectFile('model.json', { content: { data: expected_model }} );
			});
	});
}

runTestExpectError(
	'No argument to flag will cause non-zero exit code',
	'file', 'content',
	['--modelfile']);
runTestExpectError(
	'Attempting to load non-existant --modelfile will cause non-zero exit code',
	'test.yaml', 'thing: 1',
	['--modelfile', 'test.json']);
runTestExpectError(
	'Attempting to load --modelfile with bad extension will cause non-zero exit code',
	'test.txt', 'thing: 1',
	['--modelfile', 'test.txt']);
runTestExpectError(
	'Malformed yaml will cause non-zero exit code',
	'test.yaml', ':\n   :\n:{}-\n-',
	['--modelfile', 'test.yaml']);
runTestExpectError(
	'Malformed json will cause non-zero exit code',
	'test.json', ':::',
	['--modelfile', 'test.json']);

runTestExpectSuccess(
	'Single yaml for all',
	'data.yaml',
	`
data:
    name: 'Bob'
    age: 45
	`,
	['--modelfile', 'data.yaml'],
	{
		name: 'Bob',
		age: 45
	}
);

runTestExpectSuccess(
	'Single yml for specified field',
	'data.yml',
	'a: 3\nb: 5',
	['--modelfile', 'data', 'data.yml'],
	{ a: 3, b: 5 }
);

runTestExpectSuccess(
	'Single json for specified sub-field',
	'data.json',
	'{ "name": "Tim", "age": 32 }',
	['--modelfile', 'data.person', 'data.json'],
	{
		person : {
			name: 'Tim',
			age: 32
		}
	}
);

runTestExpectSuccess(
	'Other flags can terminate arguments to --modelfile flag',
	'data.json',
	'{ "data": { "name": "Tim", "age": 32 } }',
	// if we don't recognise the -v then we may try to set the field 'data.json'
	// to the contents of the file '-v'
	['--modelfile', 'data.json', '-v'],
	{
		name: 'Tim',
		age: 32
	}
);
