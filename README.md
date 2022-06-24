# What Would Brett Do?

This **EXPERIMENTAL** extension is meant to help people set up a [Python _environment_](https://code.visualstudio.com/docs/python/environments).

The project structure and user experience of this extension is **very opinionated**. While the supported project structures and workflows are considered common _enough_, do not be surprised if your particular workflow is not supported, especially if they would be considered advanced to someone new to Python.

This extension is meant act as a playground for the [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) around environments and solicit feedback on this extension's functionality. If you have any feedback, please start a [discussion](https://github.com/brettcannon/WWBD/discussions). Popular functionality _may_ make it's way into the Python extension itself.

## Features

### Automatic detection of activated virtual environments

If the `VIRTUAL_ENV` environment variable is set, WWBD will use that to set the selected Python environment.

### `Create Environment` command

1. Use an appropriate interpreter (the selected interpreter, ask the user to use the newest version of Python installed, or ask the user to pick an interpreter).
1. Create a virtual environment in the workspace that git will ignore: `python -m venv .venv --prompt . && echo "*" > .venv/.gitignore`.
2. Find the most appropriate requirements file (file name contains `dev` and `requirements` and ends in `.txt`, or `requirements.txt`).
3. Install the requirements into the environment: `python -m pip install --requirement <requirements file>`.

## Requirements

1. Python (must be an [actively maintained version](https://devguide.python.org/#status-of-python-branches); typically any version less than 5 years old)
2. [`venv`](https://docs.python.org/3/library/venv.html) (typically only missing on Debian-based Linux distros; install via `python3-venv`)
3. [`pip`](https://pip.pypa.io/) (typically only missing on Debian-based Linux distros; install via `python3-pip`)
4. [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) (which will be installed automatically)

## Extension Settings

N/A

## Known Issues

- The selected Python interpreter must have `venv` and `pip` available/installed (something Debian/Ubuntu users must watch out for).
- Does not support multi-root workspaces (blindly selects the first workspace).
- Does not try to be smart if no workspace is selected.
