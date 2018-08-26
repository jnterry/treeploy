#!/usr/bin/env node
/**
 * This script can be used to build the appdata directory for a stack
 *
 * In the majority of cases this is simply a copy-paste job from the
 * stack's appdata directory to the output location, however there are
 * some additional functions:
 *
 * -------------------------------------------------------------------
 *
 * Any files named "tree.yaml" in the input tree will be parsed, and
 * a corresponding tree of directories and empty files will be created.
 * - Existing files will not be overwritten.
 * - Existing files/directories may have their permissions updated
 *
 * This solves a number of issues:
 * - Empty directories cannot be added to git
 * - Git will not preserve file/directory ownership (tree.yaml may be used
 *   to apply permissions to files/directories that actually exist in git)
 * - Application may require files to exist (eg, in appdata/persistent
 *   or appdata/logs) but we do not want to copy a blank file over the
 *   top of one that the application has modified
 *
 * Format of tree.yaml:
 * - dir_a/:
 *     mode: '0600'
 *     owner: root
 *     group: root
 * - dir_b/
 * - dir_c:
 *     owner: 1000
 *     group: 1000
 *     children:
 *       - file_1
 *       - file_2
 *       - dir/
 * - file_a
 * - file_b:
 *     mode: '0777'
 *
 * Any entry with a trailing slash or a "children" member will be created
 * as a directory, all others will be created as files
 *
 * Note that the tree.yaml files will always be applied after any dot templates
 * have been processed or files have been copied, hence it is possible to
 * use them to apply permissions to files which exist in the git repo
 *
 *
 * * -------------------------------------------------------------------
 *
 * Any files with a .dot extension will be processed by the dot
 * template engine in order to generate an output file. Note that the .dot
 * extension will be removed, hence the file "nginx.conf.dot" will produce
 * an output file "nginx.conf"
 * The dot template engine will be passed variables produced from the
 * third argument to this program, or the "dot_vars_file"
 * This may have the following formats:
 * .yaml (loaded with node-yaml library)
 * .yml  (loaded with node-yaml library)
 * .json (loaded as json)
 * .js   (loaded with require -> file should module.exports the variables)
 */

"use strict"

const fs         = require('fs');
const stdin      = require('readline-sync')
const mkdirp     = require('mkdirp');
const yaml       = require('node-yaml');

const file_utils = require('./file_utils.js');
const treeploy   = require('./index.js');

/////////////////////////////////////////////////////////
// Get and santize inputs
// [0] is node executable, [1] is this script
let input_path    = process.argv[2];
let output_path   = process.argv[3];
let dot_vars_file = process.argv[4];

if(input_path == null || output_path == null){
	console.log("Usage: build_appdata.js INPUT_PATH OUTPUT_PATH [DOT_VARS_FILE]");
	process.exit(1);
}

if(!input_path.endsWith ('/')) { input_path  += '/'; }
if(!output_path.endsWith('/')) { output_path += '/'; }
/////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////
// Check if we are root
if(process.getuid() != 0){
	console.log('Not running as root, may not be able set file permissions, owners, etc');
	let response = stdin.question('Continue? [y/N]');
	if(!response.match('[Yy]|[Yy][Ee][Ss]')){
		process.exit(0);
	}
}
/////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////
// Check input path exists and is a directory
if(!fs.existsSync(input_path)){
	console.error("Input path does not exist");
	process.exit(1);
} else {
	let in_stat = fs.statSync(input_path);

	if(!in_stat.isDirectory()){
		console.error("Input path is not a directory");
		process.exit(1);
	}
}
/////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////
// Check output does not exist, or if it does prompt user
// if they want to continue
if(fs.existsSync(output_path)){
	let out_stat = fs.statSync(output_path);

	if(out_stat.isFile()){
		console.log("The output path: '" + output_path +
								 "' is a file and must be deleted to continue");

		let response = stdin.question("Continue? [y/N] ");
		if(response.match('[Yy]|[Yy][Ee][Ss]')){
			fs.unlinkSync(output_path);
		} else {
			process.exit(0);
		}
	} else if (out_stat.isDirectory()){
		let contents = fs.readdirSync(output_path);
		if(contents.length != 0){
			console.log("Output path is a non empty directory!");
			console.log(" - Files in source and destination will be overwritten");
			console.log(" - Files in destination but not in source will be untouched");
			console.log(" - Files in source but not in destination will be created\n");
			let response = stdin.question("Continue? [y/N] ");
			if(!response.match('[Yy]|[Yy][Ee][Ss]')){
				process.exit(0);
			}
		}
	} else {
		console.log("Output path exists, but is not a file or directory");
		console.log("Don't know what to do, quiting...");
		process.exit(1);
	}
} else {
	console.log("Creating output directory: " + output_path);
	mkdirp.sync(output_path);
	file_utils.syncFileMetaData(input_path, output_path);
}
/////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////
// Load dot_vars_file
let dot_vars = null;
if(dot_vars_file != null){
	if(!fs.existsSync(dot_vars_file)){
		console.error("Specified dot vars file does not exist");
		process.exit(1);
	}
	if(dot_vars_file.endsWith('.yaml') || dot_vars_file.endsWith('.yaml')){
		dot_vars = yaml.readSync(dot_vars_file);
	} else if (dot_vars_file.endsWith('.json')){
		dot_vars = JSON.parse(fs.readFileSync(dot_vars_file, 'utf8'));
	} else if (dot_vars_file.endsWith('.js')){
		dot_vars = require(dot_vars_file);
	} else {
		console.error("Specified dot vars file has unrecognised format!");
		process.exit(1);
	}
}
/////////////////////////////////////////////////////////


treeploy(
	input_path,
	output_path,
	{
		dot_models: {
			it: dot_vars,
		}
	}
);
