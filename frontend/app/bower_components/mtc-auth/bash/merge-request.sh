#!/bin/bash -E

# Install Dependencies
echo "INSTALLING NODE MODULES..."
npm install

echo "BOWER INSTALL..."
bower install

# Run tests
echo "RUN TESTS"
grunt test-ci

# Publish coverage
