# Testing

## Automated tests

### Python

Assuming use of the [Python Launcher for Unix](https://github.com/brettcannon/python-launcher).

```terminal
py -m venv .venv
py -m pip install -r requirements-dev.txt
py -m pytest python-src/tests
```

The tests are also set up to use the test explorer provided by the
[Python extension](https://aka.ms/pvsc-marketplace).


### TypeScript

```terminal
yarn test
```

If you receive an error about missing `.so` files, you may need to install the
following packages (listed by their `apt` install names):

- `libatk1.0-0`
- `libatk-bridge2.0-0`
- `libgtk-3-dev`


## Manual testing

- [ ] The `WWBD: Create Environment` command is registered/available.
- [ ] When no workspace is open, an error message is shown.
- [ ] When an environment already exists at `.venv`,show a warning message.
  - [ ] Select the environment
  - [ ] Cancel
- [ ] When something other than an environment exists at `.venv`, show an error
      message.
- [ ] When no interpreter previously selected, show a warning message.
- [ ] When an interpreter directory (but no interpreter) is selected, show a
      warning message.
- [ ] If a non-global interpreter is selected, show a warning message.
- [ ] Environment selected after environment creation is completed.
- [ ] If environment creation fails, an error message and output panel is shown.


### Interpreter selection

- [ ] Select newest.
- [ ] Select from quick pick.
  - [ ] Sorted newest to oldest.
- [ ] Cancel.
