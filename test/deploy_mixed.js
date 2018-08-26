/**
 * Test suite for testing mixed deployments utalizing all features at once
 */

const expect     = require('chai').expect;
const mockfs     = require('mock-fs');
const fs         = require('fs');

const file_utils = require('../src/file_utils.js');
const treeploy   = require('../src/index.js');


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

		{ // tree and template files not copied
			expect(fs.existsSync('target/config/tree.yaml'      )).is.false;
			expect(fs.existsSync('target/config/config.json.dot')).is.false;
			expect(fs.existsSync('target/bin/tree.yaml.dot'     )).is.false;
			expect(fs.existsSync('target/bin/tree.yaml'         )).is.false;
			expect(fs.existsSync('target/data/tree.yaml'        )).is.false;
		}

		{ // config/
			expect(fs.existsSync('target/config'            )              ).is.true;
			expect(fs.statSync  ('target/config'            ).isDirectory()).is.true;
			expect(fs.existsSync('target/config/config.json')              ).is.true;

			let config_stat = fs.statSync('target/config/config.json');
			expect(config_stat.isFile()).is.true;
			expect(config_stat.uid     ).is.deep.equal(0);
			expect(config_stat.gid     ).is.deep.equal(0);
			expect(file_utils.getStatPermissionString(config_stat)).is.deep.equal('0400');

			let config_content = fs.readFileSync('target/config/config.json');
			let config = JSON.parse(config_content);
			expect(config).is.deep.equal({
				db: {
					username: "test", password: "letmein",
				},
				web: {
					host: "test.example.com", port: 80
				},
			});
		}

		{ // bin/

			expect(fs.existsSync('target/bin')              );
			expect(fs.statSync  ('target/bin').isDirectory());

			expect(fs.existsSync('target/bin/z_script.sh')).is.true;

			let contents = fs.readFileSync('target/bin/z_script.sh').toString('utf8');
			expect(contents).is.deep.equal('echo hi');


			let stats = fs.statSync('target/bin/z_script.sh');
			expect(stats.uid).is.deep.equal(5555);
			expect(stats.gid).is.deep.equal(6666);
			expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0700');
		}

		{ // data/
			expect(fs.existsSync('target/data'    )              ).is.true;
			expect(fs.statSync  ('target/data'    ).isDirectory()).is.true;
			expect(fs.existsSync('target/data/db' )              ).is.true;
			expect(fs.statSync  ('target/data/db' ).isDirectory()).is.true;
			expect(fs.existsSync('target/data/web')              ).is.true;
			expect(fs.statSync  ('target/data/web').isDirectory()).is.true;
		}
	}).finally(() => {
		mockfs.restore();
	});
});
