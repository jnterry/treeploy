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
		.then(() => {
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
		.then(() => {
			checkTarget('/absolute/path/specified/here');
		}).finally(() => {
			mockfs.restore();
		});
});

it('We can overwrite existing target', () => {
	mockfs({
		source : source_structure,
		existing: 'uh oh I exist'
	});

	return treeploy_cli(['./source', 'existing', '--overwrite'])
		.then(() => {
			checkTarget('existing');
		}).finally(() => {
			mockfs.restore();
		});
});
