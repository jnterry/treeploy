/**
 * Exports a file driver which manipulates a remote file system over SSH2
 */

import Ssh2          from 'ssh2';
import { promisify } from 'util';

import { FileDriver, FileDriverOptions, IFileDriverFactory } from './FileDriver';
import { PathAttr, PathType, IWriter, IReader }              from './FileDriverTypes';
import log                                                   from './../log';

class Ssh2Reader implements IReader {

	async readFile(path : string) : Promise<Buffer> {
		return Buffer.from([]);
	}

	async readdir(path : string) : Promise<any[]> {
		return [];
	}

	async getPathType(path : string) : Promise<PathType> {
		return PathType.NoExist;
	}

	async getAttributes(path : string) : Promise<PathAttr> {
		return {} as PathAttr;
	};
};

class Ssh2Writer implements IWriter {
	async writeFile(path : string, content : String | Buffer) : Promise<void>{
		return;
	}

	async mkdirComponent(path : string) : Promise<void>{
		return;
	}

	async remove(path : string) : Promise<void> {
		return;
	};

	async setAttributes(path : string, attributes : PathAttr) : Promise<void> {
		return;
	}
};


function createSsh2Driver(options : FileDriverOptions) : FileDriver {
	let reader : IReader = new Ssh2Reader();
	let writer : IWriter | undefined;

	if(options.writes_enabled){
		writer = new Ssh2Writer();
	}

	return new FileDriver(options, reader, writer);
}

export default {
	create     : createSsh2Driver,
	path_regex : /.*/, // :TODO: something better?
} as IFileDriverFactory;
