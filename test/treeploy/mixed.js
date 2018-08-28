/**
 * Test suite for testing mixed deployments utalizing all features at once
 */

require('../common.js');

let file_content_config = `
{
	"db": {
		"username" : "test",
		"password" : "{{= it.secrets.db_password }}"
	},
	"web": {
		"host" : "test.example.com",
		"port" : 80
	}
}
`;

let file_content_config_tree = `
- config.json:
    owner : root
    group : root
    mode  : '0400'
`;

let file_content_bin_tree = `
- z_script.sh:
    owner : {{= it.web.uid }}
    group : {{= it.web.gid }}
`;

afterEach(() => {
	mockfs.restore();
});

it('Complex scenario', () => {
	mockfs({
		source : {
			config : {
				'tree.yaml'       : file_content_config_tree,
				'config.json.dot' : mockfs.file({
					content: file_content_config,
				}),
			},
			bin : {
				'tree.yaml.dot' : file_content_bin_tree,

				// make a script which is processed AFTER tree.yaml by default
				// (as name begins with z)
				// the tree.yaml.dot should still be applied afterwards, if
				// not the owner and group wont be set correctly
				'z_script.sh' : mockfs.file({
					content: 'echo hi',
					mode   : parseInt('700', 8),
				}),
			},
			data : {
				'tree.yaml' : '- db/\n- web/\n'
			},
		},
	});

	return treeploy('source', 'target', {
		dot_models: {
			it: {
				web : {
					uid: 5555,
					gid: 6666,
				},
				secrets : {
					db_password: 'letmein',
				},
			},
		},
	}).then(() => {

		// tree and template files not copied
		expectNone('target/config/tree.yaml'      );
		expectNone('target/config/config.json.dot');
		expectNone('target/bin/tree.yaml.dot'     );
		expectNone('target/bin/tree.yaml'         );
		expectNone('target/data/tree.yaml'        );

		expectDir ('target/config');
		expectFile('target/config/config.json', {
			uid     : 0,
			gid     : 0,
			mode    : '0400',
			content : {
				db: {
					username: "test", password: "letmein",
				},
				web: {
					host: "test.example.com", port: 80
				},
			}
		});


		expectDir ('target/bin');
		expectFile('target/bin/z_script.sh', {
			contents: 'echo hi',
			uid     : 5555,
			gid     : 6666,
			mode    : '0700',
		});

		expectDir('target/data'    );
		expectDir('target/data/db' );
		expectDir('target/data/web');
	});
});
