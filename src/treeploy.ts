/**
 * Main file exporting the treeploy function
 */

import yaml       from 'js-yaml';
import dot_engine from 'dot';
import path       from 'path';
import fs         from 'fs';

import { FileDriver, PathType } from './file_drivers/FileDriver'
import FileDriverLocal          from './file_drivers/Local';
import log                      from './log.js';

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
	useParams     : /.*/, // these fields aren't documented...
	defineParams  : /.*/, // no idea what to set them to...
};

// regexes for matching different types of files
const file_name_regex = {
	tree_descriptor : /^tree.ya?ml(.dot)?$/,
	skipped         : /^#.*#$|^.#|.*~$/, // emacs backup files
	template        : /^.+\.dot$/,
};

export class TreeployOptions {
	/** Verbosity level to set for global [[Logger]] */
	verbosity  : number  = 0;

	/** The model to be passed to doT templates */
	dot_models : object  = { it : {}};

	/** Disables CLI nag if destination exists */
	overwrite  : boolean = false;

	/** Disabled CLI nag if not running as root */
	noroot     : boolean = false;
};

class TreeployContext {
	constructor(source_path : string,
							target_path : string,
							options     : TreeployOptions
						 ){
		if(options == null){
			options = new TreeployOptions;
		}

		log.setLevel(options.verbosity);
		this.overwrite = options.overwrite;

		// we need to guarentee that the dot_engine.varname order matches up
		// with the order of parameters we pass to templates, convert everything
		// to an array here and use that from now on
		let models = Object.keys(options.dot_models);
		this.dot_models = models.map((x : string) => (<any>options).dot_models[x] );
		dot_engine.templateSettings.varname = models.join(',');

		this.source = FileDriverLocal.create(source_path, false, {});
		this.target = FileDriverLocal.create(target_path,  true, {});
	}

	dot_models : Array<any>;
	overwrite  : boolean;
	source     : FileDriver;
	target     : FileDriver;
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
async function treeploy(source_path : string,
												target_path : string,
												options     : TreeployOptions){

	let cntx = new TreeployContext(source_path, target_path, options);

	let path_type = await cntx.source.getPathType(source_path);

	switch(path_type){
		case PathType.NoExist:
			throw new Error("The source path does not exist");
		case PathType.Other:
			throw new Error("The source path is neither a directory nor a file");
		case PathType.File:
			return treeployFile(cntx, source_path, target_path);
		case PathType.Directory:
			return treeployDirectory(cntx, source_path, target_path);
	}
}

async function treeployDirectory(cntx        : TreeployContext,
																 source_path : string,
																 target_path : string){

	log.trace('Processing source directory: ' + source_path);

	if(!source_path.endsWith('/')){ source_path += '/'; }
	if(!target_path.endsWith('/')){ target_path += '/'; }

	await cntx.target.mkdir(target_path, { recursive: true, overwrite: cntx.overwrite });
	await copyPathAttributes(cntx, source_path, target_path);

	let entries = await cntx.source.readdir(source_path);

	// we need delay tree yaml files to the end since they may manipulate the
	// permisions of normal files
	let tree_files : Array<String> = [];

	for(let entry of entries) {
		let path_type = await cntx.source.getPathType(source_path + entry);

		switch(path_type){
			case PathType.Directory:
				await treeployDirectory(cntx, source_path + entry, target_path + entry);
				break;
			case PathType.File:
				if(entry.match(file_name_regex.tree_descriptor)){
					tree_files.push(entry);
				} else {
					await treeployFile(cntx, source_path + entry, target_path + entry);
				}
				break;
			default:
				log.warn("Skipping: " + source_path + " - neither a directory nor a file");
				break;
		}
	}

	for(let x of tree_files){
		await treeployFile(cntx, source_path + x, target_path + x);
	}

	return true;
}

async function treeployFile(cntx        : TreeployContext,
														source_path : string,
														target_path : string){

	let file_name = path.basename(source_path);

	if(file_name.match(file_name_regex.skipped)){
		log.info("Skipping file which matches skip regex: " + source_path);
		return false;
	}

	if (file_name.match(file_name_regex.tree_descriptor)){
		return processTreeYaml(cntx, source_path, target_path);
	}

	if(file_name.match(file_name_regex.template)){
		return processDotFile(cntx, source_path, target_path)
	}

	// otherwise this is just a standard file...
	log.debug("Copying file " + source_path + " to " + target_path);

	return copyFile(cntx, source_path, target_path);
}

/**
 * Generates the content after processing a .dot template
 * Does not perform any file IO
 *
 * @param {string} template_name - The name of the the template (generally the
 * file it was loaded from), used for generating message on error only
 * @param {string} template      - contents of the template
 * @param {object[]} dot_vars    - Variables to be passed as model to template

 */
function processDotTemplate(template_name : string,
														template      : string|Buffer,
														dot_vars      : object[]){
	let template_function = dot_engine.template(template.toString());
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
 */
async function processDotFile(cntx        : TreeployContext,
															source_path : string,
															target_path : string
														 ){

	log.trace("Processing dot template: " + source_path);

	if(target_path.endsWith('.dot')){
		target_path = target_path.substring(0, target_path.length-4);
	}

	let template_content = await cntx.source.readFile(source_path);

	let output_content = processDotTemplate(
		source_path, template_content, cntx.dot_models
	);

	await cntx.target.writeFile(target_path, output_content);
	return copyPathAttributes(cntx, source_path, target_path);
}


/**
 * Processes a tree.yaml file in order to create a set of empty
 * files and directories in the root directory
 */
async function processTreeYaml(cntx            : TreeployContext,
															 input_file      : string,
															 output_root_dir : string
															){

	log.trace("Processing tree yaml: " + input_file);

	if(output_root_dir.endsWith(path.basename(input_file))){
		// if trying to copy to corresponding tree.yaml in output
		// tree copy instead to the directory containing the tree.yaml
		output_root_dir = path.dirname(output_root_dir) + "/";
	}

	let content = (await cntx.source.readFile(input_file));

	if(input_file.endsWith('.dot')){
		content = processDotTemplate(input_file, content, cntx.dot_models);
	}

	let tree = yaml.safeLoad(content.toString());


	await  cntx.target.mkdir(output_root_dir, { recursive: true,
																							overwrite: cntx.overwrite
																						}
													);
	return buildTreeFromDescription(tree, output_root_dir);

	async function buildTreeFromDescription(tree : string, output_root_dir : string){
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
			let name : string = '';
			let opts : any    = {};

			if(typeof entry == 'string'){
				name = entry;
				opts = {};
			} else {
				let keys = Object.keys(entry);

				if(keys.length !== 1){
					throw new Error(
						"Invalid tree.yaml file '" + input_file +
						"' - expected single name to map to options object, got: " +
						JSON.stringify(entry)
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

			let target_full_path = output_root_dir + name;

			let path_type = await cntx.target.getPathType(target_full_path);

			if(name.endsWith('/')){
				await cntx.target.mkdir(target_full_path, { recursive: true, overwrite: cntx.overwrite });
			} else {

				switch(path_type){
					case PathType.Directory:
					case PathType.Other:
						if(cntx.overwrite){
							log.info("Overwritting existing non-file with file: " + target_full_path);
							await cntx.target.remove   (target_full_path);
							await cntx.target.writeFile(target_full_path, '');
						} else {
							throw new Error("Conflicting non-file found at target: " + target_full_path);
						}
						break;
					case PathType.File:
						log.debug("Not overwriting existing file: " + target_full_path);
						break;
					case PathType.NoExist:
						await cntx.target.writeFile(target_full_path, '');
						break;
				}
			}

			await cntx.target.setAttributes(target_full_path, opts);

			if(opts.children != null){
				await buildTreeFromDescription(opts.children, target_full_path);
			}
		}
	}
}

/**
 * Takes the permissions, owner, etc of an input file and applies them
 * to an output file, without changing the file's contents
 *
 * @param in_path {string}  - Path to the file whose meta data you wish to copy
 * @param out_path {string} - Path to file to apply to meta data to
 */
async function copyPathAttributes(cntx        : TreeployContext,
																	source_path : string,
																	target_path : string){
	let attr = await cntx.source.getAttributes(source_path);
	return cntx.target.setAttributes(target_path, attr);
}

/**
 * Helper function which copies a file between a source and
 * target FileDriver pair
 */
async function copyFile(cntx        : TreeployContext,
												source_path : string,
												target_path : string){
	let content = await cntx.source.readFile(source_path);
	await cntx.target.writeFile(target_path, content);
	return copyPathAttributes(cntx, source_path, target_path);
}

export default treeploy;
