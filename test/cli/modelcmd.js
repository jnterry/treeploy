/**
 * Tests the --modelcmd CLI flag
 */

require('../common.js');

let dot_template_dump_data = `{
"data": {{= JSON.stringify(data, null, '  ') }}
}`;

afterEach(() => {
	mockfs.restore();
});

function runTestExpectError(name, args){
	it(name, () => {
		mockfs({
			'model.json.dot' : dot_template_dump_data,
		});

		return treeploy_cli(['model.json.dot', 'model.json'].concat(args))
			.then((exit_code) => {
				expect(exit_code).is.not.deep.equal(0);
				expectNone('model.json');
			});
	});
}

function runTestExpectSuccess(name, args, expected_model){
	it(name, () => {
		mockfs({
			'model.json.dot' : dot_template_dump_data,
		});

		return treeploy_cli(['model.json.dot', 'model.json'].concat(args))
			.then((exit_code) => {
				expect(exit_code).is.deep.equal(0);
				expectFile('model.json', { content: { data: expected_model } });
			});
	});
}

runTestExpectError(
	'No argument to flag will cause non-zero exit status',
	['--modelcmd']);
runTestExpectError(
	'Command exiting unsuccessfully will cause non-zero exit status',
	['--modelcmd', '/bin/false']);
runTestExpectError(
	'Command exiting unsuccessfully will cause non-zero exit status - with <field> arg',
	['--modelcmd', 'field.name', '/bin/false']);
runTestExpectError(
	'Running non-existiant command will cause non-zero exit status',
	['--modelcmd', './a_script_that_doesnt_exist.sh']);
runTestExpectError(
	'Command outputting malformed json will cause non-zero exit status',
	['--modelcmd', 'echo "a : { \n}"']);

runTestExpectSuccess(
	'Can load single full model',
	['--modelcmd', `echo '{ "data": { "a": 3,\n"b": "test" } }'`],
	{
		a: 3,
		b: 'test',
	});

runTestExpectSuccess(
	'Can load JSON object into a sub field',
	['--modelcmd', 'data.user', `echo '{ "name": "Bob",\n"age": 42 }'`],
	{
		user: {
			name: "Bob",
			age: 42,
		}
	});

runTestExpectSuccess(
	'Can load JSON fragment into a sub field',
	['--modelcmd', 'data.host.ip', `echo '"127.0.0.1"'`],
	{
		host: {
			ip: "127.0.0.1"
		}
	});
