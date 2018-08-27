/**
 * Function which takes an array of string arguments used to implement a CLI
 * wrapper around treeploy functionality
 */

"use strict"

const fs         = require('fs');
const stdin      = require('readline-sync')
const yaml       = require('node-yaml');
const parseArgs  = require('minimist');
const path       = require('path');
const Q          = require('q');

const treeploy   = require('./index.js');

function treeploy_cli(arg_list){

	/////////////////////////////////////////////////////////
	// Deal with inputs
	if(arg_list.indexOf('-h') > 0 || arg_list.indexOf('--help') > 0){
		displayHelp();
		return Q(0);
	}

	if(arg_list.length < 2){
		printUsage();
		return Q(1);
	}

	let input_path  = arg_list[0];
	let output_path = arg_list[1];

	if(input_path.startsWith('-') || output_path.startsWith('-')){
		printUsage();
		console.log("\nInput and output paths must be first two arguments - place flags after these!");
		return Q(1);
	}

	let options = {};
	try {
		// cut off the input and output path, then parse remaining arguments
		options = parseOptionalArguments(arg_list.splice(2));
	} catch (e) {
		console.log(e.message);
		console.log("\n");
		printUsage();
		return Q(1);
	}
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Check if we are root
	if(!options.noroot && process.getuid() != 0){
		console.log('Not running as root, may not be able set file permissions, owners, etc');
		let response = stdin.question('Continue? [y/N]');
		if(!response.match('[Yy]|[Yy][Ee][Ss]')){
			return Q(0);
		}
	}
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Check output does not exist, or if it does prompt user
	// if they want to continue
	if(!options.overwrite && fs.existsSync(output_path)){
		let out_stat = fs.statSync(output_path);

		console.log("The output path already exists, it, or its decendents may be overwritten");

		let response = stdin.question("Continue? [y/N] ");
		if(!response.match('[Yy]|[Yy][Ee][Ss]')){
			return Q(0);
		}
		options.overwrite = true;
	}
	/////////////////////////////////////////////////////////


	return treeploy(input_path, output_path, options).then(() => 0);
}

function printUsage(){
	console.log("Usage: treeploy INPUT_PATH OUTPUT_PATH [DOT_VARS_FILE]");
	console.log("       Run 'treeploy --help' for more information");
}

function displayHelp(){
	console.log(`
Usage:
  treeploy INPUT_PATH OUTPUT_PATH [DOT_VARS_FILE] [options]

Options:

  -v  --verbose          Increases verbosity level, can be specified between 0 and 3 times for:
                           0 : errors only
                           1 : above and warnings
                           2 : above and info/debug messages
                           3 : above and trace messages

      --overwrite        Disable CLI nag that destination path exists, always overwrites
      --noroot           Disable CLI nag that we are running as non-root, run anyway

  -h  --help             Display this help infomation
	`);
}

function parseOptionalArguments(arg_list){
	/////////////////////////////////////////////////////////
	// Set default options
	let options = {
		noroot     : false,
		verbosity  : 0,
		overwrite  : false,
		dot_models : {},
	};
	/////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////
	// Parse inputs

	// split any combined single char args like -ab into -a and -b
	arg_list = arg_list.map((x) => {
		if(x.match('^-[a-z][a-z]+$')){
			return x.substring(1).split('').map((char) => '-' + char);
		} else {
			return x;
		}
	});

	// collapse any produced sub-arrays into flat list
	arg_list = arg_list.reduce((a, c) => a.concat(c), []);

	for(let i = 0; i < arg_list.length; ++i){
		switch(arg_list[i]){
			case '-v':
			case '--verbose':
				++options.verbosity;
				break;
			case '-h': // this must have been in a combined argument, eg -vh, so not be caught already
				displayHelp();
				return Q(0);
			case '--noroot'    : options.noroot    = true; break;
			case '--overwrite' : options.overwrite = true; break;
			default:
				throw new Error("Unexpected argument: " + arg_list[i]);
		}
	}

	return options;
}

module.exports = treeploy_cli;
