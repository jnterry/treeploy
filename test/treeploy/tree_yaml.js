/**
 * Test suite for testing the deployment from tree.yaml files
 */

require('../common.js');

describe('Single tree.yaml at root', () => {
	it('Single file', () => {
		mockfs({
			source : {
				'tree.yaml': '- test.txt'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync  ('target/test.txt')).is.true;
				expect(fs.statSync    ('target/test.txt').isFile()).is.true;
				expect(fs.readFileSync('target/test.txt').toString('utf8')).is.deep.equal('');
			})
			.finally(() => {
				mockfs.restore();
			});
	});


	it('Multiple files', () => {
		mockfs({
			source : {
				'tree.yaml': '- test.txt\n- stuff.txt\n- thing.blob'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync  ('target/test.txt')).is.true;
				expect(fs.statSync    ('target/test.txt').isFile()).is.true;
				expect(fs.readFileSync('target/test.txt').toString('utf8')).is.deep.equal('');

				expect(fs.existsSync  ('target/stuff.txt')).is.true;
				expect(fs.statSync    ('target/stuff.txt').isFile()).is.true;
				expect(fs.readFileSync('target/stuff.txt').toString('utf8')).is.deep.equal('');

				expect(fs.existsSync  ('target/thing.blob')).is.true;
				expect(fs.statSync    ('target/thing.blob').isFile()).is.true;
				expect(fs.readFileSync('target/thing.blob').toString('utf8')).is.deep.equal('');
			})
			.finally(() => {
				mockfs.restore();
			});
	});

	it('Single directory, notated by /', () => {
		mockfs({
			source : {
				'tree.yaml': '- test.txt/'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync  ('target/test.txt')).is.true;
				expect(fs.statSync    ('target/test.txt').isDirectory()).is.true;
			})
			.finally(() => {
				mockfs.restore();
			});
	});

	it('Single directory, notated by empty children array', () => {
		mockfs({
			source : {
				'tree.yaml': '- test.txt:\n    children: []'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync  ('target/test.txt')).is.true;
				expect(fs.statSync    ('target/test.txt').isDirectory()).is.true;
			})
			.finally(() => {
				mockfs.restore();
			});
	});

	it('Multiple directories', () => {
		mockfs({
			source : {
				'tree.yaml': '- dir_a/\n- dir_b/'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync  ('target/dir_a')).is.true;
				expect(fs.statSync    ('target/dir_b').isDirectory()).is.true;
			})
			.finally(() => {
				mockfs.restore();
			});
	});

	it('Nested directories and files', () => {
		mockfs({
			source : {
				'tree.yaml': '- dir_a/\n- dir_b:\n    children:\n        - nested_a/\n        - file.txt'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync  ('target/dir_a')).is.true;
				expect(fs.statSync    ('target/dir_b').isDirectory()).is.true;

				expect(fs.existsSync  ('target/dir_b/nested_a')).is.true;
				expect(fs.statSync    ('target/dir_b/nested_a').isDirectory()).is.true;

				expect(fs.existsSync  ('target/dir_b/file.txt')).is.true;
				expect(fs.statSync    ('target/dir_b/file.txt').isFile()).is.true;
			})
			.finally(() => {
				mockfs.restore();
			});
	});


	it('File with permissions', () => {
		mockfs({
			source : {
				'tree.yaml': '- text.txt:\n    owner: 1234\n    group: 10\n    mode: "0760"'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync   ('target/text.txt')).is.true;
				let stats = fs.statSync('target/text.txt');
				expect(stats.isFile()).is.true;
				expect(stats.uid).is.deep.equal(1234);
				expect(stats.gid).is.deep.equal(10);
				expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0760');

			})
			.finally(() => {
				mockfs.restore();
			});
	});

	it('Directory with permissions', () => {
		mockfs({
			source : {
				'tree.yaml': '- dir/:\n    owner: 1234\n    group: 10\n    mode: "0760"'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync  ('target/tree.yaml')).is.false;

				expect(fs.existsSync   ('target/dir')).is.true;
				let stats = fs.statSync('target/dir');
				expect(stats.isDirectory()).is.true;
				expect(stats.uid).is.deep.equal(1234);
				expect(stats.gid).is.deep.equal(10);
				expect(file_utils.getStatPermissionString(stats)).is.deep.equal('0760');

			})
			.finally(() => {
				mockfs.restore();
			});
	});
});

describe('Multiple tree.yamls', () => {
	it('Simple Case', () => {
		mockfs({
			source : {
				dir_a : {
					'tree.yaml': '- file_1.txt\n- file_2.txt\n- file_3.txt'
				},
				dir_b : {
					'tree.yaml': '- dir/:\n    children:\n        - hi.txt\n- stuff.txt\n'
				}
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expect(fs.existsSync('target/tree.yaml'       )              ).is.false;
				expect(fs.existsSync('target/dir_a/tree.yaml' )              ).is.false;
				expect(fs.existsSync('target/dir_b/tree.yaml' )              ).is.false;

				expect(fs.existsSync('target/dir_a/file_1.txt')              ).is.true;
				expect(fs.statSync  ('target/dir_a/file_1.txt').isFile()     ).is.true;

				expect(fs.existsSync('target/dir_a/file_2.txt')              ).is.true;
				expect(fs.statSync  ('target/dir_a/file_2.txt').isFile()     ).is.true;

				expect(fs.existsSync('target/dir_a/file_3.txt')              ).is.true;
				expect(fs.statSync  ('target/dir_a/file_3.txt').isFile()     ).is.true;


				expect(fs.existsSync('target/dir_b/dir'       )              ).is.true;
				expect(fs.statSync  ('target/dir_b/dir'       ).isDirectory()).is.true;

				expect(fs.existsSync('target/dir_b/dir/hi.txt')              ).is.true;
				expect(fs.statSync  ('target/dir_b/dir/hi.txt').isFile()     ).is.true;

				expect(fs.existsSync('target/dir_b/stuff.txt' )              ).is.true;
				expect(fs.statSync  ('target/dir_b/stuff.txt' ).isFile()     ).is.true;

			})
			.finally(() => {
				mockfs.restore();
			});
	});
});


describe('Invalid tree.yamls', (done) => {
	it('Empty yaml', () => {
		mockfs({
			source : {
				'tree.yaml': ''
			},
		});

		return expect(
			treeploy('source', 'target')
				.finally(() => mockfs.restore())
		).to.be.rejected;
	});

	it('Malformed yaml', () => {
		mockfs({
			source : {
				'tree.yaml': '::-:\n:-::'
			},
		});

		return expect(
			treeploy('source', 'target')
				.finally(() => mockfs.restore())
		).to.be.rejected;
	});

	it('No root list', () => {
		mockfs({
			source : {
				'tree.yaml': `
bad: entry
should: be
a: list
				`,
			},
		});

		return expect(
			treeploy('source', 'target')
				.finally(() => mockfs.restore())
		).to.be.rejected;
	});
});
