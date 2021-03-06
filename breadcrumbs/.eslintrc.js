module.exports = {
    "parser": "babel-eslint",
    "plugins": [
        "flowtype",
        "react"
    ],
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended"
    ],
    "rules": {
        "no-undef": 0,
        "indent": ["error", 4, { "SwitchCase": 1 }],
        "linebreak-style": ["error", "unix"],
        "semi": ["error", "always"],
        "no-console": 0,
    },
    "parserOptions": {
        "sourceType": "module",
    }
};
