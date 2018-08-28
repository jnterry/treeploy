/**
 * Test suite for testing the deployment from tree.yaml files
 */

require('../common.js');

afterEach(() => {
	mockfs.restore();
});

describe('Single tree.yaml at root', () => {
	it('Single file', () => {
		mockfs({
			source : {
				'tree.yaml': '- test.txt'
			},
		});

		return treeploy('source', 'target')
			.then(() => {
				expectNone('target/tree.yaml');
				expectFile('target/test.txt', { content: '' });
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
				expectNone('target/tree.yaml');
				expectFile('target/test.txt',   { content: '' });
				expectFile('target/stuff.txt',  { content: '' });
				expectFile('target/thing.blob', { content: '' });
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
				expectNone('target/tree.yaml');
				expectDir ('target/test.txt' );
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
				expectNone('target/tree.yaml');
				expectDir ('target/test.txt' );
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
				expectNone('target/tree.yaml');
				expectDir ('target/dir_a');
				expectDir ('target/dir_b');
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
				expectNone('target/tree.yaml');
				expectDir ('target/dir_a');
				expectDir ('target/dir_b/nested_a');
				expectFile('target/dir_b/file.txt', { content: '' });
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
				expectNone('target/tree.yaml');
				expectFile('target/text.txt', {
					uid     : 1234,
					gid     : 10,
					mode    : '0760',
					content : '',
				});
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
				expectNone('target/tree.yaml');
				expectDir ('target/dir', {
					uid     : 1234,
					gid     : 10,
					mode    : '0760',
					content : '',
				});
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
				expectNone('target/tree.yaml'       );
				expectNone('target/dir_a/tree.yaml' );
				expectNone('target/dir_b/tree.yaml' );

				expectFile('target/dir_a/file_1.txt');
				expectFile('target/dir_a/file_2.txt');
				expectFile('target/dir_a/file_3.txt');
				expectDir ('target/dir_b/dir');
				expectFile('target/dir_b/dir/hi.txt');
				expectFile('target/dir_b/stuff.txt' );

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

		return expect(treeploy('source', 'target')).to.be.rejected;
	});

	it('Malformed yaml', () => {
		mockfs({
			source : {
				'tree.yaml': '::-:\n:-::'
			},
		});

		return expect(treeploy('source', 'target')).to.be.rejected;
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

		return expect(treeploy('source', 'target')).to.be.rejected;
	});
});
