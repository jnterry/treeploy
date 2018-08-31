/**
 * Function which takes an array of string arguments used to implement a CLI
 * wrapper around treeploy functionality
 */

"use strict"

import fs            from 'fs';
import yaml          from 'js-yaml';
import path          from 'path';
import { execSync }  from 'child_process';

import log                 from './log';
import treeploy            from './treeploy';
import { TreeployOptions } from './treeploy';

/**
 * Function implementing the command line interface to treeploy
 * @param arg_list - List of command line arguments passed to treeploy
 *
 * @return Promise which resolves to the exit code that the CLI
 * executable should exit with
 */
async function treeploy_cli(arg_list : Array <string>){

	/////////////////////////////////////////////////////////
	// Deal with inputs
	if(arg_list.indexOf('-h') >= 0 || arg_list.indexOf('--help') >= 0){
		displayHelp();
		return 0;
	}

	if(arg_list.length < 2){
		log.error("Too few arguments\n");
		printUsage();
		return 1;
	}

	let input_path  = arg_list[0];
	let output_path = arg_list[1];

	if(input_path.startsWith('-') || output_path.startsWith('-')){
		log.error("Input and output paths must be first two arguments - place flags afterwards\n");
		printUsage();
		return 1;
	}

	let options : TreeployOptions|null = null;
	try {
		// cut off the input and output path, then parse remaining arguments
		options = parseOptionalArguments(arg_list.splice(2));
		if(options == null){ return 0; }
	} catch (e) {
		log.error(e.message);
		printUsage();
		return 1;
	}
	/////////////////////////////////////////////////////////



	/////////////////////////////////////////////////////////
	// Run treeploy
	return treeploy(input_path, output_path, options)
		.then(() => 0)
		.catch((e) => {
			log.error(e.message);
			return 1;
		});
	/////////////////////////////////////////////////////////
}

/** Prints usage prompt to console */
function printUsage(){
	console.log("Usage: treeploy INPUT_PATH OUTPUT_PATH [DOT_VARS_FILE]");
	console.log("       Run 'treeploy --help' for more information");
}

/** Prints full help infomation to console */
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
| --overwrite         | Overwrite contents of existing files if nessacery      |
+---------------------+--------------------------------------------------------+
| --force             | Take all measures required to make the target state be |
|                     | as it should - for example removing a file in order to |
|                     | create a directory of the same name, or vice-versa     |
|                     | This options implies overwrite                         |
+---------------------+--------------------------------------------------------+
| -n, --noop          | Prevents any modifications being made to file system.  |
| --no-action         | Best used with -v to see what is going on
| --dryrun            | Note --overwrite and --force change what actions would |
|                     | be taken and thus affect logged output, however even   |
|                     | with those flags no actions will actually be taken     |
#=====================#========================================================#
| --model \\           | Sets a field of the model passed to doT templates      |
|     <field> <value> |                                                        |
|                     | Conceptually the model should be thought of as a JSON  |
|                     | object that is accessable globally in the dot template |
|                     |                                                        |
|                     | <field> should be of the form: 'field.name'            |
|                     |                                                        |
|                     | <value> will be parsed as a string, unless it can be   |
|                     | parsed as a float, int or bool; this can be prevented  |
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
| --sourcedriver \    | Sets an optional argument for the FileDriver to use    |
|     <field> <value> | for the source path                                    |
|---------------------|-------------------------------------------------------- |
| --targetdriver \    | Sets an optional argument for the FileDriver to use    |
|     <field> <value> | for the target path                                    |
#=====================#=========================================================
| -h, --help          | Display this help infomation                           |
#=====================#=========================================================
`);
}

/**
 * Parses extra optional flags arguments appearing after the source and
 * destination path in order to construct a TreeployOptions object
 *
 * @param arg_list - List of arguments EXCLUDING the first two which represent
 * the source and destination paths
 *
 * @return TreeployOptions object representing parsed options, or null if the
 * program should terminate without processing the source and destination
 * paths
 */
function parseOptionalArguments(arg_list : Array<string>) : TreeployOptions|null{
	let options = new TreeployOptions();

	/////////////////////////////////////////////////////////
	// Parse inputs

	// split any combined single char args like -ab into -a and -b
	arg_list = <Array<string>>arg_list.map((x) => {
		if(x.match('^-[a-z][a-z]+$')){
			return x.substring(1).split('').map((char) => '-' + char);
		} else {
			return x;
		}
	});

	// collapse any produced sub-arrays into flat list
	arg_list = arg_list.reduce((a, c) => a.concat(c), <Array<string>>[]);

	for(let i = 0; i < arg_list.length; ++i){
		switch(arg_list[i]){
			case '-v':
			case '--verbose':
				++options.verbosity!;
				break;
			case '-h': // this must have been in a combined argument, eg -vh, so not be caught already
				displayHelp();
				return null;
			case '-n':
			case '--noop':
			case '--no-action':
			case '--dryrun':
				options.dryrun      = true;
				break;
			case '--overwrite' : options.overwrite = true; break;
			case '--force'     : options.force     = true; break;

			// arguments with 2 parameters, both of which are required
			case '--model':
			case '--sourcedriver':
			case '--targetdriver':
				{
				let flag  = arg_list[i+0];
				let field = arg_list[i+1];
				let value = arg_list[i+2];

				if(field == null || field.startsWith('-')){
					throw new Error("Expected <field> to be specified for flag " +
													flag + ", got: " + field
												 );
				}
				if(value == null || value.startsWith('-')){
					throw new Error("Expected <value> to be specified for flag " +
													flag + ", got: " + field
												 );
				}

				switch(flag){
					case '--model':
						processFlagSetSubField(field, value, options.dot_models);
						break;
					case '--sourcedriver':
						processFlagSetSubField(field, value, options.sourcedriver);
						break;
					case '--targetdriver':
						processFlagSetSubField(field, value, options.targetdriver);
						break;
				}

				i += 2;

				break;
			}

			// arguments with 2 parameters, 1st of which is optional
			case '--modelfile':
			case '--modelcmd': {
				let flag  = arg_list[i+0];
				let field = arg_list[i+1];
				let value = arg_list[i+2];

				if(field == null || field.startsWith('-')){
					throw new Error("Expected <field> to be specified for flag " +
													flag + ", got: " + field);
				}

				if(value == null || value.startsWith('-')){
					value = field;
					field = '';
					i += 1; // skip the single value argument
				} else {
					i += 2; // skip the <field> <value> arguments
				}

				switch(flag){
					case '--modelfile':
						processFlagModelFile(field, value, options);
						break;
					case '--modelcmd':
						processFlagModelCmd(field, value, options);
						break;
				}

				break;
			}

			default:
				throw new Error("Unexpected argument: " + arg_list[i]);
		}
	}

	return options;
}

/**
 * Loads a doT.js model file (yaml or json)
 *
 * @param model_path - Path to the field in the dot_model to modify, eg
 * field.name
 * @param file_name - Path of file to load
 * @param options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function processFlagModelFile(model_path : string,
															file_name  : string,
															options    : TreeployOptions
														 ) : void {
	let extension = file_name.split('.').pop();

	if(extension === undefined ||
		 ['yaml', 'yml', 'json'].indexOf(<string>extension) < 0){
		throw new Error(
			"Model file must have one of following extensions: .json. .yaml, .yml"
		);
	}

	if(!fs.existsSync(file_name) || !fs.statSync(file_name).isFile()){
		throw new Error(
			"Specified model file does not exist or is not a file, path: " + file_name
		);
	}

	let content = fs.readFileSync(file_name).toString();

	let loaded_data = null;
	try {
		switch(extension){
			case 'yaml' : loaded_data = yaml.safeLoad(content); break;
			case 'yml'  : loaded_data = yaml.safeLoad(content); break;
			case 'json' : loaded_data = JSON.parse(content); break;
		}
	} catch (e) {
		throw new Error("Failed to parse modelfile '" + file_name + "': " + e.message);
	}

	setObjectSubField(model_path, loaded_data, options.dot_models);
}

/**
 * Sets a doT.js model value given the command line flag's arguments
 *
 * @param {string} field_name  - The name of the field to modify
 * @param {string} field_value - The new value for field
 * @param {object} root_object - The object containing (or about to contain)
 * the field you wish to set
 */
function processFlagSetSubField(field_name  : string,
																field_value : any,
																root_object : any
															 ) : void {
	if(field_value.match(/^[0-9]+$/)){
		field_value = parseInt(field_value);
	} else if(field_value.match(/^(\+|-)?[0-9]*\.[0-9]+$/)){
		field_value = parseFloat(field_value);
	} else if(field_value === 'true'){
		field_value = true;
	} else if (field_value === 'false'){
		field_value = false;
	} else if((field_value.startsWith("'") && field_value.endsWith("'")) ||
		 (field_value.startsWith('"') && field_value.endsWith('"'))
	){
		// Then a string has been quoted on the command line (this might
		// be so we don't interpret a string that looks like an int as an
		// int, but leave it as a string)
		// Remove the quotes
		field_value = field_value.substr(1, field_value.length-2);
	}

	setObjectSubField(field_name, field_value, root_object);
}

/**
 * Executes a command, parses its output as JSON and updates the dot_model
 * accordingly
 *
 * @param field_name  - The name of the field to modify
 * @param field_value - The command to run whose output will be parsed as JSON
 * @param options - Current state of parsed options, this will be
 * modified to reflect new options with additional model field
 */
function processFlagModelCmd(field   : string,
														 cmd     : string,
														 options : TreeployOptions
														) : void {
	let cmd_result = execSync(cmd);
	let cmd_stdout = cmd_result.toString('utf8');
	try {
		let data = JSON.parse(cmd_stdout);
		setObjectSubField(field, data, options.dot_models);
	} catch (e) {
		throw new Error("modelcmd output invalid JSON: " + e.message);
	}
}

/**
 * Sets some field in an object.
 *
 * This function will create any intermediate objects, eg
 * if setting web.host.domain it will create the host object within
 * web, and then set the domain field of that
 *
 * @param field_name - Name of field, may contain dots to indicate
 * fields within objects
 * @param field_value - The value to set the field to
 * @param  root_object - The object which contains the field to set
 */
function setObjectSubField(field_name  : string,
													 field_value : any,
													 root_object : any){
	if(field_name === ''){
		Object.assign(root_object, field_value);
		return;
	}

	let field_parts = field_name.split('.');
	let object_node = root_object;
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

export default treeploy_cli;
