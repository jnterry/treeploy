/**
 * Main file exporting the treeploy function
 */

const fs         = require('fs');
const fse        = require('fs-extra');
const walk       = require('walk');
const mkdirp     = require('mkdirp').sync;
const yaml       = require('node-yaml');
const dot_engine = require('dot');
const Q          = require('q');
const path       = require('path');

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


// regexes for matching different types of files
const file_name_regex = {
	tree_descriptor : /^tree.ya?ml(.dot)?$/,
	skipped         : /^#.*#$|^.#|.*~$/, // emacs backup files
	template        : /^.+\.dot$/,
};

function getRelativePaths(input_path, entry_path, entry_name){
	if(!entry_path.startsWith(input_path)){
		console.error("Unexpected entry outside of input directory: "
								+ root_path + "/" + stat.name);
		process.exit(1);
	}

	// relative paths -> relative to both input_path and output_path
	let rel = {
		dir  : entry_path.substring(input_path.length+1),
		file : entry_name,
		path : null,
	};

	if(rel.dir.length != 0){
		rel.path = rel.dir + '/' + rel.file;
	} else {
		rel.path = rel.file;
	}

	return rel;
}

/**
 * Performs treeploy process
 * @param {string} source_path - Path to the input tree
 * @param {string} target_path - Path to the output tree
 * @param {Object} options     - Additional options for treeploy
 *
 * @return Promise which resolves to true once all operations have completed,
 * else a promise which is rejected
 */
function treeploy(source_path, target_path, options){
	return Q(fse
		.pathExists(source_path)
		.catch((err) => {
			throw new Error("Source path '" + source_path + "' does not exist!");
		})
		.then(() => fse.stat(source_path))
		.then((input_stat) => {
			if(input_stat.isDirectory()){
				return treeployDirectory(source_path, target_path, options);
			} else if (input_stat.isFile()){
				let dirname  = path.basename(source_path);
				let basename = path.basename(source_path);
				if(dirname === source_path){
					// then source_path is a plain filename in cwd
					dirname = "./";
				}
				return treeployFile(dirname, target_path, basename, options);
			} else {
				throw new Error("Source path is neither a directory nor a file");
			}
		})
	);
}

function treeployDirectory(source_path, target_path, options){

	if(!source_path.endsWith('/')){ source_path += '/'; }
	if(!target_path.endsWith('/')){ target_path += '/'; }

	return fse
		.ensureDir(target_path)
		.then(() => file_utils.syncFileMetaData(source_path, target_path))
		.then(() => fse.readdir(source_path))
		.then((entries) => {

			// we need delay tree yaml files to the end since they may manipulate the
			// permisions of normal files
			let tree_files = [];

			let promises  = [];

			for(let entry of entries) {
				promises.push(fse
					.stat(source_path + entry)
					.then((stat) => {
						if(stat.isDirectory()){
							return treeployDirectory(source_path + entry, target_path + entry, options);
						} else if(stat.isFile()){

							if(entry.match(file_name_regex.tree_descriptor)){
								tree_files.push(entry);
							} else {
								return treeployFile(source_path, target_path, entry, options);
							}

						} else {
							console.log("Skipping: " + source_path + " - neither a directory nor a file");
						}
					})
				);
			}

			return Q
				.all(promises)
				.then(() => Q.all(
					tree_files.map((x) => treeployFile(source_path, target_path, x, options))
				));
		});
}

function treeployFile(source_dir, target_dir, file_name, options){
	let source_path = source_dir + file_name;

	let dot_models = undefined;
	if(options != null){ dot_models = options.dot_models; }

	if(file_name.match(file_name_regex.skipped)){
		console.log("Skipping file: " + source_path);
		return Q(false);
	}

	if (file_name.match(file_name_regex.tree_descriptor)){
		// :TODO: make processTreeYaml return a promise :ISSUE6:
		return Q().then(() => {
			console.log("Processing tree yaml: " + source_path);
			processTreeYaml(source_path, target_dir, dot_models);
		});
	}

	if(file_name.match(file_name_regex.template)){
		return Q().then(() => {
			// :TODO: make processDotFile return a promise :ISSUE6:
			console.log("Processing dot template: " + source_path);
			processDotFile(source_dir, target_dir, file_name, dot_models)
		});
	}

	// otherwise this is just a standard file...
	let target_path = target_dir + file_name;
	console.log("Copying file " + source_path + " to " + target_path);
	return fse
		.copy(source_path, target_path)
		.then(() => {
			return file_utils.syncFileMetaData(source_path, target_path);
		});
}

/**
 * Generates the content after processing a .dot template
 * Does not perform any file IO
 *
 * @param {string} template_name - The name of the the template (generally the
 * file it was loaded from), used for generating message on error only
 * @param {string} template      - contents of the template
 * @param {object} dot_vars      - Variables to be passed as model to template

 */
function processDotTemplate(template_name, template, dot_vars){
	let template_function = dot_engine.template(template);
	let output_content    = null;

	try {
		return output_content = template_function(dot_vars.it);
	} catch (e) {
		console.error("Failed to process dot template: '" + template_name + "', error follows:");
		console.dir(e);
		process.exit(1);
	}
}

/**
 * Process a dot file template and writes the output to the output directory
 *
 * @param {string}  input_path  - Path of the root input  directory
 * @param {string}  output_path - Path of the root output directory
 * @param {RelPath} rel         - Object with relative paths of dot file to process
 * @param {object}  dot_vars    - Variables to be passed as model to template
 */
function processDotFile(input_path, output_path, file_name, dot_vars){
	let template_content  = fs.readFileSync(input_path + file_name);

	let output_content = processDotTemplate(
		input_path + file_name, template_content, dot_vars
	);

	// remove dot extension
	let output_filename = output_path + file_name;
	output_filename = output_filename.substring(0, output_filename.length-4);

	fs.writeFileSync(output_filename, output_content);
	file_utils.syncFileMetaData(input_path + file_name, output_filename);
}


/**
 * Processes a tree.yaml file in order to create a set of empty
 * files and directories in the root directory
 */
function processTreeYaml(input_file, output_root_dir, dot_vars){
	let content = fs.readFileSync(input_file).toString('utf8');

	if(input_file.endsWith('.dot')){
		content = processDotTemplate(input_file, content, dot_vars);
	}

	let tree = yaml.parse(content);

	buildTreeFromDescription(tree, output_root_dir);

	function buildTreeFromDescription(tree, output_root_dir){
		if(!output_root_dir.endsWith('/')){
			output_root_dir += '/';
		}

		if(!Array.isArray(tree)){
			console.error("Expected an array of directory contents for '" +
										output_root_dir + "' in: '" + input_file + "', got: ");
			console.dir(tree);
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
					console.log("Overwritting existing non-directory with directory: " + full_path);
					fs.unlinkSync(full_path);
				}
				mkdirp(full_path);
			} else {
				if(stats == null){
					fs.writeFileSync(full_path, '');
				} else {
					if(!stats.isFile()){
						console.log("Overwritting existing non-file with file: " + full_path);
						fs.unlinkSync(full_path);
						fs.wrteFileSync(full_path, '');
					} else {
						console.log("Not overriting existing file: " + full_path);
					}
				}
			}

			file_utils.applyFilePermissions(full_path, opts);

			if(opts.children != null){
				buildTreeFromDescription(opts.children, full_path);
			}
		}
	}
}

module.exports = treeploy;
