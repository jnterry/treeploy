# Build the standalone executables
mkdir -p exe/
./node_modules/.bin/pkg ./bin/treeploy --out-path ./exe --targets linux-x86,linux-x64 --public
mv ./exe/treeploy-x64 ./exe/treeploy-linux-x64
mv ./exe/treeploy-x86 ./exe/treeploy-linux-x86
