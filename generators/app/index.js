'use strict';
const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
const path = require("node:path");

module.exports = class extends Generator {

  constructor(args, opts) {
    super(args, opts);

    this.option("build-element-folder", {
      type: String,
      alias: "b",
      description: "Location of the build_element folder",
      default: "src_ts/build_element",
      storage: this.config
    });

    this.option("default-types-file", {
      type: String,
      alias: "d",
      description: "Location of the defaultTypes.d.ts file",
      default: "src_ts/defaultTypes.d.ts",
      storage: this.config
    });
  }

  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(
        `Generating a new behavior file ${chalk.red("generator-sn-behavior")}`
      )
    );
    
    const defaultBuildElementFolder = this.options["build-element-folder"];

    /** @type {Generator.Questions<any>} */
    const prompts = [
      {
        type: "input",
        name: "buildElementFolder",
        message: "Path to build_element folder",
        default: defaultBuildElementFolder,
        store: true,
        storage: this.config
      },
      {
        type: "input",
        name: "behaviorName",
        message: "Name of the new behavior (ex: newBehavior)",
        validate: input => {
          let whiteSpaceRegex = /\s/;
          let characterRegex = /[a-zA-Z]/;
          if (whiteSpaceRegex.test(input)) {
            return "No whitespace allowed in component name";
          }
          if (!characterRegex.test(input)) {
            return "First character must be a letter";
          }
          return true;
        },
        askAnswered: true,
        store: false
      },
      {
        type: "input",
        name: "stateName",
        message: "Name of the state type",
        askAnswered: true,
        store: false,
        default: answers => {
          let behaviorName = answers.behaviorName;
          behaviorName = this._capitalizeName(behaviorName);
          behaviorName = this._normalizeName(behaviorName);
          return `${behaviorName}State`;
        }
      },
      {
        type: "input",
        name: "propsName",
        message: "Name of properties type",
        askAnswered: true,
        store: false,
        default: answers => {
          let behaviorName = answers.behaviorName;
          behaviorName = this._capitalizeName(behaviorName);
          behaviorName = this._normalizeName(behaviorName);
          return `${behaviorName}Props`;
        }
      },
      {
        type: "input",
        name: "optionsName",
        message: "Name of options type",
        askAnswered: true,
        store: false,
        default: answers => {
          let behaviorName = answers.behaviorName;
          behaviorName = this._capitalizeName(behaviorName);
          behaviorName = this._normalizeName(behaviorName);
          return `${behaviorName}Options`;
        }
      },
      {
        type: "input",
        name: "behaviorPath",
        message: "Path to where you want the behavior file",
        default: "src_ts/behaviors",
        store: true,
        storage: this.config,
        askAnswered: true
      }
    ]

    return this.prompt(prompts).then(props => {
      this.props = props;
    });
  }

  writing() {
    let defaultTypes = this.options["default-types-file"];
    let {
      buildElementFolder,
      behaviorName,
      stateName,
      propsName,
      optionsName,
      behaviorPath
    } = this.props;

    let normalBehaviorName = this._normalizeName(behaviorName);
    let behaviorMainName = `${behaviorPath}/${behaviorName}`;
    let behaviorMainFilePath = `${behaviorMainName}.ts`;

    let buildElementLoc = path.relative(
      behaviorPath, 
      `${buildElementFolder}/buildElement`
    );
    let defaultTypesLoc = path.relative(
      behaviorPath,
      this._removeExtension(this._removeExtension(defaultTypes))
    );
    let behaviorTypesFile = `${buildElementFolder}/behaviorTypes.ts`;
    
    let templateArgs = {
      buildElementLoc,
      stateName,
      propsName,
      optionsName,
      defaultTypesLoc,
      normalBehaviorName,
      behaviorName
    };

    this.renderTemplate("behavior.ts.ejs", behaviorMainFilePath, templateArgs);

    this._addNewBehavior(behaviorName, propsName, stateName, optionsName, behaviorPath, behaviorTypesFile);
  }

  // #MARK: Helper Functions

  /**
   * 
   * @param {string} name 
   * @returns {string}
   */
  _normalizeName(name) {
    return name.replace(/-\w/g, match =>
      match.charAt(1).toUpperCase()
    );
  }

  /**
   * 
   * @param {string} name 
   * @returns {string}
   */
  _capitalizeName(name) {
    let firstChar = name.charAt(0);
    return name.replace(firstChar, firstChar.toUpperCase());
  }

  _removeExtension(filepath) {
    let extensionLength = path.extname(filepath).length;
    return filepath.slice(0, extensionLength * -1);
  }

  _addNewBehavior(
    behaviorName,
    behaviorProps,
    behaviorState,
    behaviorOptions,
    behaviorFolder,
    behaviorTypesLoc
  ) {
    let newBehaviorString = "";
    // newBehaviorString += ",\n";
    newBehaviorString += `\t'${behaviorName}': {\n`;
    newBehaviorString += `\t\tstate: ${behaviorState},\n`;
    newBehaviorString += `\t\tprops: ${behaviorProps},\n`;
    newBehaviorString += `\t\toptions: ${behaviorOptions},\n`;
    newBehaviorString += "\t}";

    let behaviorPath = `${behaviorFolder}/${behaviorName}`;
    let behaviorTypesDir = path.dirname(behaviorTypesLoc);
    let relPath = path.relative(behaviorTypesDir, behaviorPath);

    let importString = `import { ${behaviorProps}, ${behaviorState}, ${behaviorOptions} } from "${relPath}";`;
    this._writeNewBehaviorType(behaviorTypesLoc, newBehaviorString, importString);
  }

  _writeNewBehaviorType(
    behaviorTypesPath,
    newBehaviorString,
    newBehaviorImportString
  ) {
    let behaviorTypesFile = this.fs.read(behaviorTypesPath);

    let newBtFile = this._appendBehaviorType(behaviorTypesFile, newBehaviorString);
    newBtFile = this._appendBehaviorImport(newBtFile, newBehaviorImportString);

    this.fs.write(behaviorTypesPath, newBtFile);
  }

  _appendBehaviorType(filetext, newBehaviorString) {
    let etRegex = /interface BehaviorTypes {(?<behav>\s*'\S+'\s*:\s*{(\s|\S)*?},?)*\s*}/;
    if (!etRegex.test(filetext)) {
      this.log(chalk.red("Error: behaviorTypes.ts file formatted incorrectly"));
      return filetext;
    }
    let matches = etRegex.exec(filetext);
    
    if (matches && matches.groups.behav) {
      let [btStart, btEnd] = filetext.split(matches.groups.behav);
      btStart += matches.groups.behav;
      return btStart + ",\n" + newBehaviorString + btEnd;
    } else {
      let [btStart, btEnd] = filetext.split(matches[0]);
      let newInterfaceSection = "interface BehaviorTypes {\n";
      newInterfaceSection += `${newBehaviorString}\n`;
      newInterfaceSection += "}";
      return btStart + newInterfaceSection + btEnd;
    }
  }

  /**
   * 
   * @param {string} filetext 
   * @param {string} newBehaviorImportString 
   * @returns {string}
   */
  _appendBehaviorImport(filetext, newBehaviorImportString) {
    let importRegex = /(?:import\s*{.+?}\s*from\s*".*"\s*;?\s*?[\r\n\v\f])+/;

    if (importRegex.test(filetext)) {
      let matches = filetext.match(importRegex);
      if (matches) {
        let startIndex = matches.index + matches[0].length;
        let startText = filetext.slice(0, startIndex);
        let endText = filetext.slice(startIndex);
        return `${startText}${newBehaviorImportString}\n${endText}`;
      }
    }
    // Else add to the top of file
    return `${newBehaviorImportString}\n${filetext}`;
  }

};
