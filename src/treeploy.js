/**
 * Main file exporting the treeploy function
 */

const fs         = require('fs');
const fse        = require('fs-extra');
const yaml       = require('node-yaml');
const dot_engine = require('dot');
const path       = require('path');

const makeLogger = require('./log.js')
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
	if(options            == null) { options            = {}; }
	if(options.verbosity  == null) { options.verbosity  =  0; }
	if(options.dot_models == null) { options.dot_models = {}; }

	if(typeof options.dot_models != 'object'){
		log.warn('Expected options.dot_models to be an object mapping doT.js varnames to values - dot_models will be ignored, template evaluation may fail');
		options.dot_models = [];
	} else {
		// we need to guarentee that the dot_engine.varname order matches up
		// with the order of parameters we pass to templates, convert everything
		// to an array here and use that from now on

		let models = Object.keys(options.dot_models);

		options.dot_models = models.map((x) => options.dot_models[x]);
		dot_engine.templateSettings.varname = models.join(',');
	}

	global.log = makeLogger(options.verbosity);

	return fse
		.pathExists(source_path)
		.catch((err) => {
			throw new Error("Source path '" + source_path + "' does not exist!");
		})
		.then(() => fse.stat(source_path))
		.then((input_stat) => {
			if(input_stat.isDirectory()){
				return treeployDirectory(source_path, target_path, options);
			} else if (input_stat.isFile()){
				return treeployFile(source_path, target_path, options);
			} else {
				throw new Error("Source path is neither a directory nor a file");
			}
		});
}

function treeployDirectory(source_path, target_path, options){

	log.trace('Processing source directory: ' + source_path);

	if(!source_path.endsWith('/')){ source_path += '/'; }
	if(!target_path.endsWith('/')){ target_path += '/'; }

	return fse
		.exists(target_path)
		.then((does_exist) => {
			if(!does_exist){ return; }

			return fse
				.stat(target_path)
				.then((stat) => {
					if(!stat.isDirectory()){
						if(options.overwrite){
							log.info("Removing conflicting non-directory in place of: " + target_path);
							return fse.remove(target_path);
						} else {
							throw new Error(
								"Path '" + target_path +
								"' exists as non-directory and options.overwrite is not set"
							);
						}
					}
				})
		})
		.then(() => fse.ensureDir(target_path))
		.then(() => file_utils.syncFileMetaData(source_path, target_path))
		.then(() => fse.readdir(source_path))
		.then(async (entries) => {
			// we need delay tree yaml files to the end since they may manipulate the
			// permisions of normal files
			let tree_files = [];

			for(let entry of entries) {
				await fse
					.stat(source_path + entry)
					.then((stat) => {
						if(stat.isDirectory()){
							return treeployDirectory(source_path + entry, target_path + entry, options);
						} else if(stat.isFile()){

							if(entry.match(file_name_regex.tree_descriptor)){
								tree_files.push(entry);
							} else {
								return treeployFile(source_path + entry, target_path + entry, options);
							}

						} else {
							log.warn("Skipping: " + source_path + " - neither a directory nor a file");
						}
					});
			}

			for(let x of tree_files){
				await treeployFile(source_path + x, target_path + x, options);
			}

			return true;
		});
}

async function treeployFile(source_path, target_path, options){

	let file_name = path.basename(source_path);

	let dot_models = undefined;
	if(options != null){ dot_models = options.dot_models; }

	if(file_name.match(file_name_regex.skipped)){
		log.info("Skipping file which matches skip regex: " + source_path);
		return false;
	}

	if (file_name.match(file_name_regex.tree_descriptor)){
		// :TODO: make processTreeYaml return a promise :ISSUE6:
		log.trace("Processing tree yaml: " + source_path);
		return processTreeYaml(source_path, target_path, dot_models);
	}

	if(file_name.match(file_name_regex.template)){
		// :TODO: make processDotFile return a promise :ISSUE6:
		log.trace("Processing dot template: " + source_path);
		return processDotFile(source_path, target_path, dot_models)
	}

	// otherwise this is just a standard file...
	log.debug("Copying file " + source_path + " to " + target_path);
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
		return output_content = template_function.apply(null, dot_vars);
	} catch (e) {
		throw new Error(
			"Failed to process dot template: '" +
			template_name + "': " + e.toString()
		);
	}
}

/**
 * Process a dot file template and writes the output to the output directory
 *
 * @param {string}  input_path  - Path of the dot file to process
 * @param {string}  output_path - Path to write the result to
 * @param {object}  dot_vars    - Variables to be passed as model to template
 */
function processDotFile(input_path, output_path, dot_vars){
	if(output_path.endsWith('.dot')){
		output_path = output_path.substring(0, output_path.length-4);
	}

	let template_content  = fs.readFileSync(input_path);

	let output_content = processDotTemplate(
		input_path, template_content, dot_vars
	);

	fs.writeFileSync(output_path, output_content);
	file_utils.syncFileMetaData(input_path, output_path);
}


/**
 * Processes a tree.yaml file in order to create a set of empty
 * files and directories in the root directory
 */
function processTreeYaml(input_file, output_root_dir, dot_vars){

	if(output_root_dir.endsWith(path.basename(input_file))){
		// if trying to copy to corresponding tree.yaml in output
		// tree copy instead to the directory containing the tree.yaml
		output_root_dir = path.dirname(output_root_dir) + "/";
	}

	fse.ensureDirSync(output_root_dir);

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
			throw new Error(
				"Invalid tree.yaml file '" + input_file +
				"' - expected an array of directory contents for '" +
				output_root_dir + "'"
			);
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
					throw new Error(
						"Invalid tree.yaml file '" + input_file +
						"' - expected single name to map to options object, got: " +
						JSON.toString(entry)
					);
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
					log.warn("Overwritting existing non-directory with directory: " + full_path);
					fs.unlinkSync(full_path);
				}
				fse.ensureDirSync(full_path);
			} else {
				if(stats == null){
					fs.writeFileSync(full_path, '');
				} else {
					if(!stats.isFile()){
						log.warn("Overwritting existing non-file with file: " + full_path);
						fs.unlinkSync(full_path);
						fs.wrteFileSync(full_path, '');
					} else {
						log.debug("Not overwriting existing file: " + full_path);
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
