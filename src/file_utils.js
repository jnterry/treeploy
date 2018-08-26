const execSync   = require('child_process').execSync;

/**
 * Takes the permissions, owner, etc of an input file and applies them
 * to an output file, without changing the file's contents
 *
 * @param in_path {string}  - Path to the file whose meta data you wish to copy
 * @param out_path {string} - Path to file to apply to meta data to
 */
function syncFileMetaData(in_path, out_path){
	execSync("chown $(stat -c '%u:%g' " + in_path + ") " + out_path);
	execSync("chmod $(stat -c '%a' "    + in_path + ") " + out_path);
	execSync("touch -r " + in_path + " " + out_path); // copy timestamps
}

/**
 * Applies a mode, owner and group to an existing file path
 *
 * @param {Object} options      - All options for the file
 * @param {string} options.mode - Representation of file mode, eg: '0644'w
 * @param {(string|number)} options.owner - Username or uid of file owner
 * @param {(string|number)} options.group - Group name or gid of file's group
 */
function applyFilePermissions(options, path){
	if(options.mode  != null){
		execSync('chmod ' + options.mode  + ' ' + path);
	}

	if(options.owner != null){
		if(typeof options.owner != 'number' && options.owner != 'root'){
			console.log("WARNING: uid's should be prefered over usernames to ensure " +
									"correct operation on systems where the user does not exist, got: " +
									options.owner);
		}
		execSync('chown ' + options.owner + ' ' + path);
	}
	if(options.group != null){
		if(typeof options.group != 'number' && options.group != 'root'){
			console.log("WARNING: gid's should be prefered over group names to ensure " +
									"correct operation on systems where the group does not exist, got: " +
									options.group);
		}
		execSync('chgrp ' + options.group + ' ' + path);
	}
}

module.exports = {
	syncFileMetaData,
	applyFilePermissions,
};
