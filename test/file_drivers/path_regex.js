/**
 * Test suite that the path regexes for various file drivers are correct
 */

"use strict";

require('../common.js');

const FileDriverLocal = require('../../src/file_drivers/Local.ts').default;
const FileDriverSsh2  = require('../../src/file_drivers/Ssh2.ts').default;


let regexes = {
	local : FileDriverLocal.path_regex,
	ssh2  : FileDriverSsh2.path_regex,
};

//console.dir(regexes);
//process.exit(1);

let test_cases = [
	{ drivers: [ 'local'         ], path:  'dir' },
	{ drivers: [ 'local'         ], path:  'dir/' },
	{ drivers: [ 'local'         ], path:  '/root' },
	{ drivers: [ 'local'         ], path:  '/root/' },
	{ drivers: [ 'local'         ], path:  './dir' },
	{ drivers: [ 'local'         ], path:  '../dir' },
	{ drivers: [ 'local'         ], path:  '../dir/.' },
	{ drivers: [ 'local'         ], path:  'file.txt' },
	{ drivers: [ 'local'         ], path:  './file.txt' },
	{ drivers: [ 'local'         ], path:  '../file.txt' },
	{ drivers: [ 'local'         ], path:  'file.txt/not/really/' },

	// unix file names technically allow folders like  username@hostname:dirname
	// if a user actually wants to use a local filename like this they will need
	// to put a ./ or file:// in front of it
	{ drivers: [ 'local', 'ssh2' ], path:  'test:thing' },
	{ drivers: [ 'local'         ], path:  './test:thing' },
	{ drivers: [ 'local'         ], path:  'file://./test:thing' },
	{ drivers: [ 'local', 'ssh2' ], path:  'name@test:thing' },
	{ drivers: [ 'local'         ], path:  './name@test:thing' },
	{ drivers: [ 'local'         ], path:  'file://./name@test:thing' },
	{ drivers: [ 'local', 'ssh2' ], path:  'user@example.com:/' },
];

for(let { path, drivers } of test_cases){
	it(path + ' is ' + drivers.join(', '), () => {

		// yes, we could avoid writing all of these out by looping over the keys
		// of the regexes object, but that makes it impossible to debug these test
		// cases as every failure happends on the single expect(...) line, with no
		// indication of what the values of the loop was at the point of failre

		expect(regexes['local'].test(path)).deep.equal(drivers.indexOf('local') >= 0);
		expect(regexes['ssh2' ].test(path)).deep.equal(drivers.indexOf('ssh2' ) >= 0);
	});
}
