/**
 * Exports a file driver which manipulates the local file system
 */

import fs                                 from 'fs';
import { promisify }                      from 'util';
import { execFileSync }                   from 'child_process';
import { FileDriver, FileDriverOptions, IFileDriverFactory } from './FileDriver';


import { PathAttr, PathType, IWriter, IReader } from './FileDriverTypes';
import log                  from './../log';

///////////////////////////////////////////////////////
// Make some private wrappers that return promises
let writeFileAsync = promisify(fs.writeFile);
let chownAsync     = promisify(fs.chown);
let chmodAsync     = promisify(fs.chmod);
let unlinkAsync    = promisify(fs.unlink);
let rmdirAsync     = promisify(fs.rmdir);
let mkdirAsync     = promisify(fs.mkdir);
let statAsync      = promisify(fs.stat);
///////////////////////////////////////////////////////

function getStatPermissionString(stats : fs.Stats){
	return '0' + (stats.mode & parseInt('777', 8)).toString(8);
}

async function getPathType(path : string) : Promise<PathType> {

	try {
		let stat = await statAsync(path);

		if(stat.isDirectory()) { return PathType.Directory; }
		if(stat.isFile()     ) { return PathType.File;      }
		return PathType.Other;

	} catch (e) {
		if(e.code != null && e.code === 'ENOENT'){
			return PathType.NoExist;
		}
		throw e;
	}
};

class LocalReader implements IReader {

	// Next line is what we want...
	//LocalRead.prototype.readFile = promisify(fs.readFile);

	// ...but to temporarily work around a bug in mock-fs we
	// will do this:
	// (see: https://github.com/tschaub/mock-fs/issues/245)
	readFile(path : string) : Promise<Buffer> {
		// Below is a temporary work around for:
		//
		return new Promise((resolve, reject) => {
			try {
				let content = fs.readFileSync(path);
				resolve(content)
			} catch (e) {
				reject(e);
			}
		});
	}

	readdir     = promisify(fs.readdir);
	getPathType = getPathType;

	async getAttributes(path : string) : Promise<PathAttr> {
		let stat = await statAsync(path);

		return {
			owner : stat.uid,
			group : stat.gid,
			mode  : getStatPermissionString(stat),
		};
	};
};

class LocalWriter implements IWriter {
	writeFile      = writeFileAsync;
	mkdirComponent = mkdirAsync;

	async remove(path : string) : Promise<void> {
		let path_type = await getPathType(path);

		switch(path_type){
			case PathType.NoExist:
				return;
			case PathType.Directory:
				return rmdirAsync(path).then(() => {});
			default:
				return unlinkAsync(path);
		}
	};

	async setAttributes(path : string, attributes : PathAttr) : Promise<void> {
		if(attributes.mode != null){
			await chmodAsync(path, parseInt(attributes.mode, 8));
		}

		let cur_stats = await statAsync(path);
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

		if(uid != cur_stats.uid || gid != cur_stats.gid){
			return await chownAsync(path, uid, gid);
		}
	};
};


async function createLocalDriver(options : FileDriverOptions) : Promise<FileDriver> {
	let reader : IReader = new LocalReader();
	let writer : IWriter | undefined;

	if(options.writes_enabled){
		writer = new LocalWriter();
	}

	return new FileDriver(options, reader, writer);
}

export default {
	create     : createLocalDriver,
	path_regex : /.+/,
	name       : 'local',
} as IFileDriverFactory;
