# What Would Brett Do?

This **EXPERIMENTAL** extension is meant to help people set up a Python _environment_.

The project structure and user experience of this extension is **very opinionated** on purpose. While the supported projects structures and workflows are considered common _enough_, do not be surprised if your particular workflow is not supported, especially if they would be considered advanced to a beginner.

## Features

### `Create Extension` command

1. Create a virtual environment in the workspace: `python -m venv .venv --prompt .`.
2. Find the most appropriate requirements file (either by containing `dev` and `requirements` in the file name and ending in `.txt`, or `requirements.txt`).
3. Install the requirements into the environment: `python -m pip install --requirement <requirements file>`.

## Requirements

1. Python
2. [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) (which will be installed automatically)

## Extension Settings

N/A

## Known Issues

- Must have an interpreter selected.
- Must have the interpreter to use to create the virtual environment with selected.
- Selected Python interpreter must have `venv` and `pip` must be available to `venv` (something Debian/Ubuntu users must watch out for).
- Does not support multi-root workspaces (blindly selects the first workspace).
- Does not try to be smart if no workspace is selected.

## TODO

- Handle no interpreter pre-selected.
- Handle a non-global interpreter already being selected.
- Handle empty workspace (create `requirements.txt` file w/ comment explaining what the file is for).
- Figure out how to handle multi-root workspaces.
- Detect `$VIRTUAL_ENV` being set.
- Create a conda environment from `environment.yml`.
- Select a conda environment based on the name found in `environment.yml`.
- Detect `CONDA_DEFAULT_ENV` being set.
- Be able to cancel environment creation.
- Write tests on the TypeScript side.
