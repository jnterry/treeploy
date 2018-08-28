/**
 * Exports a file driver which manipulates the local file system
 */

const fs            = require('fs');
const { promisify } = require('util');
const path          = require('path');

const log = require('./../log.js').log;

const file_utils    = require('../file_utils.js')

function FileDriverLocal(no_op_writes){
	this.no_op_writes = no_op_writes;
}

// Make some private wrappers that return promises

let writeFileAsync = promisify(fs.writeFile);
let chownAsync     = promisify(fs.chown);
let chmodAsync     = promisify(fs.chmod);
let unlinkAsync    = promisify(fs.unlink);
let rmdirAsync     = promisify(fs.rmdir);
let mkdirAsync     = promisify(fs.mkdir);

// File driver local can attempt to handle any path (for now)
FileDriverLocal.uri_regex = /.*/;

// FileDriverLocal can be used to modify the file system
FileDriverLocal.is_read_only = false;


//FileDriverLocal.prototype.readFile = promisify(fs.readFile);
// ^ ^ ^ This is the implementation we want
// Below is a temporary work around for:
// https://github.com/tschaub/mock-fs/issues/245
FileDriverLocal.prototype.readFile = function(path){

	return new Promise((resolve, reject) => {
		try {
			let content = fs.readFileSync(path);
			resolve(content)
		} catch (e) {
			reject(e);
		}
	});
}

FileDriverLocal.prototype.exists    = promisify(fs.exists);
FileDriverLocal.prototype.stat      = promisify(fs.stat);
FileDriverLocal.prototype.readdir   = promisify(fs.readdir);

FileDriverLocal.prototype.getAttributes = async function(path){
	let stat = await this.stat(path);

	return {
		owner : stat.uid,
		group : stat.gid,
		mode  : file_utils.getStatPermissionString(stat),
	};
}


FileDriverLocal.prototype.writeFile = function(file, content){
	if(this.no_op_writes){ return; }
	return writeFileAsync(file, content);
}

/**
 * Removes a file or directory at specified path
 */
FileDriverLocal.prototype.remove = async function(path){
	if(this.no_op_writes){ return; }

	let stat = await this.stat(path);
	if(stat.isDirectory()){
		return rmdirAsync(path);
	} else {
		return unlinkAsync(path);
	}
}

/**
 * Makes a directory, recursively creates any required parents and
 * also deletes any conflicts if a parent component of the path already
 * exists but as a file
 *
 * @param {string} dir_path - Path of the directory to create
 */
FileDriverLocal.prototype.mkdir = async function(dir_path){
	if(this.no_op_writes){ return; }

	if(await this.exists(dir_path)){
		let stat = await this.stat(dir_path);
		if(stat.isDirectory()){
			return true;
		}
		await this.remove(dir_path);
	}

	await this.mkdir(path.dirname(dir_path));

	return mkdirAsync(dir_path);
}

/**
 * Applies a mode, owner and group to an existing file path
 *
 * @param {string} path         - Path of the file/directory to modify
 * @param {Object} options      - All options for the file
 * @param {string} options.mode - Representation of file mode, eg: '0644'w
 * @param {(string|number)} options.owner - Username or uid of file owner
 * @param {(string|number)} options.group - Group name or gid of file's group
 */
FileDriverLocal.prototype.setAttributes = async function(path, attributes){
	log.trace("Updating file permissions for " + path);

	if(attributes.mode != null){
		if(!this.no_op_writes){
			await chmodAsync(path, parseInt(attributes.mode, 8));
		}
	}

	let cur_stats = await this.stat(path);
	let uid = cur_stats.uid;
	let gid = cur_stats.gid;

	if(attributes.owner != null){
		if (typeof attributes.owner === 'number'){
			uid = attributes.owner;
		} else if(typeof attributes.owner === 'string'){
			if(attributes.owner === 'root'){
				uid = 0;
			} else {
 				log.warn("uid's should be prefered over usernames to ensure " +
								 "correct operation on systems where the user does not exist, got: " +
								 attributes.owner);
				uid = execFileSync('/usr/bin/id', ['-u', attributes.owner]).toString();
			}
		} else {
			throw new Error("Invalid type for attributes.user, expected number representing uid or string representing username");
		}
	}

	if(attributes.group != null){
		if(typeof attributes.group === 'number'){
			gid = attributes.group;
		} else if (typeof attributes.group === 'string') {
			if(attributes.group === 'root'){
				gid = 0;
			} else if(typeof attributes.group === 'string') {
				log.warn("gid's should be prefered over group names to ensure " +
								 "correct operation on systems where the group does not exist, got: " +
								 attributes.group);
				uid = execFileSync('/usr/bin/id', ['-g', attributes.group]).toString();
			} else {
				throw new Error("Invalid type for attributes.group, expected number representing uid or string representing group name");
			}
		}
	}

	if(uid != cur_stats.uid || gid != cur_stats.gid && !this.no_op_writes){
		return await chownAsync(path, uid, gid);
	}
}


module.exports = FileDriverLocal;
