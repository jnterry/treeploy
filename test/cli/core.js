/**
 * Tests that the CLI works for core operations without fancy arguments.
 * This functionality should mostly be tested by the treeploy tests, this
 * just tests the cli wrapper works at a basic level
 */

require('../common.js');

let source_structure = {
	'thing.blob' : mockfs.file({
		content : '123',
		mode    : parseInt('700', 8),
	}),
	'dir_a' : {
		'a' : 'hi a',
		'b' : 'hi b',
		'nested' : {
			'deeply' : {
				'tree.yaml': "- '1'\n- '2'\n- '3'"
			}
		},
	},
};

function checkTarget(target){
	expectFile([target, 'thing.blob'            ], { content: '123', mode: '0700' });
	expectDir ([target, 'dir_a'                 ], {                              });
	expectFile([target, 'dir_a/a'               ], { content: 'hi a'              });
	expectFile([target, 'dir_a/b'               ], { content: 'hi b'              });
	expectDir ([target, 'dir_a/nested'          ], {                              });
	expectDir ([target, 'dir_a/nested/deeply'   ], {                              });
	expectFile([target, 'dir_a/nested/deeply/1' ], { content: ''                  });
	expectFile([target, 'dir_a/nested/deeply/2' ], { content: ''                  });
	expectNone([target, 'dir_a/nested/deeply/tree.yaml']);
}

it('Basic Usage', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['source', 'target'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			checkTarget('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Relative and absolute paths', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['./source', '/absolute/path/specified/here'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			checkTarget('/absolute/path/specified/here');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Overwrite existing target', () => {
	mockfs({
		source : source_structure,
		existing: 'uh oh I exist'
	});

	return treeploy_cli(['./source', 'existing', '--overwrite', '-vvv'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			checkTarget('existing');
		}).finally(() => {
			mockfs.restore();
		});
});

it('If we specify --help then nothing gets done', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['source', 'target', '--help'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('-h can be specified without IO paths', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['-h'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('If we specify -h then nothing gets done', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['source', 'target', '-vhvv'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Specifing no arguments causes bad exit code', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli([])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(1);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Specifing flag before IO paths causes bad exit code', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['--noroot', 'source', 'target'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(1);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Specifing only source causes bad exit code', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli([])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(1);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Invalid flags causes bad exit code', () => {
	mockfs({
		source : source_structure,
	});

	return treeploy_cli(['source', 'target', '--badflag'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(1);
			expectNone('target');
		}).finally(() => {
			mockfs.restore();
		});
});

it('Single file mode acts as cp --preserve does if source is not special file', () => {
	let file_opts = {
		content : 'Hello world!',
		uid     : 123,
		gid     : 321,
		mode    : parseInt('711', 8),
	};

	mockfs({
		'in.txt' : mockfs.file(file_opts)
	});

	file_opts.mode = '0711';

	return treeploy_cli(['in.txt', 'out.txt'])
		.then((exit_code) => {
			expect(exit_code).is.deep.equal(0);

			expectFile('in.txt',  file_opts);
			expectFile('out.txt', file_opts);
		}).finally(() => {
			mockfs.restore();
		});
});
