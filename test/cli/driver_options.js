/**
 * Tests parsing of driver options
 */

require('../common.js');

const rewire = require('rewire');

const TreeployCli = rewire('../../src/cli.ts');

let parseOpts = TreeployCli.__get__("parseOptionalArguments");

describe('Invalid options', () => {
	it(('No field or value due to end of args'), () => {
		expect(() => parseOpts['--sourcedriver']).to.throw;
		expect(() => parseOpts['--targetdriver']).to.throw;
	});

	it(('No value due to end of args'), () => {
		expect(() => parseOpts['--sourcedriver', 'field.name']).to.throw;
		expect(() => parseOpts['--targetdriver', 'field.name']).to.throw;
	});

	it(('No field or value due to next flag'), () => {
		expect(() => parseOpts['--sourcedriver', '--sourcedriver', 'field.name', 'thing']).to.throw;
		expect(() => parseOpts['--targetdriver', '--model', 'field.name', 'thing']).to.throw;
	});

	it(('No field due to next flag'), () => {
		expect(() => parseOpts['--sourcedriver', 'hi', '--sourcedriver', 'field.name', 'thing']).to.throw;
		expect(() => parseOpts['--targetdriver', 'hi', '--model', 'field.name', 'thing']).to.throw;
	});
});

describe('Valid options', () => {

	it('Single setting', () => {
		let opts = parseOpts(['--sourcedriver', 'name', 'blob']);
		expect(opts.sourcedriver).is.deep.equal({ name: 'blob' });
		expect(opts.targetdriver).is.deep.equal({});
	});

	it('Setting per driver', () => {
		let opts = parseOpts([
			'--sourcedriver', 'name', 'local',
			'--targetdriver', 'ssh_key', 'PRIVATE_KEY',
		]);
		expect(opts.sourcedriver).is.deep.equal({ name: 'local' });
		expect(opts.targetdriver).is.deep.equal({ ssh_key: 'PRIVATE_KEY' });
	});

	it('Setting multiple deep fields', () => {
		let opts = parseOpts([
			'--sourcedriver', 'name', 'ssh',
			'--sourcedriver', 'ssh.user.name', 'root',
			'--sourcedriver', 'ssh.user.password', 'letmein',
			'--sourcedriver', 'ssh.server.port', '22',
		]);
		expect(opts.sourcedriver).is.deep.equal({
			name: 'ssh',
			ssh : {
				user: {
					name: 'root',
					password: 'letmein',
				},
				server: {
					port: 22
				}
			}
		});
		expect(opts.targetdriver).is.deep.equal({});
	});

});
