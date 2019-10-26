/**
 * File containing the logic of the treeployment process
 *
 * See Context.ts for setup of the state required for this logic
 */

import yaml       from 'js-yaml';
import path       from 'path';
import fs         from 'fs';
import dot_engine from 'dot';

import { FileDriver, PathType } from './file_drivers/FileDriver'
import log                      from './log';

dot_engine.templateSettings = {
  evaluate      : /(?<!\\)\{\{([\s\S]+?)\}\}/g,
  interpolate   : /(?<!\\)\{\{=([\s\S]+?)\}\}/g,
  encode        : /(?<!\\)\{\{!([\s\S]+?)\}\}/g,
  use           : /(?<!\\)\{\{#([\s\S]+?)\}\}/g,
  define        : /(?<!\\)\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
  conditional   : /(?<!\\)\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
  iterate       : /(?<!\\)\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
  varname       : 'it', // ignore this, dynamically set in createTreeployContext
  strip         : false,
  append        : true,
  selfcontained : false,
	useParams     : /.*/, // these fields aren't documented...
	defineParams  : /.*/, // no idea what to set them to...
};


import FileDriverSsh2  from './file_drivers/Ssh2';
import FileDriverLocal from './file_drivers/Local';
// List of file drivers to try and automatically select from, they are
// tried in order from top to bottom
let driver_factories = [
	FileDriverSsh2,
	FileDriverLocal,
];

/**
 * Type representing the possible arguments used to create a
 * [[TreeployContext]] - it is these that should be specified when
 * calling treeploy's public API, and hence which must be specified on the CLI
 */
export class TreeployOptions {
	/** Verbosity level to set for global [[Logger]] */
	verbosity?  : number  = 0;

	/** The model to be passed to doT templates */
	dot_models? : object  = { it : {}};

	/**
	 * If set then treeploy is permitted to overwrite existing files
	 * with new content
	 */
	overwrite?  : boolean = false;

	/**
	 * Overwrite on steroids - if set then treeploy is permitted to take any
	 * measures necessary to get the target's state to be as it should, in
	 * essence this means removing files in order to write directories with the
	 * same name, or vice-versa
	 */
	force?      : boolean = false;

	/** If set then no file system modifications will be made */
	dryrun?     : boolean = false;

	/** Additional options to be passed to the source driver */
	sourcedriver : {
		[index:string] : any,
	} = {};

	/** Additional options to be passed to the target driver */
	targetdriver : {
		[index:string] : any,
	} = {};
};

/**
 * Type representing all options and state required to carry out the
 * treeployment process
 */
interface TreeployContext {
	dot_models : Array<any>;
	source     : FileDriver;
	target     : FileDriver;
};

async function createTreeployContext(source_path : string,
																		 target_path : string,
																		 options     : TreeployOptions | null
																		) : Promise<TreeployContext> {

	if(options == null){
		options = new TreeployOptions();
	}

	let result = {} as any;

	log.setLevel(options.verbosity || 0);

	if(options.dot_models == null) {
		result.dot_models = [require];
		dot_engine.templateSettings.varname = 'require';
	} else {
		// we need to guarentee that the dot_engine.varname order matches up
		// with the order of parameters we pass to templates, convert everything
		// to an array here and use that from now on
		//
		// We also add on the "require" param at the end of the array so we can pass
		// through a reference to the require function so that templates can include
		// and run arbitrary js code
		let models = Object.keys(options.dot_models);
		result.dot_models = models.map((x : string) => (<any>options).dot_models[x] );
		result.dot_models.push(require);
		dot_engine.templateSettings.varname = models.join(',') + ', require';
	}

	for (let df of driver_factories) {
		if(df.path_regex.test(source_path)){
			log.info("Using " + df.name + " driver for source path: " + source_path);
			result.source = await df.create({
				path: source_path,
				writes_enabled: false,
				driver : options.sourcedriver,
			});
			break;
		}
	}
	if(result.source == null){
		throw new Error("Failed to find appropriate driver for source path: " + source_path);
	}

	for(let df of driver_factories) {
		if(df.path_regex.test(target_path)){
			log.info("Using " + df.name + " driver for target path: " + target_path);
			result.target = await df.create({
				path            : target_path,
				writes_enabled  : !options.dryrun,
				overwrite       : options.overwrite || options.force || false,
				force           : options.force     || false,
				driver          : options.targetdriver,
			});
			break;
		}
	}
	if(result.target == null){
		throw new Error("Failed to find appropriate driver for target path: " + target_path);
	}

	return result as TreeployContext;
}

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
async function treeploy(source_path : string,
												target_path : string,
												options     : TreeployOptions) : Promise<void>{

	let cntx = await createTreeployContext(source_path, target_path, options);

	// update paths to the root path handled by the file driver, hence ensuring
	// that the file driver can cope with anything we pass it relative to the
	// source or target path
	// (eg, source path might be user@host:/path, but the ssh2 driver wants paths
	// of the format /path/test.txt, so it rewrites the source path to be /path
	// rather than the full user@host:/path)
	source_path = cntx.source.getRootPath();
	target_path = cntx.target.getRootPath();

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
																 target_path : string) : Promise<void>{

	log.trace('Processing source directory: ' + source_path);

	if(!source_path.endsWith('/')){ source_path += '/'; }
	if(!target_path.endsWith('/')){ target_path += '/'; }

	await cntx.target.mkdir(target_path);
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

	return;
}

async function treeployFile(cntx        : TreeployContext,
														source_path : string,
														target_path : string) : Promise<void>{

	let file_name = path.basename(source_path);

	if(file_name.match(file_name_regex.skipped)){
		log.info("Skipping file which matches skip regex: " + source_path);
		return;
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

	try {
		let out = template_function.apply(null, dot_vars);
		out = out.replace(/\\\{\{/g, '{{');
		out = out.replace(/\\\}\}/g, '}}');
		return out;
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

	let content = (await cntx.source.readFile(input_file)).toString();

	if(input_file.endsWith('.dot')){
		content = processDotTemplate(input_file, content, cntx.dot_models);
	}

	let tree = yaml.safeLoad(content.toString());


	await  cntx.target.mkdir(output_root_dir);
	return buildTreeFromDescription(tree, output_root_dir, {});

	async function buildTreeFromDescription(tree : string,
																					output_root_dir : string,
																					default_opts: any){
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

				// inherit parent attributes (except for "children" field)
				opts = { ...default_opts };
				delete opts.children;
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

				// Inherit value from default_opts when not set
				for(let k of Object.keys(default_opts)){
					if(k === 'children') { continue; }
					if(opts[k] === undefined){ opts[k] = default_opts[k]; }
				}
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
				await cntx.target.mkdir(target_full_path);
			} else {
				if(path_type === PathType.File){
					log.debug('File already exists at: ' + target_full_path);
				} else {
					await cntx.target.writeFile(target_full_path, '');
				}
			}

			await cntx.target.setAttributes(target_full_path, opts);

			if(opts.children != null){
				await buildTreeFromDescription(opts.children, target_full_path, opts);
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
