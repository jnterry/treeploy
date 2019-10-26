# Build the standalone executables
mkdir -p exe/
./node_modules/.bin/pkg ./bin/treeploy --out-path ./exe --targets node12-linux-x64 --public
mv ./exe/treeploy ./exe/treeploy-linux-x64
