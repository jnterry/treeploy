/**
 * Main file exporting the treeploy function
 */

const fs         = require('fs');
const walk       = require('walk');
const mkdirp     = require('mkdirp').sync;
const yaml       = require('node-yaml');
const dot_engine = require('dot');
const Q          = require('q');

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
 * @param {string} input_path  - Path to the input tree
 * @param {string} output_path - Path to the output tree
 * @param {Object} options     - Additional options for treeploy
 *
 * @return Promise which resolves to true once all operations have completed,
 * else a promise which is rejected
 */
function treeploy(input_path, output_path, options){
	let deferred = Q.defer();

	if(!input_path.endsWith ('/')) { input_path  += '/'; }
	if(!output_path.endsWith('/')) { output_path += '/'; }

	if(!fs.existsSync(output_path)){
		mkdirp(output_path);
	}

	console.log("Processing directory...");

	let walker = walk.walk(input_path, {});

	let tree_yamls = [];

	walker.on("directory", function(root_path, stat, next){
		let rel = getRelativePaths(input_path, root_path, stat.name);
		console.log("Making directory: " + rel.path);
		fs.mkdirSync(output_path + rel.path);
		file_utils.syncFileMetaData(input_path + rel.path, output_path + rel.path);
		next();
	});

	walker.on("file", function(root_path, stat, next) {
		let rel = getRelativePaths(input_path, root_path, stat.name);

		if(rel.file.match(/^#.*#$|^.#|.*~$/)){
			console.log("Skipping emacs backup file: " + rel.path);
			next();
			return;
		}

		// Create the directory in the output
		if(fs.existsSync(output_path + rel.dir)){
			if(!fs.statSync(output_path + rel.dir).isDirectory()){
				console.log("Removing existing file: " + output_path + rel.dir);
				fs.unlinkSync(output_path);
			}
		}
		if(!fs.existsSync(output_path + rel.dir)){
			console.log("Creating directory: " + output_path + rel.dir);
			mkdirp(output_path + rel.dir);
		}

		// Check if file is special case
		if(rel.file.match(/.dot$/)){
			// then its a dot template, process it before outputing
			console.log("Processing dot template: " + rel.path);
			processDotFile(input_path, output_path, rel.path, options.dot_models.it)
		} else if (rel.file.match(/^tree.ya?ml$/)){
			// then defer execution of the tree.yaml until the end
			tree_yamls.push({ input_path, output_path, rel });
		} else {
			console.log("Copying file to " + output_path + rel.path);
			fs.copyFileSync(input_path + rel.path, output_path + rel.path);
			file_utils.syncFileMetaData(input_path + rel.path, output_path + rel.path);
		}

		next();
	});

	walker.on('end', function(){
		for(let job of tree_yamls){
			console.log("Creating tree described by: " + job.rel.path);
			processTreeYaml(job.input_path + job.rel.path, job.output_path + job.rel.dir);
		}
		deferred.resolve(true);
	});

	return deferred.promise;
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
	// yaml.readSync() will do this in one call, but that's not compatible
	// with the mock file system used for unit tests
	let tree = yaml.parse(fs.readFileSync(input_file).toString('utf8'));

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
