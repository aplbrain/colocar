import os
from distutils.core import setup

import colocarpy

"""
git tag {VERSION}
git push --tags
python setup.py sdist
python setup.py bdist_wheel --universal
twine upload dist/*
"""

VERSION = colocarpy.__version__

setup(
    name="colocarpy",
    version=VERSION,
    author="Jordan Matelsky",
    author_email="jordan.matelsky@jhuapl.edu",
    description=("Python client for colocard"),
    license="Apache 2.0",
    keywords="",
    url="https://github.com/aplbrain/colocarpy/tarball/" + VERSION,
    packages=['colocarpy'],
    scripts=[
       #  'scripts/'
    ],
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Developers',
        'Programming Language :: Python :: 3',
    ]
)
