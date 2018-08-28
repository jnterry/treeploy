/**
 * Tests a combination of the --modelfile and --model CLI flag in particular
 * checking that the order of one load overwriting another is correct
 */

"use strict";

require('../common.js');
const fs = require('fs');

let dot_template_dump_data = `{
"web": {{= JSON.stringify(web, null, '  ') }},
"db" : {{= JSON.stringify(db,  null, '  ') }}
}`;

it('Complex scenario', () => {

	mockfs({
		'model.json.dot' : dot_template_dump_data,

		'base.json' : JSON.stringify({
			web: {
				domain : 'example.com',
				port   : 8080
			},
			db : {
				username: 'root',
				password: 'letmein'
			},
		}, null, '  '),

		'db_params.yaml' : "host: 'db.example.com'\nport: 3306\npassword: '1234'",

	});

	return treeploy_cli(
		['model.json.dot', 'model.json',
		 '--modelfile', './base.json',
		 '--model', 'web.port', '443',
		 '--modelfile', 'db', 'db_params.yaml',
		 '--model', 'db.thing.goes.here', '8',
		])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			expectFile('model.json');

			let data = JSON.parse(fs.readFileSync('model.json'));

			expect(data).is.deep.equal({
				web: {
					domain: 'example.com',
					port  : 443,
				},
				db: {
					host: 'db.example.com',
					port: 3306,
					username: 'root',
					password: '1234',
					thing: { goes: { here: 8 } },
				},
			});
		})
		.finally(() => {
			mockfs.restore();
		});
});
