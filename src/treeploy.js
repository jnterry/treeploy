#!/usr/bin/env node
/**
 * CLI wrapper around treeploy functionality
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
