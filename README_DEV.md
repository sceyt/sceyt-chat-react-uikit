# Getting Started with Sceyt Chat React UiKit For Developers
To run Sceyt Chat React UiKit locally and link it to your project.
Follow these steps to set up your environment:
### Make a sense  that when adding functionality to UiKit, it is crucial to declare types correctly and avoid using "any" type, especially for properties of dynamic components.


## Clone

Visit our [GitHub repository](https://github.com/sceyt/sceyt-chat-react-uikit 'Sceyt UiKit') and clone Sceyt Chat React UiKit.

After cloning UiKit, install the dependencies.
```bash
yarn
```

## Run and link Sceyt Chat React UiKit locally
### 1. Run UiKit:
Run the start command from the  package.json.
Wait for a successful run and you will see a dist folder created in the project root.
```bash
yarn start
```
### 2. Copy package.json to dist folder:
Once the start script has successfully run and the dist folder has been created, copy package.json to the dist folder.

### 3. Link UiKit from dist folder:
Open the dist folder on a terminal and run the yarn link.
```bash
yarn link
```
### 4. Use linked UiKit in your project:
You can now use locally runned UiKit in your project. If you have the sceyt-chat-react-uikit package in your
project's package.json, you first need to remove that package, run yran/npm install, and then run the following command.
If you don't have it, you can just run it.
```bash
yarn link sceyt-chat-react-uikit
```
