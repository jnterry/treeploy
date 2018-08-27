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
	// Parse inputs
	let argv = parseArgs(arg_list, {
		alias: {
			warn      : ['v', 'verbose'],
			debug     : [],
			trace     : [],
			help      : ['h'],
			overwrite : [],
			noroot    : [],
		},
	});
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Display help
	if(argv.help){
		displayHelp();
		return Q(0);
	}
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Process inputs
	let options = {
		verbosity: 0,
	};
	let input_path    = argv['_'][0];
	let output_path   = argv['_'][1];
	let dot_vars_file = argv['_'][2];

	if(input_path == null || output_path == null){
		console.log("Usage: build_appdata.js INPUT_PATH OUTPUT_PATH [DOT_VARS_FILE]");
		return Q(1);
	}

	if(argv.verbose  ) { options.verbosity = 1; }
	if(argv.debug    ) { options.verbosity = 2; }
	if(argv.trace    ) { options.verbosity = 3; }
	if(argv.overwrite) { options.overwrite = true; }
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Check if we are root
	if(!argv.noroot && process.getuid() != 0){
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
	if(!argv.overwrite && fs.existsSync(output_path)){
		let out_stat = fs.statSync(output_path);

		console.log("The output path already exists, it, or its decendents may be overwritten");

		let response = stdin.question("Continue? [y/N] ");
		if(!response.match('[Yy]|[Yy][Ee][Ss]')){
			return Q(0);
		}
		options.overwrite = true;
	}
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Load dot_vars_file
	let dot_vars = null;
	if(dot_vars_file != null){
		if(!fs.existsSync(dot_vars_file)){
			console.error("Specified dot vars file does not exist");
			return Q(1);
		}
		if(dot_vars_file.endsWith('.yaml') || dot_vars_file.endsWith('.yaml')){
			dot_vars = yaml.readSync(dot_vars_file);
		} else if (dot_vars_file.endsWith('.json')){
			dot_vars = JSON.parse(fs.readFileSync(dot_vars_file, 'utf8'));
		} else if (dot_vars_file.endsWith('.js')){
			dot_vars = require(path.resolve(dot_vars_file));
		} else {
			console.error("Specified dot vars file has unrecognised format!");
			process.exit(1);
		}
		options.dot_models.it = dot_vars;
	}
	/////////////////////////////////////////////////////////


	return treeploy(input_path, output_path, options).then(() => 0);
}


function displayHelp(){
	console.log(`
Usage:
  treeploy INPUT_PATH OUTPUT_PATH [DOT_VARS_FILE] [options]

Options:

      --warn             Enables printing of warnings
  -v  --verbose,--debug  Enables printing of debug messages, implies --warn
      --trace            Enables printing of trace message, implies --debug

      --overwrite        Disable CLI nag that destination path exists, always overwrites
      --noroot           Disable CLI nag that we are running as non-root, run anyway

  -h  --help             Display this help infomation
	`);
}

module.exports = treeploy_cli;
