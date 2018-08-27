/**
 * Function which takes an array of string arguments used to implement a CLI
 * wrapper around treeploy functionality
 */

"use strict"

const fs          = require('fs');
const stdin       = require('readline-sync')
const yaml        = require('node-yaml');
const parseArgs   = require('minimist');
const path        = require('path');
const Q           = require('q');
const eval_module = require('eval');

const treeploy    = require('./index.js');

function treeploy_cli(arg_list){

	/////////////////////////////////////////////////////////
	// Deal with inputs
	if(arg_list.indexOf('-h') >= 0 || arg_list.indexOf('--help') >= 0){
		displayHelp();
		return Q(0);
	}

	if(arg_list.length < 2){
		log.error("Too few arguments\n");
		printUsage();
		return Q(1);
	}

	let input_path  = arg_list[0];
	let output_path = arg_list[1];

	if(input_path.startsWith('-') || output_path.startsWith('-')){
		log.error("Input and output paths must be first two arguments - place flags afterwards\n");
		printUsage();
		return Q(1);
	}

	let options = {};
	try {
		// cut off the input and output path, then parse remaining arguments
		options = parseOptionalArguments(arg_list.splice(2));
		if(options == null){ return Q(0); }
	} catch (e) {
		log.error(e.message);
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



	/////////////////////////////////////////////////////////
	// Run treeploy
	return treeploy(input_path, output_path, options)
		.then(() => 0)
		.catch((e) => {
			log.error(e.message);
			return Q(1)
		});
	/////////////////////////////////////////////////////////
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

      --model <param>    Sets a particular field of the model pass to doT templates
                           <param> should be of the format 'model.field.name=value'
                           value will be interpreted as a string, unless it can be
                           parsed as either a float or integer. This behaviour can
                           be disabled by using quotes, for example: model.number=\'123\'


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
				return null;
			case '--noroot'    : options.noroot    = true; break;
			case '--overwrite' : options.overwrite = true; break;

				// arguments with parameters
			case '--modelfile' :
			case '--model':

				let arg   = arg_list[i+0];
				let value = arg_list[i+1];

				if(value == null || value.startsWith('-')){
					throw new Error("Expected value to be specified for argument " +
													arg + ", got: " + value);
				}
				i++;

				switch(arg){
					case '--modelfile':
						loadModelFile(value, options);
						break;
					case '--model':
						setModelValue(value, options);
						break;
				}

				break;
			default:
				throw new Error("Unexpected argument: " + arg_list[i]);
		}
	}

	return options;
}

/**
 * Loads a doT.js model file
 *
 * @param {string} value - The argument to the --modelfile CLI flag, should be
 * of the form 'model.field=./filename.json' or './filename.json', in later case
 * entire options.dot_models variable will be set to file contents
 * File to load must have one of following extensions: .js, .json, .yaml or .yml
 *
 * @param {object} options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function loadModelFile(value, options){

	let parts = value.split('=');

	let model_path = '';
	let file_name  = null;
	if(parts.length === 1){
		file_name = parts[0];
	} else if (parts.length === 2){
		model_path = parts[0];
		file_name  = parts[1];
	} else {
		throw new Error(
			"Invalid argument to --modelfile flag, got: '" + value +
			"', must be of form 'model.field=./filename' or './filename'"
		);
	}


	let extension = file_name.split('.').pop();

	if(['yaml', 'yml', 'js', 'json'].indexOf(extension) < 0){
		throw new Error(
			"Model file must have one of following extensions: .js, .json. .yaml, .yml"
		);
	}

	if(!fs.existsSync(file_name) || !fs.statSync(file_name).isFile()){
		throw new Error(
			"Specified model file does not exist or is not a file, path: " + file_name
		);
	}

	let loaded_data = null;

	try {
		switch(extension){
			case 'yaml':
			case 'yml': {
				let content = fs.readFileSync(file_name);
				loaded_data = yaml.parse(content);
				break;
			}
			case 'json': {
				let content = fs.readFileSync(file_name);
				loaded_data = JSON.parse(content);
				break;
			}
			case 'js':
				try {
					// standard require(...) does not work in context of test cases,
					// nor when compiled using pkg -> hence we load the module source
					// and eval it
					// :TODO: -> can we load a module which require(...)'s a module?
					let content = fs.readFileSync(file_name);
					loaded_data = eval_module(content);
				} catch (e) {
					console.log(e);
					throw new Error('Error evaluating js module: ' + e.toString());
				}
				break;
		}
	} catch (e) {
		throw new Error("Failed to load modelfile '" + file_name + "': " + e.message);
	}

	setModelField(model_path, loaded_data, options);
}

/**
 * Sets a doT.js model value given the command line parameter
 *
 * @param {string} value - Value given to the --model CLI flag, should be of
 * form 'model.field.name=value'
 *
 * @param {object} options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function setModelValue(value, options){
	let parts = value.split('=');

	let field_name  = parts[0];
	let field_value = parts[1];

	if(parts.length != 2 || field_name === ''){
		throw new Error("--model argument expects value of form 'field.name=value', " +
										"got: '" + value + "'");
	}

	if(field_value.match(/^[0-9]+$/)){
		field_value = parseInt(field_value);
	} else if(field_value.match(/^(\+|-)?[0-9]*\.[0-9]+$/)){
		field_value = parseFloat(field_value);
	} else if((field_value.startsWith("'") && field_value.endsWith("'")) ||
		 (field_value.startsWith('"') && field_value.endsWith('"'))
	){
		// Then a string has been quoted on the command line (this might
		// be so we don't interpret a string that looks like an int as an
		// int, but leave it as a string)
		// Remove the quotes
		field_value = field_value.substr(1, field_value.length-2);
	}

	setModelField(field_name, field_value, options);
}

/**
 * Sets some field of the doT.js model in options
 *
 * Note, this function will create any intermediate objects, eg
 * if setting web.host.domain it will create the host object within
 * web, and then set the domain field of that
 *
 * @param {string} field_name - Name of field, may contain dots to indicate
 * fields within objects
 *
 * @param {any}    field_value - The value to set the field to
 *
 * @param {object} options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function setModelField(field_name, field_value, options){
	if(field_name === ''){
		options.dot_models = field_value;
		return;
	}

	let field_parts = field_name.split('.');
	let object_node = options.dot_models;
	for(let i = 0; i < field_parts.length - 1; ++i){
		if(object_node[field_parts[i]] == null){
			object_node[field_parts[i]] = {};
		}
		object_node = object_node[field_parts[i]];
	}
	object_node[field_parts[field_parts.length-1]] = field_value;
}

module.exports = treeploy_cli;
