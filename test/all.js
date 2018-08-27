/**
 * File which imports and runs all other test scripts
 */

"use strict";

/////////////////////////////////////////////////////////////////////
/// \brief Helper function which imports a file containing a test suite
/////////////////////////////////////////////////////////////////////
function importTest(name, path){
	if(path == null){ path = name; }

	describe(name, function(){
		require("./" + path);
	});
}

describe('treeploy', () => {
	importTest('file_utils');
	importTest('deploy_copy');
	importTest('deploy_tree_yaml');
	importTest('deploy_dot_file');
	importTest('deploy_mixed');
	importTest('deploy_single_file');
});
