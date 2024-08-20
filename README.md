# Yearly Price Increase Page

This page is the Yearly Price Increase module written in Vue 3 (Vite) and Vuetify 3.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Author's IDE Setup

[JetBrain's PHPStorm](https://www.jetbrains.com/phpstorm/)

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```
An `.env` file with appropriate environmental variables is crucial for building and uploading to production server.
An example for such file can be found in the `.env.example` file.
### Compile and Hot-Reload for simple UI debugging
Note: This mode run without NetSuite modules which greatly limits what the application can do

```sh
npm run dev
```

### Compile and Minify the HTML file then upload to NetSuite's File Cabinet

```sh
npm run build
```

### Compile and Upload the SuiteLet file to NetSuite's File Cabinet

```sh
npm run upload-suitelet
```

### Compile and Upload the Client file to NetSuite's File Cabinet

```sh
npm run upload-client
```
