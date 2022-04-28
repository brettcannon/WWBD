# What Would Brett Do?

This **EXPERIMENTAL** extension is meant to help people set up a Python _environment_.

The project structure and user experience of this extension is **very opinionated**. While the supported project structures and workflows are considered common _enough_, do not be surprised if your particular workflow is not supported, especially if they would be considered advanced to a beginner.

## Features

### `Create Environment` command

1. Use an appropriate interpreter (the selected interpreter, ask the user to use the newest version of Python installed, or ask the user to pick an interpreter).
1. Create a virtual environment in the workspace: `python -m venv .venv --prompt .`.
2. Find the most appropriate requirements file (file name contains `dev` and `requirements` and ends in `.txt`, or `requirements.txt`).
3. Install the requirements into the environment: `python -m pip install --requirement <requirements file>`.

## Requirements

1. Python (must be an [actively maintained version](https://devguide.python.org/#status-of-python-branches))
2. [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) (which will be installed automatically)

## Extension Settings

N/A

## Known Issues

- The selected Python interpreter must have `venv` and `pip` available/installed (something Debian/Ubuntu users must watch out for).
- Does not support multi-root workspaces (blindly selects the first workspace).
- Does not try to be smart if no workspace is selected.
