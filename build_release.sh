# Build the standalone executables
mkdir -p dist/
./node_modules/.bin/pkg ./bin/treeploy --out-path ./dist --targets linux-x86,linux-x64
mv ./dist/treeploy-x64 ./dist/treeploy-linux-x64
mv ./dist/treeploy-x86 ./dist/treeploy-linux-x86
