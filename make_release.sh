# Build the standalone executables
mkdir -p dist/
./node_modules/.bin/pkg ./bin/treeploy --out-path ./dist --targets linux-x64,mac-x64,win-x64
