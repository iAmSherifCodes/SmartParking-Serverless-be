#!/bin/bash

set -e

# Ensure it's a Git repo
if [ ! -d .git ]; then
  echo "Error: Not a git repository. Run 'git init' first."
  exit 1
fi

# Stage all changes except .aws-sam folder
git add . -- ':!*.aws-sam' ':!.aws-sam/**'

# Loop through each staged file and commit individually
for file in $(git diff --cached --name-only); do
  git commit -m "Add/update file: $file" -- "$file"
done

# Push to main branch (change if your default branch is different)
git push origin main
