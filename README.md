 # Treeploy

_Directory tree deployment made easy_

[![Build Status](https://travis-ci.org/jnterry/treeploy.svg?branch=master)](https://travis-ci.org/jnterry/treeploy) [![Coverage Status](https://coveralls.io/repos/github/jnterry/treeploy/badge.svg?branch=master)](https://coveralls.io/github/jnterry/treeploy?branch=master)

# Use Cases

Treeploy is designed to assist in the automated deployment of applications, micro-services, etc by building the data directories that the application expects.

It is advantageous to track the data directory layout in the version control system along with the applications code, as this means:
- An old version of the code and data directory layout can be checked out with a single operation
- An automated deployment system that is triggered by changes to the git repository will be able to deploy either code changes, data changes (eg, config files) or both simultaneously, as they are stored in a unified repository

Note however that simply including the full data directory in git (or some other VCS) and copying it over with `cp`, `rsync` or similar is undesirable for a number of reasons, it is these that treeploy aims to solve:

- **File Ownership**
  - Git cannot preserve file ownership, instead checking out files as the user running git
  - [Solved by tree.yaml files](#treeyaml)
- **Empty Directories**
  - Empty directories cannot be added to git, but the application may not be able to start without them
  - [Solved by tree.yaml files](#treeyaml)
- **Updating Existing Deployment**
  - When updating an existing deployment, some files should be overwritten with those from the canonical source (for example, config files) where as others should not (for example, the application's database or log files)
  - We may want to update the permissions of existing files without overwriting the contents
  - [Solved by tree.yaml files](#treeyaml)
- **Multi-configuration Deployments**
  - If we simply copy the data directory from the VCS we cannot do anything smart, like changing the config files for different deployments, such as to staging vs to production
  - [Solved by evaluation of dot templates](#dot-templates)
- **Secrets**
  - It may be undesirable to save secrets in the application's repository, and instead they should be included dynamically as part of the deployment process
  - [Solved by evaluation of dot templates](#dot-templates)

# Installation

Treeploy is designed to be used in one of the following ways:

- **Command Line - Globally installed NPM module**
  - Run `sudo npm install -g treeploy`
  - `treeploy` can now be run from command line
  - This relies on the system having nodejs installed
- **Command Line - Standalone Executable**
  - For each release standalone executables that DO NOT depend on node.js being installed are generated using the [pkg](https://www.npmjs.com/package/pkg) module
  - Simply download a suitable version from [releases](https://github.com/jnterry/treeploy/releases) and add to your system's path
- **Programmatically**
  - Add treeploy as a dependency to your npm project
  - `treeploy = require('treeploy');`
  - Call `treeploy(input_path, output_path, { /* options */ })` as you wish

# Operation

The basic operation of `treeploy` is to take some source directory tree and copy all files within it to some target directory tree.

However there is special handling of some files in the input tree:

## doT Templates

Any files with a `.dot` extension will be processed by the [doT.js template engine](http://olado.github.io/doT/index.html) before being written to the output directory. Additionally the `.dot` extension will be removed, hence the file `nginx.conf.dot` in the input tree would produce the file `nginx.conf` in the output tree.

The doT.js template engine will be passed a model which can be constructed by utilising the following command line flags:

- `--model <field> <value>`
  - Sets single field of model
  - Value may be string, int, float or boolean
  - Example: `--model db.username 'root' --model db.password 'letmein'`
  - Example: `--model version.sha $(git rev-parse HEAD)`
- `--modelfile [field] <file>`
  - Loads a json or yaml file to set some part of the model
  - [field] argument is optional, if left out then file will be loaded as complete model
- `--modelcmd [field] <cmd>`
  - Runs some command and parses its output as JSON to set some part of the model
  - [field] argument is optional, if left out then JSON will be loaded as complete model

The model will be built up by considering all such --model* flags from left to right and merging the results together, overwriting values if fields are repeated. This allows for having a base parameter file which is overridden by later flags, for example with production specific secrets.

Note that the above and beyond standard dot.js, templates additionally support escaping delimiters with a backslash, IE: `\{{ hi \}}` will render as the string `{{ hi }}` without errors thrown by dot.js.

## tree.yaml

Any files named `tree.yaml` within the input tree will be parsed in order to produce a set of files or directories in the output tree. Files named `tree.yaml.dot` will first be processed by the dot template engine, and then treated as outlined below.

This configuration may also specify the owner, group and mode of created files. When re-deploying to an existing output tree:
- Existing files' contents will not be changed
- Existing files or directories WILL have their permissions updated, if they are specified in the `tree.yaml` configuration

Note also that any `tree.yaml` files are applied after the processing of dot templates and the copying of standard files, hence they can be used to encode the permissions of files that actually exist in the input tree.

An example `tree.yaml` is shown below:

```yaml
- dir_a/:
    mode: '0600'
    owner: root
    group: root
- dir_b/
- dir_c:
    owner: 1000
    group: 1000
    children:
      - file_1
      - file_2
      - dir/
- file_a
- file_b:
    mode: '0777'
```

The root of the yaml file must be an array of entries. Any entry with a trailing '/' in the name (such as `dir_a/` in the example or a 'children' field (such as `dir_c`) in the example will be created as directories. Any other children will be created as empty files.

Each entry may also have the fields:

- **owner** - string or number representing user name or uid of the entry's owner
- **group** - string or number representing group name or gid of the entry's group
- **mode**  - String of the form '0xxx' representing the unix file permissions

# File Drivers

Treeploy supports the concept of different "file drivers" for interacting with file systems of different types, for example, the local file system of the machine running treeploy, vs the file system of a remote server.

Points to note:

- The appropriate driver will be automatically selected based on the source and target paths specified - for example ```/dir``` will use the local driver, where as ```user@example.com:/dir``` will use the ssh2 driver
- It is not necessary for either the source or the target to use the local driver, it is possible for machine A to run treeploy, to deploy a template from machine B to machine C using the ssh2 driver for both the source and target
- Optional parameters can be passed to drivers using the command line arguments ```--sourcedriver field.name value``` or ```--targetdriver field.name value```.

Below is an outline of the available file drivers and their associated optional parameters:

<table>

<thead>
<tr>
<th>Driver Name</th>
<th>Path Format</th>
<th>Arguments</th>
</tr>
</thead>

<tbody>
<tr>
<td>local</td>
<td>/path/to/dir<br/>./../relative/path</td>
<td>
<ul>N/A
</ul>
</td>
</tr>


<tr>
<td>ssh2</td>
<td>username@example.com:/path<br/>192.168.0.50:~/path</td>
<td>
<ul>
<li><b>use_sudo</b> - If specified then the driver will attempt to escalate to root using the 'sudo' command on the remote machine. This is useful if the remote machine does not permit root login. In order for this to work 'sudo' must be in the remote user's path, and the user must be setup for passwordless use of sudo</li>
<li><b>agent_socket</b> - Path to the unix socket for the ssh-agent on the local machine used to authenticate. If not specified then defaults to the value of the environment variable SSH_AUTH_SOCK. In most cases this is probably what you want, as on a standard linux distribution this will use the key in ~/.ssh/id_rsa (and any others added to your ssh-agent)</li>
<li><b>key_file</b> - Path to a file containing the private key used to authenticate with the remote server</li>
<li><b>key_string</b> - String containing the private key used to authenticate with the remote server</li>
<li><b>password</b> - The password to login to the remote server with</li>
</ul>
</td>
</tr>
</tbody>
</table>
