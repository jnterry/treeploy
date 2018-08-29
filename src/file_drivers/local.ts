/**
 * Exports a file driver which manipulates the local file system
 */

import fs              from 'fs';
import { promisify }   from 'util';
import {execFileSync } from 'child_process';
import path            from 'path';

import { FileAttr, IFileDriverWriter, IFileDriverReader } from './FileDriver';
import log        from './../log';
import file_utils from './../file_utils';

///////////////////////////////////////////////////////
// Make some private wrappers that return promises
let writeFileAsync = promisify(fs.writeFile);
let chownAsync     = promisify(fs.chown);
let chmodAsync     = promisify(fs.chmod);
let unlinkAsync    = promisify(fs.unlink);
let rmdirAsync     = promisify(fs.rmdir);
let mkdirAsync     = promisify(fs.mkdir);
///////////////////////////////////////////////////////



///////////////////////////////////////////////////////
// Make the local file driver
class FileDriverLocal {
	private no_op_writes : boolean

	// FileDriverLocal can attempt to handle any path (for now)
	static uri_regex    : RegExp  = /.*/;

	// FileDriverLocal can make changes to the file system
	static is_read_only : boolean = false;

	constructor(no_op_writes : boolean){
		this.no_op_writes = no_op_writes;
	}

	//readFile = promisify(fs.readFile);
	readFile(path : string) : Promise<Buffer> {
		// Below is a temporary work around for:
		// https://github.com/tschaub/mock-fs/issues/245
		return new Promise((resolve, reject) => {
			try {
				let content = fs.readFileSync(path);
				resolve(content)
			} catch (e) {
				reject(e);
			}
		});
	}

	exists    = promisify(fs.exists);
	stat      = promisify(fs.stat);
	readdir   = promisify(fs.readdir);

	async getAttributes(path : string) : Promise<FileAttr> {
		let stat = await this.stat(path);

		return {
			owner : stat.uid,
			group : stat.gid,
			mode  : file_utils.getStatPermissionString(stat),
		};
	}

	async writeFile(path : string, content : string | Buffer){
		if(this.no_op_writes){ return; }
		return writeFileAsync(path, content);
	}

	/**
	 * Removes a file or directory at specified path
	 */
	async remove(path : string){
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
	async mkdir(dir_path : string){
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
	async setAttributes(path : string, attributes : FileAttr){
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
					uid = parseInt(execFileSync('/usr/bin/id', ['-u', attributes.owner]).toString());
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
					gid = parseInt(execFileSync('/usr/bin/id', ['-g', attributes.group]).toString());
				} else {
					throw new Error("Invalid type for attributes.group, expected number representing uid or string representing group name");
				}
			}
		}

		if(uid != cur_stats.uid || gid != cur_stats.gid && !this.no_op_writes){
			return await chownAsync(path, uid, gid);
		}
	}
}

export default FileDriverLocal;
