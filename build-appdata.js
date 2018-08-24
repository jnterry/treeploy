#!/usr/bin/env node
//
// This script can be used to build the appdata directory for a stack
//
// In the majority of cases this is simply a copy-paste job from the
// stack's appdata directory to the output location, however there are
// some additional functions
//
// Firstly, any files named "directories.yaml" in the input will be parsed, and
// a corresponding tree of directories will be created. This is to get around
// the fact that empty directories cannot be added to git
//
// Secondly, any files with a .dot extension will be processed by the dot
// template engine in order to generate an output file. Note that the .dot
// extension will be removed, hence the file "nginx.conf.dot" will produce
// an output file "nginx.conf"

"use strict"

const fs       = require('fs');
const stdin    = require('readline-sync')
const walk     = require('walk');
const execFile = require('child_process').execFile;
const mkdirp   = require('mkdirp');

console.log(process.argv[0]);
console.log(process.argv[1]);
console.log(process.argv[2]);

// [0] is node executable, [1] is this script
let input_path  = process.argv[2];
let output_path = process.argv[3];

if(input_path == null || output_path == null){
	console.log("Usage: build_appdata.js INPUT_PATH OUTPUT_PATH");
	process.exit(1);
}

if(!input_path.endsWith ('/')) { input_path  += '/'; }
if(!output_path.endsWith('/')) { output_path += '/'; }

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
}

console.log("Processing directory...");

let walker = walk.walk(input_path, {});
walker.on("file", function(root_path, stat, next) {
	if(!root_path.startsWith(input_path)){
		console.error("Unexpected input file outside of input directory: "
									+ root_path + "/" + stat.name);
		process.exit(1);
	}

	// relative paths -> relative to both input_path and output_path
	let rel_dir  = root_path.substring(input_path.length+1);
	let rel_file = stat.name;
	let rel_path = rel_dir + '/' + rel_file;

	if(rel_file.match(/^#.*#$|^.#|.*~$/)){
		console.log("Skipping emacs backup file: " + rel_path);
		next();
		return;
	}

	// Create the directory in the output
	if(fs.existsSync(output_path + rel_dir)){
		if(!fs.statSync(output_path + rel_dir).isDirectory()){
			console.log("Removing existing file: " + output_path + rel_dir);
			fs.unlinkSync(output_path);
		}
	}
	if(!fs.existsSync(output_path + rel_dir)){
		console.log("Creating directory: " + output_path + rel_dir);
		mkdirp.sync(output_path + rel_dir);
	}

	// Check if file is special case
	if(rel_file.match(/.dot$/)){
		// then its a dot template, process it before outputing
		console.log("Processing dot template: " + rel_path);
	} else if (rel_file.match(/^directories.ya?ml$/)){
		// then create directories accoridng to the yaml
		console.log("Creating directories in: " + rel_path);
	} else {
		console.log("Copying file to " + output_path + rel_path);
		execFile('/bin/cp', ['--no-target-directory',
												 input_path + rel_path,
												 output_path + rel_path
												]
						);
	}

	next();
});
