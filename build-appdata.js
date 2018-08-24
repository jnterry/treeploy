#!/usr/bin/env node
/**
 * This script can be used to build the appdata directory for a stack
 *
 * In the majority of cases this is simply a copy-paste job from the
 * stack's appdata directory to the output location, however there are
 * some additional functions
 *
 * Firstly, any files named "directories.yaml" in the input will be parsed, and
 * a corresponding tree of directories will be created. This is to get around
 * the fact that empty directories cannot be added to git
 * Note that the permissions of the directories.yaml file will be applied to
 * the created directories, hence directories.yaml should be executable in
 * order for the directories to be listable (since the executable flag
 * on a directory means that you can list the contents)
 *
 * Secondly, any files with a .dot extension will be processed by the dot
 * template engine in order to generate an output file. Note that the .dot
 * extension will be removed, hence the file "nginx.conf.dot" will produce
 * an output file "nginx.conf"
 *
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
const walk       = require('walk');
const execSync   = require('child_process').execSync;
const execFile   = require('child_process').execFile;
const mkdirp     = require('mkdirp');
const yaml       = require('node-yaml');
const dot_engine = require('dot');

dot_engine.templateSettings = {
  evaluate      : /\{\{([\s\S]+?)\}\}/g,
  interpolate   : /\{\{=([\s\S]+?)\}\}/g,
  encode        : /\{\{!([\s\S]+?)\}\}/g,
  use           : /\{\{#([\s\S]+?)\}\}/g,
  define        : /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
  conditional   : /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
  iterate       : /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
  varname       : 'it',
  strip         : false,
  append        : true,
  selfcontained : false,
};

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
	console.log('Not running as root, may not be able to preserve file permissions, owners, etc');
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
	syncFileMetaData(input_path, output_path);
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
	let rel_path = null;
	if(rel_dir.length != 0){
		rel_path = rel_dir + '/' + rel_file;
	} else {
		rel_path = rel_file;
	}

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
		processDotFile(input_path, output_path, rel_path, dot_vars)
	} else if (rel_file.match(/^directories.ya?ml$/)){
		// then create directories accoridng to the yaml
		console.log("Creating directories in: " + rel_path);
		processDirectoriesYaml(input_path + rel_path, output_path + rel_dir);
	} else {
		console.log("Copying file to " + output_path + rel_path);
		execFile('/bin/cp', ['--no-target-directory',
												 '--preserve', // keep owner, permissions, filestamp, etc
												 input_path + rel_path,
												 output_path + rel_path
												]
						);
	}

	next();
});

/**
 * Takes the permissions, owner, etc of an input file and applies them
 * to an output file, without changing the file's contents
 *
 * @param in_path {string}  - Path to the file whose meta data you wish to copy
 * @param out_path {string} - Path to file to apply to meta data to
 */
function syncFileMetaData(in_path, out_path){
	execSync("chown $(stat -c '%u:%g' " + in_path + ") " + out_path);
	execSync("chmod $(stat -c '%a' "    + in_path + ") " + out_path);
	execSync("touch -r " + in_path + " " + out_path); // copy timestamps
}

/**
 * Process a dot file template and writes the output to the output directory
 *
 * @param {string} input_path  - Path of the root input  directory
 * @param {string} output_path - Path of the root output directory
 * @param {string} rel_path    - Path of template file relative to input_path
 * @param {object} dot_vars    - Variables to be passed as model to template
 */
function processDotFile(input_path, output_path, rel_path, dot_vars){
	let template_content  = fs.readFileSync(input_path + rel_path);
	let template_function = dot_engine.template(template_content);
	let output_content    = null;

	try {
		output_content = template_function(dot_vars);
	} catch (e) {
		console.error("Failed to process dot template: '" + rel_path + "', error follows:");
		console.dir(e);
		process.exit(1);
	}

	// remove .dot extension
	let output_filename = output_path + rel_path;
	output_filename = output_filename.substring(0, output_filename.length-4);

	fs.writeFileSync(output_filename, output_content);
	syncFileMetaData(input_path + rel_path, output_filename);
}

/**
 * Processes a directories.yaml file in order to create a potentially nested
 * set of directories
 *
 * @oaram {string} input_file - Path of the yaml file, relative to the
 * processes current working directory, or an absolute path
 * @param {string} output_root_dir - Path of the root directory that the
 * created directories will be placed in
 */
function processDirectoriesYaml(input_file, output_root_dir){

	function doCreateDirs(dirs, output_root_dir){
		if(!output_root_dir.endsWith('/')){
			output_root_dir += '/';
		}

		if(typeof dirs == 'string' || typeof dirs == 'number'){
			mkdirp(output_root_dir + dirs);
			syncFileMetaData(input_file, output_root_dir + dirs);
		} else if(Array.isArray(dirs)){
			for(let entry of dirs){
				doCreateDirs(entry, output_root_dir);
			}
		} else {
			for(let entry in dirs){
				doCreateDirs(entry, output_root_dir);
				doCreateDirs(dirs[entry], output_root_dir + entry);
			}
		}
	}

	let dirs = yaml.readSync(input_file);
	doCreateDirs(dirs, output_root_dir);
}
