/**
 * Contains implementation specific types realating to FileDrivers
 */

/**
 * Represents attributes for some entity in a filesystem
 */
export interface PathAttr {
	/** uid or string username representing owner of file */
	owner: string | number | undefined,

	/** gid or string username representing owner of file */
	group: string | number | undefined,

	/**
	 * Octal string proceded with '0' representing file's permissions,
	 * for example '0644'
	 */
	mode: string | undefined
};

/** Enumeration of the types of file system entities */
export enum PathType {
	/** The path does not exist */
	NoExist = 0, // 0 so evaluates to false if tested

	/** The path exists and is a file */
	File = "file",

	/** The path exists and is a directory */
	Directory = "directory",

	/** The path exists but is not one of the types listed above */
	Other = "unknown filesystem entity",
};


/**
 * Represents a set of queries that can be ran against some file system
 */
export interface IReader {
	/**
	 * Reads the contents of a file at some location
	 *
	 * @param path - The location of the file to read
	 */
	readFile(path : string) : Promise<Buffer>;

	/**
	 * Determines if a path exists, and if so what type it is
	 *
	 * @param path The path to check
	 *
	 * @return Promise which resolves to [[PathType]] or rejects if we do not
	 * have sufficent permissions to check the type of the path
	 */
	getPathType(path : string) : Promise<PathType>;

	/**
	 * Lists the contents of a directory, excluding '.' and '..'
	 *
	 * @param path - Path to directory to read
	 *
	 * @return Promise which resolves to array of strings representing the
	 * entities in the directory, or rejects if either the directory does not
	 * exist, or we don't have permission to read it
	 */
	readdir(path : string) : Promise<Array<string>>;

	/**
	 * Reads the [[PathAttr]] for some path
	 *
	 * @param path - The path to query
	 *
	 * @return Promise which resolves to [[PathAttr]] object for the path,
	 * will reject if path does not exist or we do not have permission to
	 * check it
	 */
	getAttributes(path : string) : Promise<PathAttr>;
};


export interface IWriter {
	/**
	 * Writes a file
	 */
	writeFile(path : string, content : string | Buffer) : Promise<void>;

	/**
	 * Removes a file or directory at specified path if it exists. Will
	 * also delete any contents if the path is a directory. If the path
	 * does not already exist then this function is a no-op, and resolves
	 * to true regardless
	 *
	 * @param path - Path of the directory to create
	 *
	 * @return Promise which either resolves to indicate success,
	 * or which is rejected to indicate an error, eg we do not have permissions to
	 * remove the entity
	 */
	remove(path : string) : Promise<void>;

	/**
	 * Applies a mode, owner and group to an existing file path
	 *
	 * @param path - Path of file or directory to modify
	 * @param PathAttr - The set of attributes to apply to the File
	 *
	 * @return Promise which always either resolves to true to indicate success,
	 * or which is rejected to indicate an error, eg, path does not exist or
	 * we do not have permission to modify its attributes
	 */
	setAttributes(path : string, attributes : PathAttr) : Promise<void>;

	/**
	 * Creates a single directory component. Should fail if parent
	 * does not exist, or if there is a conflict (eg, existing file with same name
	 *
	 * @param path The directory to make
	 *
	 * @return Promise which either resolves upon successful creation, or rejects
	 * if an error occurs
	 */
	mkdirComponent(path : string) : Promise<void>;
};
