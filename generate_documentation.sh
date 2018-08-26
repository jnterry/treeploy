#!/usr/bin/env bash
#
# Generates documentation for treeploy

set -e

pushd $(dirname "${0}") > /dev/null
SCRIPTDIR=$(pwd -L)
popd > /dev/null

rm -rf ${SCRIPTDIR}/docs/

$SCRIPTDIR/node_modules/jsdoc/jsdoc.js \
		${SCRIPTDIR}/src/ \
		-R ${SCRIPTDIR}/README.md \
		-d ${SCRIPTDIR}/docs/ \
		-t ${SCRIPTDIR}/node_modules/minami \
