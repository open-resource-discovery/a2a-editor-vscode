# Contributing

## Code of Conduct

All members of the project community must abide by the [SAP Open Source Code of Conduct](https://github.com/SAP/.github/blob/main/CODE_OF_CONDUCT.md).
Only by respecting each other we can develop a productive, collaborative community.
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting [a project maintainer](.reuse/dep5).

## Engaging in Our Project

We use GitHub to manage reviews of pull requests.

- If you are a new contributor, see: [Steps to Contribute](#steps-to-contribute)

- Before implementing your change, create an issue that describes the problem you would like to solve or the code that should be enhanced. Please note that you are willing to work on that issue.

- The team will review the issue and decide whether it should be implemented as a pull request. In that case, they will assign the issue to you. If the team decides against picking up the issue, the team will post a comment with an explanation.

## Steps to Contribute

Should you wish to work on an issue, please claim it first by commenting on the GitHub issue that you want to work on. This is to prevent duplicated efforts from other contributors on the same issue.

If you have questions about one of the issues, please comment on them, and one of the maintainers will clarify.

## Contributing Code or Documentation

You are welcome to contribute code in order to fix a bug or to implement a new feature that is logged as an issue.

The following rule governs code contributions:

- Contributions must be licensed under the [Apache 2.0 License](./LICENSE).
- Due to legal reasons, contributors will be asked to accept a Developer Certificate of Origin (DCO) when they create the first pull request to this project. This happens in an automated fashion during the submission process. SAP uses [the standard DCO text of the Linux Foundation](https://developercertificate.org/).
- Contributions must follow our [guidelines on AI-generated code](https://github.com/SAP/.github/blob/main/CONTRIBUTING_USING_GENAI.md) in case you are using such tools.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 24, with the npm version that ships with the latest Node.js 24 release. CI installs dependencies with `npm ci` using that npm. Older npm versions can drop optional entries from `package-lock.json` when you run `npm install`, and `npm ci` then fails in CI.
- [VS Code](https://code.visualstudio.com/) >= 1.110

### Setup

```bash
git clone https://github.com/open-resource-discovery/a2a-editor-vscode.git
cd a2a-editor-vscode
npm install
npm run compile
```

### Run in Development

1. Open this folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. In the new window, click the **A2A icon** in the Activity Bar or run a command from the palette

### Install a Local Build

To try a development build in your regular VS Code instead of the Extension Development Host, package it and install the `.vsix`:

```bash
npm run package
code --install-extension a2a-editor-vscode-<version>.vsix
```

Or from the UI: **Extensions** view → `…` menu → **Install from VSIX…** → pick the built file.

### Available Scripts

| Script             | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run compile`  | Build extension and webview                   |
| `npm run watch`    | Watch mode for both builds                    |
| `npm run lint`     | Run the Prettier check and ESLint, as CI does |
| `npm run eslint`   | Run ESLint                                    |
| `npm run prettier` | Format code with Prettier                     |
| `npm run package`  | Package as `.vsix`                            |

## Issues and Planning

- We use GitHub issues to track bugs and enhancement requests.

- Please provide as much context as possible when you open an issue. The information you provide must be comprehensive enough to reproduce that issue for the assignee.
