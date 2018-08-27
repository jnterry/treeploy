/**
 * Tests the --model CLI flag
 */

"use strict";

require('../common.js');

let dot_template_dump_data = `{
"data": {{= JSON.stringify(data, null, '  ') }}
}`;

function runTestExpectError(name, args){
	it(name, () => {
		return treeploy_cli(['model.json.dot', 'model.json'].concat(args))
			.then((exit_code) => {
				expect(exit_code).is.not.deep.equal(0);
				expectNone('model.json');
			});
	});
}

function runTestExpectSuccess(name, args, expected_model){
	it(name, () => {
		return treeploy_cli(['model.json.dot', 'model.json'].concat(args))
			.then((exit_code) => {
				expect(exit_code).is.deep.equal(0);
				expectFile('model.json');

				let data = JSON.parse(fs.readFileSync('model.json'));
				expect(data.data).is.deep.equal(expected_model);
			});
	});
}

beforeEach(() => {
	mockfs({
		'model.json.dot' : dot_template_dump_data,
	});
});

afterEach(() => {
	mockfs.restore();
});

runTestExpectError('No model', []);
runTestExpectError('Missing <field> and <value> with single flag',
									 ['--model']);
runTestExpectError('Missing <value> with single flag',
									 ['--model', 'test']);
runTestExpectError('Missing <field> and <value> with multiple flag',
									 ['--model', 'test', '3', '--model']);
runTestExpectError('Missing <value> with multiple flag',
									 ['--model', 'test', '--overwrite', '--model', 'thing', 'a']);

runTestExpectSuccess(
	'Single string',
	['--model', 'data', 'hello'],
	'hello'
);



runTestExpectSuccess(
	'Single int',
	['--model', 'data', '123'],
	123
);
runTestExpectSuccess(
	'Quoted int string',
	['--model', 'data', "'123'"],
	'123'
);
runTestExpectSuccess(
	'Double quoted int string',
	['--model', 'data', '"123"'],
	'123'
);



runTestExpectSuccess(
	'Single float',
	['--model', 'data', '9.5'],
	9.5
);
runTestExpectSuccess(
	'Quoted float string',
	['--model', 'data', "'9.5'"],
	'9.5'
);
runTestExpectSuccess(
	'Double quoted float string',
	['--model', 'data', '"9.5"'],
	'9.5'
);



runTestExpectSuccess(
	'Build flat object',

	['--model', 'data.greeting', 'hello',
	 '--model', 'data.name', 'bob',
	],

	{
		greeting: 'hello',
		name: 'bob'
	}
);

runTestExpectSuccess(
	'Build deep object',

	['--model', 'data.greeting',       'hello',
	 '--model', 'data.user.name',      'bob',
	 '--model', 'data.user.age',       '32',
	 '--model', 'data.user.dob.month', 'may'
	],

	{
		greeting: 'hello',
		user : {
			name: 'bob',
			age: 32,
			dob: {
				month: 'may'
			}
		}
	});
