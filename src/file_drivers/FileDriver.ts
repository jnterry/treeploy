import fs from 'fs';

/**
 * Represents attributes for some entity in a filesystem
 */
interface FileAttr {
	/** uid or string username representing owner of file */
	owner: string | number,

	/** gid or string username representing owner of file */
	group: string | number,

	/**
	 * Octal string proceded with '0' representing file's permissions,
	 * for example '0644'
	 */
	mode: string
};

/**
 * Represents a set of queries that can be ran against some file system
 */
interface IFileDriverReader {
	/**
	 * Reads the contents of a file at some location
	 *
	 * @param path - The location of the file to read
	 */
	readFile: ((path : string) => Promise<Buffer>);

	/**
	 * Checks whether a path exists, this says nothing about the type of entity
	 * at the path, eg could be a directory, file, symlink, socket, etc
	 *
	 * @param path - The location to check
	 *
	 * @return Promise which resolves to true or false, of rejects if it cannot
	 * be determined whether the path exists
	 */
	exists: ((path : string) => Promise<Boolean>);

	/**
	 * Checks whether a path exists, and if so whether it is a directory
	 *
	 * @param path - The location to check
	 *
	 * @return Promise which resolves to true or false, of rejects if it cannot
	 * be determined whether the path exists
	 */
	existsDir: ((path : string) => Promise<Boolean>);

	/**
	 * Checks whether a path exists, and if so whether it is a directory
	 *
	 * @param path - The location to check
	 *
	 * @return Promise which resolves to true or false, or rejects if it cannot
	 * be determined whether the path exists
	 */
	existsFile: ((path : string) => Promise<Boolean>);

	/**
	 * Lists the contents of a directory, excluding '.' and '..'
	 *
	 * @param path - Path to directory to read
	 *
	 * @return Promise which resolves to array of strings representing the
	 * entities in the directory, or rejects if either the directory does not
	 * exist, or we don't have permission to read it
	 */
	readdir  : ((path : string) => Promise<Array<string>>);

	/**
	 * Reads the [[FileAttr]] for some path
	 *
	 * @param path - The path to query
	 *
	 * @return Promise which resolves to [[FileAttr]] object for the path,
	 * will reject if path does not exist or we do not have permission to
	 * check it
	 */
	getAttributes : ((path : string) => Promise<FileAttr>);
};

/**
 * Represents a set of actions that can be ran against some file system
 */
interface IFileDriverWriter {
	/**
	 * Writes a file
	 */
	writeFile : ((path : string, content : string | Buffer) => Promise<boolean>);

	/**
	 * Removes a file or directory at specified path if it exists. Will
	 * also delete any contents if the path is a directory. If the path
	 * does not already exist then this function is a no-op, and resolves
	 * to true regardless
	 *
	 * @param path - Path of the directory to create
	 *
	 * @return Promise which always either resolves to true to indicate success,
	 * or which is rejected to indicate an error, eg we do not have permissions to
	 * remove the entity
	 */
	remove : ((path : string) => Promise<boolean>);

	/**
	 * Makes a directory, recursively creates any required parents and
	 * also deletes any conflicts if a parent component of the path already
	 * exists but as a something other than a directory
	 *
	 * @param path - Path of the directory to create
	 *
	 * @return Promise which always either resolves to true to indicate success,
	 * or which is rejected to indicate an error, eg we do not have permissions to
	 * modify its attributes
	 */
	mkdir : ((path : string,
						opts : {
							overwrite : boolean|undefined,
							recursive : boolean|undefined,
						}
					 ) => Promise<boolean>);

	/**
	 * Applies a mode, owner and group to an existing file path
	 *
	 * @param path - Path of file or directory to modify
	 * @param FileAttr - The set of attributes to apply to the File
	 *
	 * @return Promise which always either resolves to true to indicate success,
	 * or which is rejected to indicate an error, eg, path does not exist or
	 * we do not have permission to modify its attributes
	 */
	setAttributes : ((path : string, attributes : FileAttr) => Promise<boolean>);

};

export { FileAttr          };
export { IFileDriverReader };
export { IFileDriverWriter };
