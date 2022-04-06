import runpy


def main(args):
    runpy.run_module("wwbd", alter_sys=True, run_name="__main__")


if __name__ == "__main__":
    import sys

    main(sys.argv)


