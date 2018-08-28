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
const execSync    = require('child_process').execSync;

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
  treeploy INPUT_PATH OUTPUT_PATH [options]

Options:
	` +
		/**********************************************/
		/* IGNORE THE FACT THE TABLE LINES ARE JAGGED */
		/*   THEY LINE UP WHEN PRINTED DUE TO ESCAPE  */
		/*       CHARACTER SEQUENCES LIKE \\          */
		/**********************************************/`
#=====================#========================================================+
| -v, --verbose       | Increases verbosity level                              |
|                     | Can be used multiple times with the following effects: |
|                     |   0 : errors only                                      |
|                     |   1 : above and warnings                               |
|                     |   2 : above and info/debug messages                    |
|                     |   3 : above and trace messages                         |
#=====================#========================================================#
| --overwrite         | Disable CLI nag when the destination path exists.      |
|                     | The program will overwrites any conflicting paths      |
+---------------------+--------------------------------------------------------+
| --noroot            | Disable CLI nag when running as user other than root   |
|                     | Program may fail to set permissions on files           |
#=====================#========================================================#
| --model \\           | Sets a field of the model passed to doT templates      |
|     <field> <value> |                                                        |
|                     | Conceptually the model should be thought of as a JSON  |
|                     | object that is accessable globally in the dot template |
|                     |                                                        |
|                     | <field> should be of the form: 'field.name'            |
|                     |                                                        |
|                     | <value> will be parsed as a string, unless it can be   |
|                     | parsed as a float or integer; this can be prevented    |
|                     | using quotes, for example: model.number=\\'123\\'        |
|                     |                                                        |
|                     | Example: --model version.commit $(git rev-parse HEAD)  |
+---------------------+--------------------------------------------------------+
| --modelfile \\       | Loads a yaml or json file at the path given by <file>  |
|      <field> <file> | and merges the data into the current model             |
|                     |                                                        |
| --modelfile <file>  | <field> should be of the form 'field.name'             |
#---------------------+--------------------------------------------------------+
| --modelcmd \\        | Executes some command, parse it's stdout as JSON and   |
|       <field> <cmd> | then treats it as with data loaded by --modelfile      |
|                     |                                                        |
| --modelcmd <cmd>    | Example: --modelcmd host.ip \\                          |
|                     |             'curl "https://api.ipify.org?format=json"' |
#=====================#=========================================================
| -h, --help          | Display this help infomation                           |
#=====================#=========================================================
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
			case '--model':
			case '--modelfile' :
			case '--modelcmd':
				let arg   = arg_list[i+0];
				let field = arg_list[i+1];
				let value = arg_list[i+2];

				if(field == null || field.startsWith('-')){
					throw new Error("Expected <field> to be specified for flag " +
													arg + ", got: " + field);
				}

				if(value == null || value.startsWith('-')){
					value = field;
					field = '';
					i += 1; // skip the single value argument
				} else {
					i += 2; // skip the <field> <value> arguments
				}

				switch(arg){
					case '--model':
						if(field === ''){
							throw new Error("<field> argument is mandatory for --model flag");
						}
						processFlagModel(field, value, options);
						break;
					case '--modelfile':
						processFlagModelFile(field, value, options);
						break;
					case '--modelcmd':
						processFlagModelCmd(field, value, options);
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
 * File to load must have one of following extensions: .json, .yaml or .yml
 *
 * @param {object} options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function processFlagModelFile(model_path, file_name, options){
	let extension = file_name.split('.').pop();

	if(['yaml', 'yml', 'json'].indexOf(extension) < 0){
		throw new Error(
			"Model file must have one of following extensions: .json. .yaml, .yml"
		);
	}

	if(!fs.existsSync(file_name) || !fs.statSync(file_name).isFile()){
		throw new Error(
			"Specified model file does not exist or is not a file, path: " + file_name
		);
	}

	let content = fs.readFileSync(file_name);

	let loaded_data = null;
	try {
		switch(extension){
			case 'yaml' : loaded_data = yaml.parse(content); break;
			case 'yml'  : loaded_data = yaml.parse(content); break;
			case 'json' : loaded_data = JSON.parse(content); break;
		}
	} catch (e) {
		throw new Error("Failed to parse modelfile '" + file_name + "': " + e.message);
	}

	setModelField(model_path, loaded_data, options);
}

/**
 * Sets a doT.js model value given the command line flag's arguments
 *
 * @param {string} field_name  - The name of the field to modify
 * @param {string} field_value - The new value for field
 *
 * @param {object} options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function processFlagModel(field_name, field_value, options){
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

function processFlagModelCmd(field, cmd, options){
	let cmd_result = execSync(cmd);
	let cmd_stdout = cmd_result.toString('utf8');
	try {
		let data = JSON.parse(cmd_stdout);
		setModelField(field, data, options);
	} catch (e) {
		throw new Error("modelcmd output invalid JSON: " + e.message);
	}
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
		options.dot_models = Object.assign(options.dot_models, field_value);
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

	let field = field_parts[field_parts.length-1];

	if(typeof field_value === 'object'){
		// If the field_value is an object then merge the current value
		// with the new one, hence we will not overwrite fields that
		// currently exist in the model, but that do not exist in the new field_value
		object_node[field] = Object.assign(object_node[field] || {}, field_value);
	} else {
		object_node[field] = field_value;
	}
}

module.exports = treeploy_cli;
