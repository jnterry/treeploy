/**
 * Main file exporting the treeploy function
 */

const fs         = require('fs');
const walk       = require('walk');
const execFile   = require('child_process').execFile;
const mkdirp     = require('mkdirp');
const yaml       = require('node-yaml');
const dot_engine = require('dot');

const file_utils = require('./file_utils.js');

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

function treeploy(input_path, output_path, options){

	console.log("Processing directory...");

	let walker = walk.walk(input_path, {});

	let tree_yamls = [];

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
			processDotFile(input_path, output_path, rel_path, options.dot_models.it)
		} else if (rel_file.match(/^tree.ya?ml$/)){
			// then defer execution of the tree.yaml until the end
			tree_yamls.push({ input_path, output_path, rel_path, rel_dir });
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

	walker.on('end', function(){
		for(let job of tree_yamls){
			console.log("Creating tree described by: " + job.rel_path);
			processTreeYaml(job.input_path + job.rel_path, job.output_path + job.rel_dir);
		}
	});
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
	file_utils.syncFileMetaData(input_path + rel_path, output_filename);
}

/**
 * Processes a tree.yaml file in order to create a set of empty
 * files and directories in the root directory
 */
function processTreeYaml(input_file, output_root_dir){
	let tree = yaml.readSync(input_file);

	if(!output_root_dir.endsWith('/')){
		output_root_dir += '/';
	}

	buildTreeRecursive(tree, output_root_dir);

	function buildTreeRecursive(tree, output_root_dir){
		if(!Array.isArray(tree)){
			console.error("Expected an array of directory contents for '" +
										output_root_dir + "' in: '" + input_file + "', got: ");
			console.dir(files);
			process.exit(1);
		}

		for(let entry of tree){
			let name = null;
			let opts = null;

			if(typeof entry == 'string'){
				name = entry;
				opts = {};
			} else {
				let keys = Object.keys(entry);

				if(keys.length !== 1){
					console.error("Expected single entry name to map to entry options, got: ");
					console.dir(entry);
					process.exit(1);
				}

				name = keys[0];
				opts = entry[name];
			}

			while(name.startsWith('/')){
				name = name.substring(1);
			}

			if(opts.children != null && !name.endsWith('/')){
				name += '/';
			}

			let full_path = output_root_dir + name;

			let stats = null;
			if(fs.existsSync(full_path)){
				stats = fs.statSync(full_path);
			}

			if(name.endsWith('/')){
				if(stats != null && !stats.isDirectory()){
					console.log("Overitting existing non-directory with directory: " + full_path);
					fs.unlinkSync(full_path);
				}
				mkdirp(full_path);
			} else {
				if(stats == null){
					console.log("Overitting existing non-file with file: " + full_path);
					fs.writeFileSync(full_path, '');
				} else {
					if(!stats.isFile()){
						fs.unlinkSync(full_path);
						fs.wrteFileSync(full_path, '');
					} else {
						console.log("Not overriting existing file: " + full_path);
					}
				}
			}

			file_utils.applyFilePermissions(full_path, opts);

			if(opts.children != null){
				buildTreeRecursive(opts.children, full_path);
			}
		}
	}
}

module.exports = treeploy;
