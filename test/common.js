/**
 * Code common to all test cases
 */

global.mockfs       = require('mock-fs');
global.fs           = require('fs');

global.file_utils   = require('../src/file_utils.js');
global.treeploy     = require('../src/index.js');
global.treeploy_cli = require('../src/cli.js');

const chai = require('chai');
chai.use(require('chai-as-promised'));
global.expect = chai.expect;

function genName(name){
	if(typeof name === 'string'){ return name; }

	if(Array.isArray(name)){
		let full_name = name[0];
		for(let i = 1; i < name.length; ++i){
			if(!full_name.endsWith('/')){ full_name += '/'; }
			full_name += name[i];
		}

		return full_name;
	}

	throw "Can't gen name from arg";
}

function checkStats(stats, opts){
	if(opts == null){ return; }

	if(opts.mode != null){
		expect(file_utils.getStatPermissionString(stats)).is.deep.equal(opts.mode);
	}

	if(opts.uid != null){
		expect(stats.uid).is.deep.equal(opts.uid);
	}

	if(opts.gid != null){
		expect(stats.gid).is.deep.equal(opts.gid);
	}
}


global.expectDir = function(name_arg, opts){
	let name = genName(name_arg);

	expect(fs.existsSync(name)).is.true;

	let stats = fs.statSync(name);
	expect(stats.isDirectory()).is.true;
	checkStats(stats, opts);
}


global.expectFile = function(name_arg, opts){
	let name = genName(name_arg);

	expect(fs.existsSync(name)).is.true;

	let stats = fs.statSync(name);
	expect(stats.isFile()).is.true;
	checkStats(stats, opts);

	if(opts != null && opts.content != null){
		let content = fs.readFileSync(name).toString();

		if (typeof opts.content === 'object'){
			content = JSON.parse(content);
		}

		expect(content).is.deep.equal(opts.content);
	}
}

global.expectNone = function(name_arg){
	expect(fs.existsSync(genName(name_arg))).is.false;
}
